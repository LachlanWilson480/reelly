import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdmin } from '@/lib/adminAuth'
import { userIdsForEmail } from '@/lib/userIdsForEmail'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Plans given by hand (no payment), and creator accounts, which are given plans too
export async function GET(req: NextRequest) {
  if (!(await getAdmin(req))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const { data, error } = await admin.from('subscriptions').select('*')
    .not('manual_until', 'is', null).is('stripe_subscription_id', null).order('manual_until', { ascending: false }).limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const now = Date.now()
  const plans = await Promise.all((data || []).map(async s => {
    const [{ data: u }, { data: bp }] = await Promise.all([
      admin.auth.admin.getUserById(s.user_id),
      admin.from('business_profiles').select('business_name').eq('user_id', s.user_id).maybeSingle(),
    ])
    const running = s.status === 'active' && new Date(s.manual_until).getTime() > now
    return {
      user_id: s.user_id, email: u?.user?.email || '', business: bp?.business_name || null,
      plan: s.plan === 'top' ? 'Pro' : 'Basic', until: s.manual_until, running,
      creator: !!s.creator_until && new Date(s.creator_until).getTime() > now,
    }
  }))
  return NextResponse.json({ plans })
}

export async function POST(req: NextRequest) {
  if (!(await getAdmin(req))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const who = String(body?.email || '').trim().toLowerCase()
  if (!who.includes('@')) return NextResponse.json({ error: 'Type the email address of their Reelezy account.' }, { status: 400 })

  if (body.action === 'give') {
    const months = Math.max(1, Math.min(36, Math.round(Number(body.months) || 1)))
    const { data, error } = await admin.rpc('give_plan', { who, plan_name: body.plan === 'basic' ? 'basic' : 'pro', months })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, message: String(data || 'Done.') })
  }

  if (body.action === 'end') {
    const { data, error } = await admin.rpc('end_given_plan', { who })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    // If it was a creator account, the badge lock ends with it
    const now = new Date().toISOString()
    for (const id of await userIdsForEmail(admin, who)) {
      await admin.from('subscriptions').update({ creator_until: now }).eq('user_id', id).is('stripe_subscription_id', null).not('creator_until', 'is', null)
      await admin.from('creator_access_codes').update({ ends_at: now }).eq('redeemed_by', id).gt('ends_at', now)
    }
    return NextResponse.json({ ok: true, message: String(data || 'Done.') })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
