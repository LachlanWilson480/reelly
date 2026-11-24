import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdmin } from '@/lib/adminAuth'
import { codeTaken } from '@/lib/adminCodes'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const cleanCode = (s: unknown) => String(s || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40)
const str = (s: unknown) => { const v = String(s ?? '').trim(); return v ? v.slice(0, 200) : null }
const int = (v: unknown, lo: number, hi: number, fallback: number | null) => {
  const t = String(v ?? '').trim(); const n = Math.round(Number(t))
  return t === '' || !Number.isFinite(n) ? fallback : Math.max(lo, Math.min(hi, n))
}
const plansOf = (v: unknown) => (v === 'top' || v === 'pro' ? ['top'] : v === 'basic' ? ['basic'] : null)
const dateOf = (v: unknown) => { const t = String(v ?? '').trim(); if (!t) return null; const d = new Date(`${t}T23:59:59+11:00`); return Number.isNaN(d.getTime()) ? null : d.toISOString() }

// Discount codes: the ones people type at checkout for money off
export async function GET(req: NextRequest) {
  if (!(await getAdmin(req))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const [{ data, error }, { data: creators }] = await Promise.all([
    admin.from('discount_codes').select('*').order('code'),
    admin.from('creators').select('code, name'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const creatorOf = new Map((creators || []).map(c => [c.code, c.name]))
  return NextResponse.json({ codes: (data || []).map(c => ({ ...c, creator: creatorOf.get(c.code) || null })) })
}

export async function POST(req: NextRequest) {
  if (!(await getAdmin(req))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const f = body?.fields || {}

  const fields = (isNew: boolean) => {
    const out: Record<string, unknown> = {}
    if (isNew || 'percent_off' in f) out.percent_off = int(f.percent_off, 1, 100, 20)
    if (isNew || 'months' in f) out.months = int(f.months, 1, 12, 1)
    if (isNew || 'monthly_only' in f) out.monthly_only = !!f.monthly_only
    if (isNew || 'new_customers_only' in f) out.new_customers_only = !!f.new_customers_only
    if (isNew || 'plans' in f) out.plans = plansOf(f.plans)
    if (isNew || 'max_uses' in f) out.max_uses = int(f.max_uses, 1, 1000000, null)
    if (isNew || 'expires_at' in f) out.expires_at = dateOf(f.expires_at)
    if (isNew || 'note' in f) out.note = str(f.note)
    if ('active' in f) out.active = !!f.active
    return out
  }

  if (body?.action === 'create') {
    const code = cleanCode(f.code)
    if (code.length < 3) return NextResponse.json({ error: 'The code needs at least 3 letters or numbers.' }, { status: 400 })
    const clash = await codeTaken(admin, code)
    if (clash) return NextResponse.json({ error: `${code} is already ${clash}. Pick a different one.` }, { status: 400 })
    const row: Record<string, unknown> = { code, uses: 0, active: true, ...fields(true) }
    // 100% off for a year would be a free year: keep big discounts to monthly billing
    if (Number(row.percent_off) >= 50 && !row.monthly_only) row.monthly_only = true
    const { error } = await admin.from('discount_codes').insert(row)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, code })
  }

  if (body?.action === 'update') {
    const code = cleanCode(body.code)
    if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })
    const { error } = await admin.from('discount_codes').update(fields(false)).eq('code', code)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
