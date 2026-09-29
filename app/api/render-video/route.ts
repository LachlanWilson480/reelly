import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASIC_CAP_MIN = 10
const PRO_CAP_MIN = 25
const PREMIUM_CAP_MIN = 60

async function getPlan(userId: string | undefined): Promise<'free' | 'basic' | 'mid' | 'top'> {
  if (!userId) return 'free'
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data || data.status !== 'active') return 'free'
  if (data.plan === 'basic') return 'basic'
  if (data.plan === 'top') return 'top'
  return 'mid'
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()

    if (userId) {
      const plan = await getPlan(userId)
      if (plan === 'free') {
        return NextResponse.json(
          { error: 'Upgrade to render videos' },
          { status: 403 }
        )
      }
    }

    const { data: renderRow, error: dbError } = await supabaseAdmin
      .from('renders')
      .insert({
        user_id: userId,
        status: 'queued',
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to save render' }, { status: 500 })
    }

    return NextResponse.json({ renderId: renderRow.id })
  } catch (error) {
    console.error('render-video error:', error)
    return NextResponse.json({ error: 'Failed to start render' }, { status: 500 })
  }
}
