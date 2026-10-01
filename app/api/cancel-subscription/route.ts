import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 500 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    

    const { data: subRow } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', userId)
      .maybeSingle()

    if (!subRow || !subRow.stripe_subscription_id || subRow.status !== 'active') {
      return NextResponse.json({ error: 'No active subscription found to cancel.' }, { status: 400 })
    }

    // Cancel at period end rather than immediately, so the user keeps access they've already paid for.
    const updatedSub = await stripe.subscriptions.update(subRow.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    return NextResponse.json({ success: true, cancelAtPeriodEnd: updatedSub.cancel_at_period_end })
  } catch (error) {
    console.error('cancel-subscription error:', error)
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
