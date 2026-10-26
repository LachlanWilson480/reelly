import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'node:crypto'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { MAX_REFERRAL_REWARDS } from '@/lib/referralReward'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const makeCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

// The signed-in user's referral link and how their referrals are going
export async function GET(req: NextRequest) {
  try {
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let { data: row } = await admin.from('referral_codes').select('code').eq('user_id', authed.userId).maybeSingle()
    for (let attempt = 0; !row && attempt < 5; attempt++) {
      const { data: inserted, error } = await admin.from('referral_codes').insert({ user_id: authed.userId, code: makeCode() }).select('code').maybeSingle()
      if (inserted) row = inserted
      else if (error && error.code !== '23505') throw error
      else {
        // Someone else's code matched, or this user's code was created at the same moment
        const { data: again } = await admin.from('referral_codes').select('code').eq('user_id', authed.userId).maybeSingle()
        if (again) row = again
      }
    }
    if (!row) return NextResponse.json({ error: 'Could not create your referral link' }, { status: 500 })

    const { data: mine } = await admin.from('referrals').select('status, reward_type').eq('referrer_id', authed.userId)
    const list = mine || []
    const monthsEarned = list.filter((r) => r.status === 'rewarded' && (r.reward_type === 'credit' || r.reward_type === 'free_month')).length

    return NextResponse.json({
      code: row.code,
      joined: list.length,
      subscribed: list.filter((r) => r.status === 'rewarded' || r.status === 'rewarding').length,
      monthsEarned,
      limit: MAX_REFERRAL_REWARDS,
    })
  } catch (error) {
    console.error('referral error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not load referrals' }, { status: 500 })
  }
}
