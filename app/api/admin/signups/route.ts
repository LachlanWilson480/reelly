import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdmin } from '@/lib/adminAuth'
import { HEARD_LABEL } from '@/lib/signupSource'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type Row = { key: string; label: string; last30: number; all: number; paying: number }

// Where sign-ups come from: the "How did you hear" answer and the page they signed up from, with how many now pay
export async function GET(req: NextRequest) {
  if (!(await getAdmin(req))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  type U = { id: string; email?: string; created_at: string; user_metadata?: Record<string, unknown> }
  const users: U[] = []
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    users.push(...(data.users as U[]))
    if (data.users.length < 1000) break
  }

  const { data: subs } = await admin.from('subscriptions').select('user_id').eq('status', 'active').not('stripe_subscription_id', 'is', null)
  const paying = new Set((subs || []).map((s) => s.user_id as string))

  const since = Date.now() - 30 * 24 * 60 * 60 * 1000
  const tally = (pick: (u: U) => string, label: (k: string) => string) => {
    const m = new Map<string, Row>()
    for (const u of users) {
      const key = pick(u) || 'none'
      const r = m.get(key) || { key, label: key === 'none' ? 'Not answered' : label(key), last30: 0, all: 0, paying: 0 }
      r.all++
      if (new Date(u.created_at).getTime() >= since) r.last30++
      if (paying.has(u.id)) r.paying++
      m.set(key, r)
    }
    return [...m.values()].sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : b.last30 - a.last30 || b.all - a.all))
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : '')

  const heard = tally((u) => str(u.user_metadata?.heard_about), (k) => HEARD_LABEL[k] || k)
  const from = tally((u) => str(u.user_metadata?.signup_from), (k) => k)

  const recent = [...users]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 30)
    .map((u) => ({
      email: u.email || '',
      created_at: u.created_at,
      heard: HEARD_LABEL[str(u.user_metadata?.heard_about)] || '',
      from: str(u.user_metadata?.signup_from),
      paying: paying.has(u.id),
    }))

  return NextResponse.json({
    totals: { all: users.length, last30: users.filter((u) => new Date(u.created_at).getTime() >= since).length, paying: users.filter((u) => paying.has(u.id)).length },
    heard, from, recent,
  })
}
