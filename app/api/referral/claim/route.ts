import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { rateLimit } from '@/lib/rateLimit'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const NEW_ACCOUNT_DAYS = 7

const clean = (v: unknown) => {
  const c = typeof v === 'string' ? v.trim().toUpperCase() : ''
  return /^[A-Z0-9]{4,12}$/.test(c) ? c : ''
}

// Links the signed-in (new) user to the friend who referred them
export async function POST(req: NextRequest) {
  try {
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rl = await rateLimit(`referral-claim:${authed.userId}`, 10, 60000)
    if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })

    const body = await req.json().catch(() => ({}))
    const { data: userRes } = await admin.auth.admin.getUserById(authed.userId)
    const user = userRes?.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const code = clean(body?.code) || clean(user.user_metadata?.referral_code)
    if (!code) return NextResponse.json({ claimed: false, reason: 'no_code' })

    const { data: existing } = await admin.from('referrals').select('id').eq('referred_id', authed.userId).maybeSingle()
    if (existing) return NextResponse.json({ claimed: false, reason: 'already_referred' })

    const ageDays = (Date.now() - new Date(user.created_at).getTime()) / 86400000
    if (ageDays > NEW_ACCOUNT_DAYS) return NextResponse.json({ claimed: false, reason: 'not_new' })

    const { data: paid } = await admin.from('subscriptions').select('status, stripe_subscription_id').eq('user_id', authed.userId).maybeSingle()
    if (paid?.stripe_subscription_id) return NextResponse.json({ claimed: false, reason: 'has_subscription' })

    const { data: owner } = await admin.from('referral_codes').select('user_id').eq('code', code).maybeSingle()
    if (!owner) return NextResponse.json({ claimed: false, reason: 'unknown_code' })
    if (owner.user_id === authed.userId) return NextResponse.json({ claimed: false, reason: 'own_code' })

    const { error } = await admin.from('referrals').insert({ referrer_id: owner.user_id, referred_id: authed.userId, code })
    if (error) {
      if (error.code === '23505') return NextResponse.json({ claimed: false, reason: 'already_referred' })
      throw error
    }
    return NextResponse.json({ claimed: true })
  } catch (error) {
    console.error('referral claim error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not save referral' }, { status: 500 })
  }
}
