import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getAdmin } from '@/lib/adminAuth'
import { runCreatorStatements, statementPeriod, type Creator } from '@/lib/creatorCommission'

export const maxDuration = 300

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const cleanCode = (s: unknown) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const str = (s: unknown) => { const v = String(s ?? '').trim(); return v ? v : null }
const digits = (s: unknown) => { const v = String(s ?? '').replace(/\D/g, ''); return v ? v : null }

// Everything the creator page shows
export async function GET(req: NextRequest) {
  if (!(await getAdmin(req))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  const [{ data: creators }, { data: rows }, { data: payouts }] = await Promise.all([
    admin.from('creators').select('*').order('created_at', { ascending: false }),
    admin.from('creator_commissions').select('id, creator_id, status, commission_cents, commission_aud_cents, currency, payout_id, reason, paid_at, stripe_invoice_id'),
    admin.from('creator_payouts').select('*').order('created_at', { ascending: false }).limit(500),
  ])
  const codes = ((creators || []) as Creator[]).map(c => c.code)
  const { data: codeRows } = codes.length
    ? await admin.from('discount_codes').select('code, uses, percent_off, months, active').in('code', codes)
    : { data: [] as { code: string; uses: number; percent_off: number; months: number; active: boolean }[] }

  const byCreator = (creators || []).map((c: Creator) => {
    const mine = (rows || []).filter(r => r.creator_id === c.id)
    const sum = (f: (r: typeof mine[number]) => boolean) => mine.filter(f).reduce((s, r) => s + (r.commission_aud_cents ?? (r.currency === 'aud' ? r.commission_cents : 0)), 0)
    const code = (codeRows || []).find(k => k.code === c.code)
    return {
      ...c,
      uses: code?.uses ?? 0,
      customer_percent_off: code?.percent_off ?? null,
      customer_months: code?.months ?? null,
      code_active: code?.active ?? false,
      held_cents: sum(r => r.status === 'pending'),
      ready_cents: sum(r => r.status === 'payable' && !r.payout_id),
      paid_cents: (payouts || []).filter(p => p.creator_id === c.id && p.status === 'paid').reduce((s, p) => s + p.net_cents, 0),
      check_count: mine.filter(r => r.status === 'check').length,
    }
  })
  const owed = (payouts || []).filter(p => p.status === 'owed').map(p => {
    const c = (creators || []).find((x: Creator) => x.id === p.creator_id) as Creator | undefined
    return { ...p, name: c?.name || '', bsb: c?.bsb || '', account_number: c?.account_number || '', account_name: c?.account_name || '' }
  })
  const checks = (rows || []).filter(r => r.status === 'check').map(r => ({
    ...r, name: ((creators || []).find((x: Creator) => x.id === r.creator_id) as Creator | undefined)?.name || '',
  }))
  return NextResponse.json({ creators: byCreator, owed, checks, period: statementPeriod().label })
}

export async function POST(req: NextRequest) {
  if (!(await getAdmin(req))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const action = body?.action

  if (action === 'create') {
    const name = str(body.name), email = str(body.email)?.toLowerCase() || null, code = cleanCode(body.code)
    if (!name || !email || !email.includes('@')) return NextResponse.json({ error: 'Add the creator\'s name and email.' }, { status: 400 })
    if (code.length < 3) return NextResponse.json({ error: 'The code needs at least 3 letters or numbers.' }, { status: 400 })
    const { data: taken } = await admin.from('creators').select('id').eq('code', code).maybeSingle()
    if (taken) return NextResponse.json({ error: `${code} already belongs to another creator.` }, { status: 400 })

    // The code their followers type. An existing code with the same name is reused as it is.
    const { data: existing } = await admin.from('discount_codes').select('code').eq('code', code).maybeSingle()
    if (!existing) {
      const percentOff = Math.max(1, Math.min(100, Number(body.customer_percent_off) || 20))
      const months = Math.max(1, Math.min(12, Math.round(Number(body.customer_months) || 1)))
      const { error } = await admin.from('discount_codes').insert({
        code, percent_off: percentOff, months, monthly_only: true, new_customers_only: true,
        max_uses: null, expires_at: null, plans: null, note: `Creator: ${name}`, active: true, uses: 0,
      })
      if (error) return NextResponse.json({ error: `Could not make the code: ${error.message}` }, { status: 500 })
    }

    const commissionMonths = body.lifetime ? null : Math.max(1, Math.min(120, Math.round(Number(body.commission_months) || 12)))
    const { data: created, error } = await admin.from('creators').insert({
      name, email, code,
      commission_percent: Math.max(0, Math.min(100, Number(body.commission_percent) || 20)),
      commission_months: commissionMonths,
      abn: digits(body.abn), supplier_statement: !!body.supplier_statement, agreement_signed: !!body.agreement_signed,
      bsb: digits(body.bsb), account_number: digits(body.account_number), account_name: str(body.account_name), note: str(body.note),
    }).select('id').single()
    if (error || !created) return NextResponse.json({ error: `Could not save the creator: ${error?.message}` }, { status: 500 })

    // Free months of Reelezy for the creator, if they already have an account
    let freeNote: string | null = null
    const freeMonths = Math.round(Number(body.free_months) || 0)
    if (freeMonths > 0) {
      const { data, error: giveErr } = await admin.rpc('give_plan', { who: email, plan_name: body.free_plan === 'basic' ? 'basic' : 'pro', months: Math.min(24, freeMonths) })
      freeNote = giveErr ? `Creator saved, but the free months were not given: ${giveErr.message}` : String(data || 'Free months given.')
    }
    return NextResponse.json({ ok: true, id: created.id, freeNote })
  }

  if (action === 'update') {
    const id = str(body.id)
    if (!id) return NextResponse.json({ error: 'Missing creator' }, { status: 400 })
    const f = body.fields || {}
    const update: Record<string, unknown> = {}
    if ('name' in f) update.name = str(f.name)
    if ('email' in f) update.email = str(f.email)?.toLowerCase()
    if ('commission_percent' in f) update.commission_percent = Math.max(0, Math.min(100, Number(f.commission_percent) || 0))
    if ('commission_months' in f) update.commission_months = f.commission_months == null || f.commission_months === '' ? null : Math.max(1, Math.min(120, Math.round(Number(f.commission_months))))
    if ('abn' in f) update.abn = digits(f.abn)
    if ('supplier_statement' in f) update.supplier_statement = !!f.supplier_statement
    if ('agreement_signed' in f) update.agreement_signed = !!f.agreement_signed
    if ('bsb' in f) update.bsb = digits(f.bsb)
    if ('account_number' in f) update.account_number = digits(f.account_number)
    if ('account_name' in f) update.account_name = str(f.account_name)
    if ('note' in f) update.note = str(f.note)
    if ('active' in f) update.active = !!f.active
    if (update.name === null || update.email === null) return NextResponse.json({ error: 'Name and email cannot be empty.' }, { status: 400 })
    const { error } = await admin.from('creators').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Turning a creator off also stops their code working
    if ('active' in f) {
      const { data: c } = await admin.from('creators').select('code').eq('id', id).maybeSingle()
      if (c) await admin.from('discount_codes').update({ active: !!f.active }).eq('code', c.code)
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'mark_paid') {
    const id = str(body.payout_id)
    if (!id) return NextResponse.json({ error: 'Missing payout' }, { status: 400 })
    const { data: p, error } = await admin.from('creator_payouts').update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'owed').select('id').maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (p) await admin.from('creator_commissions').update({ status: 'paid' }).eq('payout_id', id).eq('status', 'payable')
    return NextResponse.json({ ok: true })
  }

  if (action === 'dismiss_check') {
    // A payment flagged for checking: pay it as recorded (AUD only), or drop it
    const id = str(body.id)
    if (!id) return NextResponse.json({ error: 'Missing row' }, { status: 400 })
    const { data: r } = await admin.from('creator_commissions').select('currency, commission_cents').eq('id', id).eq('status', 'check').maybeSingle()
    if (!r) return NextResponse.json({ ok: true })
    const pay = body.pay === true && r.currency === 'aud'
    await admin.from('creator_commissions').update(pay
      ? { status: 'payable', commission_aud_cents: r.commission_cents, reason: 'Approved by hand' }
      : { status: 'reversed', reason: 'Removed by hand' }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'run') {
    if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Billing not configured' }, { status: 500 })
    try {
      const result = await runCreatorStatements(new Stripe(process.env.STRIPE_SECRET_KEY))
      return NextResponse.json({ ok: true, result })
    } catch (e) {
      console.error('creator run failed', e)
      return NextResponse.json({ error: 'The monthly run failed. Check Sentry for details.' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
