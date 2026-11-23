// Creator commission: records what each creator earns from people who join with their code,
// holds it for 30 days, then once a month works out payouts and emails each creator a statement.
// Tables are in supabase/creator_payouts.sql. Managed at /admin/creators.
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const HOLD_DAYS = 30
export const MIN_PAYOUT_CENTS = 2000         // smaller amounts carry over to the next month
export const NO_ABN_LIMIT_CENTS = 7500       // ATO: no withholding on $75 or less
export const NO_ABN_RATE = 0.47
const CLAWBACK_DAYS = 120                    // how far back refunds are checked on commission already paid
const DAY = 24 * 60 * 60 * 1000

export const money = (cents: number, currency = 'aud') => {
  const sym = currency.toLowerCase() === 'aud' ? 'A$' : `${currency.toUpperCase()} `
  return `${cents < 0 ? '-' : ''}${sym}${(Math.abs(cents) / 100).toFixed(2)}`
}
const planName = (p: string | null | undefined) => (p === 'top' ? 'Pro' : 'Basic')
const idOf = (x: string | { id: string } | null | undefined) => (typeof x === 'string' ? x : x?.id || null)
const site = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://www.reelezy.com'
const adminEmail = () => (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean)[0] || ''
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

export type Creator = {
  id: string; name: string; email: string; code: string
  commission_percent: number; commission_months: number | null
  abn: string | null; supplier_statement: boolean; agreement_signed: boolean
  bsb: string | null; account_number: string | null; account_name: string | null
  note: string | null; active: boolean; last_statement_period: string | null; created_at: string
}

// The month a run reports on (the month before, Sydney time), like { key: '2026-11', label: 'November 2026' }
export function statementPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: 'numeric' }).formatToParts(now)
  let y = Number(parts.find(p => p.type === 'year')!.value)
  let m = Number(parts.find(p => p.type === 'month')!.value) - 1
  if (m === 0) { m = 12; y -= 1 }
  const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return { key: `${y}-${String(m).padStart(2, '0')}`, label }
}

const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x }

// ---------------------------------------------------------------------------
// Called by the Stripe webhook for every successful invoice payment
// ---------------------------------------------------------------------------
export async function recordCreatorCommission(invoice: Stripe.Invoice, sub: Stripe.Subscription) {
  const codeId = sub.metadata?.discount_code_id
  const paid = invoice.amount_paid ?? 0
  if (!codeId || paid <= 0) return
  const { data: codeRow } = await admin.from('discount_codes').select('code').eq('id', codeId).maybeSingle()
  if (!codeRow?.code) return
  const { data: creator } = await admin.from('creators').select('*').eq('code', String(codeRow.code).toUpperCase()).maybeSingle<Creator>()
  if (!creator || !creator.active) return

  // Creators cannot earn on their own subscription
  const customerEmail = (invoice.customer_email || '').trim().toLowerCase()
  if (customerEmail && customerEmail === creator.email.trim().toLowerCase()) return

  const paidAtSec = invoice.status_transitions?.paid_at || invoice.created || Math.floor(Date.now() / 1000)
  const paidAt = new Date(paidAtSec * 1000)
  if (creator.commission_months) {
    const end = addMonths(new Date((sub.start_date || paidAtSec) * 1000), creator.commission_months)
    if (paidAt >= end) return
  }

  // Commission is a share of the plan price before the code discount, never more than the customer paid
  const list = invoice.subtotal && invoice.subtotal > 0 ? invoice.subtotal : paid
  const commission = Math.min(paid, Math.round(list * Number(creator.commission_percent) / 100))
  if (commission <= 0) return

  const price = sub.items?.data?.[0]?.price
  await admin.from('creator_commissions').upsert({
    creator_id: creator.id,
    stripe_invoice_id: invoice.id,
    stripe_subscription_id: sub.id,
    user_id: sub.metadata?.userId || null,
    plan: sub.metadata?.plan || null,
    billing_interval: price?.recurring?.interval === 'year' ? 'yearly' : 'monthly',
    currency: (invoice.currency || 'aud').toLowerCase(),
    list_cents: list,
    paid_cents: paid,
    commission_cents: commission,
    commission_aud_cents: (invoice.currency || 'aud').toLowerCase() === 'aud' ? commission : null,
    paid_at: paidAt.toISOString(),
    payable_after: new Date(paidAt.getTime() + HOLD_DAYS * DAY).toISOString(),
    status: 'pending',
  }, { onConflict: 'stripe_invoice_id', ignoreDuplicates: true })
}

// ---------------------------------------------------------------------------
// Looks up the card payment behind an invoice: refunds, disputes and the AUD amount received
// ---------------------------------------------------------------------------
async function paymentFor(stripe: Stripe, invoiceId: string) {
  const list = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 10 })
  const p = list.data.find(x => x.status === 'paid') || list.data[0]
  const pay = p?.payment
  let charge: Stripe.Charge | null = null
  if (pay?.charge) {
    charge = await stripe.charges.retrieve(idOf(pay.charge)!, { expand: ['balance_transaction'] })
  } else if (pay?.payment_intent) {
    const pi = await stripe.paymentIntents.retrieve(idOf(pay.payment_intent)!, { expand: ['latest_charge.balance_transaction'] })
    charge = (pi.latest_charge && typeof pi.latest_charge !== 'string') ? pi.latest_charge : null
  }
  if (!charge) return null
  const bt = charge.balance_transaction && typeof charge.balance_transaction !== 'string' ? charge.balance_transaction : null
  const refundedShare = charge.disputed ? 1 : charge.amount > 0 ? Math.min(1, (charge.amount_refunded || 0) / charge.amount) : 0
  // How many AUD cents one cent of the customer's currency became
  const audRate = charge.currency === 'aud' ? 1 : bt && bt.currency === 'aud' && charge.amount > 0 ? bt.amount / charge.amount : null
  return { refundedShare, audRate, disputed: !!charge.disputed }
}

type Row = {
  id: string; creator_id: string; stripe_invoice_id: string; plan: string | null; billing_interval: string | null
  currency: string; list_cents: number; paid_cents: number; commission_cents: number; commission_aud_cents: number | null
  paid_at: string; payable_after: string; status: string; reason: string | null; clawed_back: boolean; payout_id: string | null
}

// Ends the 30 day hold on commission that is due: refunded or disputed payments are taken off
async function settleDue(stripe: Stripe, now: Date) {
  const { data: due } = await admin.from('creator_commissions').select('*')
    .in('status', ['pending', 'check']).lte('payable_after', now.toISOString())
  for (const r of (due || []) as Row[]) {
    try {
      const pay = await paymentFor(stripe, r.stripe_invoice_id)
      if (!pay) {
        await admin.from('creator_commissions').update({ status: 'check', reason: 'No card payment found in Stripe for this invoice' }).eq('id', r.id)
        continue
      }
      if (pay.refundedShare >= 1) {
        await admin.from('creator_commissions').update({ status: 'reversed', reason: pay.disputed ? 'Payment disputed' : 'Payment refunded' }).eq('id', r.id)
        continue
      }
      if (pay.audRate == null) {
        await admin.from('creator_commissions').update({ status: 'check', reason: 'Could not work out the AUD amount' }).eq('id', r.id)
        continue
      }
      const aud = Math.round(r.commission_cents * pay.audRate * (1 - pay.refundedShare))
      await admin.from('creator_commissions').update({
        status: aud > 0 ? 'payable' : 'reversed',
        commission_aud_cents: aud,
        reason: pay.refundedShare > 0 ? 'Part of the payment was refunded' : null,
      }).eq('id', r.id)
    } catch (e) {
      console.error('creator commission settle failed', r.id, e)
    }
  }
}

// A refund or dispute on commission already paid out comes off the creator's next payout
async function clawBack(stripe: Stripe, now: Date) {
  const since = new Date(now.getTime() - CLAWBACK_DAYS * DAY).toISOString()
  const { data: paid } = await admin.from('creator_commissions').select('*')
    .eq('status', 'paid').eq('clawed_back', false).gt('commission_aud_cents', 0).gte('paid_at', since)
  for (const r of (paid || []) as Row[]) {
    try {
      const pay = await paymentFor(stripe, r.stripe_invoice_id)
      if (!pay || pay.refundedShare <= 0) continue
      const back = Math.round((r.commission_aud_cents || 0) * pay.refundedShare)
      if (back <= 0) continue
      const { error } = await admin.from('creator_commissions').insert({
        creator_id: r.creator_id, stripe_invoice_id: `${r.stripe_invoice_id}:refund`, plan: r.plan, billing_interval: r.billing_interval,
        currency: 'aud', commission_cents: -back, commission_aud_cents: -back, paid_at: now.toISOString(), payable_after: now.toISOString(),
        status: 'payable', reason: pay.disputed ? 'Taken back: payment disputed after payout' : 'Taken back: payment refunded after payout',
      })
      if (!error) await admin.from('creator_commissions').update({ clawed_back: true }).eq('id', r.id)
    } catch (e) {
      console.error('creator clawback failed', r.id, e)
    }
  }
}

// ---------------------------------------------------------------------------
// Monthly run: settle, make payouts, email statements
// ---------------------------------------------------------------------------
export type RunResult = { period: string; payouts: { creator: string; total: number; withheld: number; net: number }[]; statements: number; carried: number }

export async function runCreatorStatements(stripe: Stripe, opts: { now?: Date } = {}): Promise<RunResult> {
  const now = opts.now || new Date()
  const period = statementPeriod(now)
  await settleDue(stripe, now)
  await clawBack(stripe, now)

  const { data: creators } = await admin.from('creators').select('*').order('created_at')
  const result: RunResult = { period: period.label, payouts: [], statements: 0, carried: 0 }
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

  for (const c of (creators || []) as Creator[]) {
    const { data: rowsData } = await admin.from('creator_commissions').select('*').eq('creator_id', c.id).in('status', ['payable', 'pending', 'check'])
    const rows = (rowsData || []) as Row[]
    const payable = rows.filter(r => r.status === 'payable' && !r.payout_id)
    const pending = rows.filter(r => r.status !== 'payable')
    const total = payable.reduce((s, r) => s + (r.commission_aud_cents || 0), 0)

    let payout: { id: string; total: number; withheld: number; net: number } | null = null
    if (total >= MIN_PAYOUT_CENTS) {
      const withheld = !c.abn && !c.supplier_statement && total > NO_ABN_LIMIT_CENTS ? Math.round(total * NO_ABN_RATE) : 0
      const { data: p, error } = await admin.from('creator_payouts').insert({
        creator_id: c.id, period: period.key, total_cents: total, withheld_cents: withheld, net_cents: total - withheld, status: 'owed',
      }).select('id').single()
      if (error || !p) { console.error('creator payout insert failed', c.id, error); continue }
      await admin.from('creator_commissions').update({ payout_id: p.id }).in('id', payable.map(r => r.id))
      payout = { id: p.id, total, withheld, net: total - withheld }
      result.payouts.push({ creator: c.name, total, withheld, net: total - withheld })
    } else if (payable.length) {
      result.carried += 1
    }

    // One statement per creator per month, sent when there is anything to report
    const alreadySent = c.last_statement_period === period.key
    const hasNews = !!payout || payable.length > 0 || pending.length > 0
    if (resend && hasNews && (!alreadySent || payout)) {
      try {
        const { data: code } = await admin.from('discount_codes').select('uses').eq('code', c.code).maybeSingle()
        await resend.emails.send({
          from: 'Reelezy <noreply@reelezy.com>',
          to: c.email,
          ...(adminEmail() ? { replyTo: adminEmail() } : {}),
          subject: `Your Reelezy creator statement for ${period.label}`,
          html: statementHtml(c, period.label, payout, payable, payout ? 0 : total, pending, code?.uses ?? null),
        })
        await admin.from('creators').update({ last_statement_period: period.key }).eq('id', c.id)
        result.statements += 1
      } catch (e) {
        console.error('creator statement email failed', c.id, e)
      }
    }
  }

  // A summary for you, so you know what to pay
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (resend && adminEmails.length && result.payouts.length) {
    try {
      const lines = result.payouts.map(p => `<tr><td style="padding:4px 12px 4px 0">${esc(p.creator)}</td><td style="padding:4px 12px 4px 0">${money(p.net)}</td><td style="padding:4px 0;color:#888">${p.withheld ? `${money(p.withheld)} held for the ATO` : ''}</td></tr>`).join('')
      await resend.emails.send({
        from: 'Reelezy <noreply@reelezy.com>',
        to: adminEmails,
        subject: `Creator payouts to make for ${period.label}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C2C2A">
          <h2 style="margin:0 0 12px">${result.payouts.length} creator payout${result.payouts.length === 1 ? '' : 's'} for ${period.label}</h2>
          <table style="font-size:14px;border-collapse:collapse">${lines}</table>
          <p style="margin-top:20px"><a href="${site()}/admin/creators" style="color:#FF6A4D">Open the creator page</a> to download the bank file and mark each one paid.</p>
        </div>`,
      })
    } catch (e) {
      console.error('creator admin summary failed', e)
    }
  }
  return result
}

function statementHtml(c: Creator, periodLabel: string, payout: { total: number; withheld: number; net: number } | null,
  paidRows: Row[], carried: number, pending: Row[], uses: number | null) {
  const date = (s: string) => new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Sydney' })
  const cell = 'padding:6px 10px 6px 0;border-bottom:1px solid #eee;font-size:13px'
  const table = (list: Row[]) => { const rows = [...list].sort((a, b) => a.paid_at.localeCompare(b.paid_at)); return `<table style="border-collapse:collapse;width:100%">
    <tr><th style="${cell};text-align:left;color:#888">Paid</th><th style="${cell};text-align:left;color:#888">Plan</th><th style="${cell};text-align:left;color:#888">Plan price</th><th style="${cell};text-align:left;color:#888">Customer paid</th><th style="${cell};text-align:right;color:#888">You earn</th></tr>
    ${rows.map(r => `<tr><td style="${cell}">${date(r.paid_at)}</td><td style="${cell}">${r.reason?.startsWith('Taken back') ? esc(r.reason) : `${planName(r.plan)}${r.billing_interval === 'yearly' ? ' yearly' : ''}`}</td>
      <td style="${cell}">${r.list_cents ? money(r.list_cents, r.currency) : ''}</td><td style="${cell}">${r.paid_cents ? money(r.paid_cents, r.currency) : ''}</td>
      <td style="${cell};text-align:right">${money(r.commission_aud_cents ?? r.commission_cents, r.commission_aud_cents != null ? 'aud' : r.currency)}</td></tr>`).join('')}
  </table>` }
  const pendingTotal = pending.filter(r => r.currency === 'aud').reduce((s, r) => s + r.commission_cents, 0)
  const pendingOther = pending.some(r => r.currency !== 'aud')
  const last4 = (c.account_number || '').replace(/\D/g, '').slice(-3)

  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:28px;color:#2C2C2A">
    <h2 style="margin:0 0 4px">Creator statement, ${esc(periodLabel)}</h2>
    <p style="margin:0 0 20px;color:#666">Hi ${esc(c.name.split(' ')[0] || c.name)}, here is what your code <b>${esc(c.code)}</b> earned. You get ${Number(c.commission_percent)}% of each payment${c.commission_months ? ` for each person's first ${c.commission_months} months` : ' for as long as each person stays subscribed'}.</p>
    ${uses != null ? `<p style="margin:0 0 20px">People who have joined with your code so far: <b>${uses}</b></p>` : ''}
    ${payout ? `
      <h3 style="margin:0 0 8px;font-size:16px">This payout</h3>
      ${table(paidRows)}
      <table style="margin-top:12px;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:3px 16px 3px 0">Total earned</td><td><b>${money(payout.total)}</b></td></tr>
        ${payout.withheld ? `<tr><td style="padding:3px 16px 3px 0">Held for the ATO (no ABN given)</td><td>${money(payout.withheld)}</td></tr>` : ''}
        <tr><td style="padding:3px 16px 3px 0">Paid to you</td><td><b>${money(payout.net)}</b></td></tr>
      </table>
      <p style="color:#666;font-size:13px">This is paid by bank transfer${last4 ? ` to your account ending in ${last4}` : ''} within 7 days.${payout.withheld ? ' Send us your ABN or a signed ATO Statement by a supplier and nothing will be held back from future payouts.' : ''}</p>`
    : carried < 0 ? `${table(paidRows)}<p>A payment you earned on was refunded after it was paid out, so <b>${money(-carried)}</b> comes off your next payout.</p>`
    : carried > 0 ? `<h3 style="margin:0 0 8px;font-size:16px">Earned so far</h3>${table(paidRows)}<p>You have earned <b>${money(carried)}</b> so far. Payouts are made once you reach ${money(MIN_PAYOUT_CENTS)}, so this carries over to next month.</p>`
    : ''}
    ${pending.length ? `<h3 style="margin:24px 0 8px;font-size:16px">Coming next month</h3>
      <p style="margin:0 0 8px;color:#666;font-size:13px">Each payment is held for ${HOLD_DAYS} days in case of a refund, then paid out with the next statement.</p>
      ${table(pending)}
      ${pendingTotal ? `<p style="font-size:14px">About <b>${money(pendingTotal)}</b>${pendingOther ? ' plus overseas payments, converted to AUD when paid out' : ''}.</p>` : ''}` : ''}
    <p style="margin-top:28px;color:#888;font-size:12px">Remember to label every Reelezy post as an ad, for example #ad or the Paid Partnership label. Questions? Just reply to this email.</p>
  </div>`
}
