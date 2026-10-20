import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getAuthedUser } from '@/lib/getAuthedUser'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Asks Stripe for the real status of the signed-in user's subscription and saves it.
// Used right after checkout and on the settings page, so the plan shows as active even if Stripe's confirmation message is slow.
export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Billing not configured' }, { status: 500 })
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: row } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', authed.userId)
      .maybeSingle()
    if (!row?.stripe_subscription_id) return NextResponse.json({ status: null })

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id)

    const update: Record<string, unknown> = { status: subscription.status }
    const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
      || subscription.items?.data?.[0]?.current_period_end
    let periodEndIso: string | null = null
    if (typeof periodEnd === 'number' && !isNaN(periodEnd)) {
      periodEndIso = new Date(periodEnd * 1000).toISOString()
      update.current_period_end = periodEndIso
    }
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      update.deletion_scheduled_at = null
      update.deletion_warning_sent = false
    }
    await supabaseAdmin.from('subscriptions').update(update).eq('user_id', authed.userId)

    return NextResponse.json({ status: subscription.status, current_period_end: periodEndIso })
  } catch (error) {
    console.error('sync-subscription error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not check subscription' }, { status: 500 })
  }
}
