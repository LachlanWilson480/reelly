import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { rateLimit } from '@/lib/rateLimit'
import { cleanCreatorCode } from '@/lib/creatorAccount'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// The Code box on Plans checks this first. A creator code gives the signed-in account a free plan for the
// months set on the admin page. Each code works once: after that it belongs to this account only.
export async function POST(req: NextRequest) {
  try {
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Log in first' }, { status: 401 })
    // Limited per account and per device, so codes cannot be guessed by making lots of free accounts
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
    const [rl, rlIp] = await Promise.all([rateLimit(`redeem-code:${authed.userId}`, 10, 60000), rateLimit(`redeem-code-ip:${ip}`, 20, 10 * 60 * 1000)])
    if (!rl.allowed || !rlIp.allowed) return NextResponse.json({ error: 'Too many tries. Please wait a few minutes.' }, { status: 429 })

    const body = await req.json().catch(() => ({}))
    const code = cleanCreatorCode(body?.code)
    if (code.replace(/-/g, '').length < 3) return NextResponse.json({ kind: 'none' })

    const { data: row } = await admin.from('creator_access_codes').select('*').eq('code', code).eq('active', true).maybeSingle()
    if (!row) return NextResponse.json({ kind: 'none' })
    const planName = row.plan === 'top' ? 'Pro' : 'Basic'

    if (row.redeemed_by) {
      if (row.redeemed_by === authed.userId) return NextResponse.json({ kind: 'creator', already: true, plan: planName, until: row.ends_at })
      return NextResponse.json({ error: 'This code has already been used.' }, { status: 409 })
    }

    const { data: sub } = await admin.from('subscriptions').select('status, stripe_subscription_id').eq('user_id', authed.userId).maybeSingle()
    if (sub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(sub.status)) {
      return NextResponse.json({ error: 'This account already pays for Reelezy. Cancel your plan in Settings first, or contact us and we will sort it out.' }, { status: 409 })
    }

    const now = new Date()
    const ends = new Date(now)
    ends.setMonth(ends.getMonth() + row.months)

    // Claim the code. Only one account can win this, even if two people try at the same moment.
    const { data: claimed } = await admin.from('creator_access_codes')
      .update({ redeemed_by: authed.userId, redeemed_at: now.toISOString(), ends_at: ends.toISOString() })
      .eq('id', row.id).is('redeemed_by', null).select('id').maybeSingle()
    if (!claimed) return NextResponse.json({ error: 'This code has already been used.' }, { status: 409 })

    const { error: subErr } = await admin.from('subscriptions').upsert({
      user_id: authed.userId, plan: row.plan, status: 'active', paid: false,
      manual_until: ends.toISOString(), current_period_end: ends.toISOString(), creator_until: ends.toISOString(),
      stripe_subscription_id: null, deletion_scheduled_at: null, deletion_warning_sent: false,
    }, { onConflict: 'user_id' })
    if (subErr) {
      await admin.from('creator_access_codes').update({ redeemed_by: null, redeemed_at: null, ends_at: null }).eq('id', row.id)
      console.error('redeem-code subscription error:', subErr.message)
      return NextResponse.json({ error: 'That code could not be used right now. Try again.' }, { status: 500 })
    }

    // Start the weekly limits fresh, the same as when someone subscribes
    await admin.from('business_profiles')
      .update({ ideas_generated_this_week: 0, filming_generated_this_week: 0, scripts_generated_this_week: 0, usage_reset_at: now.toISOString() })
      .eq('user_id', authed.userId)

    return NextResponse.json({ kind: 'creator', plan: planName, until: ends.toISOString() })
  } catch (error) {
    console.error('redeem-code error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'That code could not be checked. Try again.' }, { status: 500 })
  }
}
