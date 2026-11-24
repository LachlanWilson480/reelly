import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdmin } from '@/lib/adminAuth'
import { cleanCreatorCode, randomCodeEnding } from '@/lib/creatorAccount'
import { codeTaken } from '@/lib/adminCodes'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const str = (s: unknown) => { const v = String(s ?? '').trim(); return v ? v.slice(0, 200) : null }
const months = (v: unknown, fallback: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 ? Math.min(36, n) : fallback }
const planOf = (v: unknown) => (v === 'basic' ? 'basic' : 'top')

type Row = {
  id: string; code: string; name: string | null; note: string | null; plan: string; months: number; active: boolean
  redeemed_by: string | null; redeemed_at: string | null; ends_at: string | null; created_at: string
}

// Creator accounts: one-time codes that give a small business a free plan in return for content
export async function GET(req: NextRequest) {
  if (!(await getAdmin(req))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const { data, error } = await admin.from('creator_access_codes').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: /creator_access_codes/.test(error.message) ? 'Run supabase/creator_accounts.sql in Supabase first.' : error.message }, { status: 500 })
  const rows = (data || []) as Row[]
  const now = Date.now()
  const out = await Promise.all(rows.map(async r => {
    let email: string | null = null, business: string | null = null
    if (r.redeemed_by) {
      const [{ data: u }, { data: bp }] = await Promise.all([
        admin.auth.admin.getUserById(r.redeemed_by),
        admin.from('business_profiles').select('business_name').eq('user_id', r.redeemed_by).maybeSingle(),
      ])
      email = u?.user?.email || null
      business = bp?.business_name || null
    }
    const state = !r.redeemed_at ? (r.active ? 'waiting' : 'off') : r.ends_at && new Date(r.ends_at).getTime() > now ? 'running' : 'ended'
    return { ...r, email, business, state }
  }))
  return NextResponse.json({ accounts: out })
}

export async function POST(req: NextRequest) {
  if (!(await getAdmin(req))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const action = body?.action

  if (action === 'create') {
    const base = cleanCreatorCode(body.code)
    if (base.replace(/-/g, '').length < 3) return NextResponse.json({ error: 'The code needs at least 3 letters or numbers. Their handle works well.' }, { status: 400 })
    // A random ending stops anyone guessing the code from the creator's handle. On unless you untick it.
    let code = base
    if (body.randomEnding !== false) {
      for (let i = 0; i < 5; i++) {
        code = `${base.slice(0, 34)}-${randomCodeEnding()}`
        if (!(await codeTaken(admin, code))) break
      }
    }
    const clash = await codeTaken(admin, code)
    if (clash) return NextResponse.json({ error: `${code} is already ${clash}. Pick a different one.` }, { status: 400 })
    const { error } = await admin.from('creator_access_codes').insert({
      code, name: str(body.name), note: str(body.note), plan: planOf(body.plan), months: months(body.months, 3),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, code })
  }

  const id = str(body.id)
  if (!id) return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  const { data: row } = await admin.from('creator_access_codes').select('*').eq('id', id).maybeSingle<Row>()
  if (!row) return NextResponse.json({ error: 'That code no longer exists.' }, { status: 404 })

  if (action === 'update') {
    const f = body.fields || {}
    const update: Record<string, unknown> = {}
    if ('name' in f) update.name = str(f.name)
    if ('note' in f) update.note = str(f.note)
    if ('active' in f) update.active = !!f.active
    // The code, plan and months can only change before someone uses it
    if (!row.redeemed_by) {
      if ('plan' in f) update.plan = planOf(f.plan)
      if ('months' in f) update.months = months(f.months, row.months)
      if ('code' in f) {
        const code = cleanCreatorCode(f.code)
        if (code !== row.code) {
          if (code.length < 3) return NextResponse.json({ error: 'The code needs at least 3 letters or numbers.' }, { status: 400 })
          const clash = await codeTaken(admin, code)
          if (clash) return NextResponse.json({ error: `${code} is already ${clash}. Pick a different one.` }, { status: 400 })
          update.code = code
        }
      }
    }
    const { error } = await admin.from('creator_access_codes').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'extend') {
    // More months for a running or ended creator account, counted from its current end date (or today if it has ended)
    if (!row.redeemed_by) return NextResponse.json({ error: 'Nobody has used this code yet. Change its months instead.' }, { status: 400 })
    const extra = months(body.months, 1)
    const base = row.ends_at && new Date(row.ends_at) > new Date() ? new Date(row.ends_at) : new Date()
    base.setMonth(base.getMonth() + extra)
    const ends = base.toISOString()
    const { data: sub } = await admin.from('subscriptions').select('stripe_subscription_id, status').eq('user_id', row.redeemed_by).maybeSingle()
    if (sub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(sub.status)) {
      return NextResponse.json({ error: 'This account pays through Stripe now, so it cannot be extended here.' }, { status: 400 })
    }
    const { error } = await admin.from('subscriptions').upsert({
      user_id: row.redeemed_by, plan: row.plan, status: 'active', paid: false, manual_until: ends, current_period_end: ends, creator_until: ends,
      stripe_subscription_id: null, deletion_scheduled_at: null, deletion_warning_sent: false,
    }, { onConflict: 'user_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await admin.from('creator_access_codes').update({ ends_at: ends }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'end') {
    // Ends a running creator account now. They go back to the Free plan.
    if (!row.redeemed_by) return NextResponse.json({ error: 'Nobody has used this code yet. Turn it off instead.' }, { status: 400 })
    const now = new Date().toISOString()
    await admin.from('subscriptions').update({ status: 'canceled', paid: false, manual_until: now, current_period_end: now, creator_until: now })
      .eq('user_id', row.redeemed_by).is('stripe_subscription_id', null).not('creator_until', 'is', null)
    await admin.from('creator_access_codes').update({ ends_at: now }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    if (row.redeemed_by) return NextResponse.json({ error: 'This code has been used, so it is kept as a record. End the account instead.' }, { status: 400 })
    await admin.from('creator_access_codes').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
