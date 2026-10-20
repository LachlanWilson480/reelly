import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getAuthedUser } from '@/lib/getAuthedUser'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLAN_BY_PRICE: Record<string, { plan: string; interval: 'monthly' | 'yearly' }> = {}
const addPrice = (id: string | undefined, plan: string, interval: 'monthly' | 'yearly') => { if (id) PLAN_BY_PRICE[id] = { plan, interval } }
addPrice(process.env.STRIPE_PRICE_BASIC, 'basic', 'monthly')
addPrice(process.env.STRIPE_PRICE_MID, 'mid', 'monthly')
addPrice(process.env.STRIPE_PRICE_TOP, 'top', 'monthly')
addPrice(process.env.STRIPE_PRICE_BASIC_YEARLY, 'basic', 'yearly')
addPrice(process.env.STRIPE_PRICE_MID_YEARLY, 'mid', 'yearly')
addPrice(process.env.STRIPE_PRICE_TOP_YEARLY, 'top', 'yearly')

// Asks Stripe for the real state of the signed-in user's subscription and saves it.
// If the user started checkout more than once, it finds the one that was actually paid and uses that.
export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Billing not configured' }, { status: 500 })
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: row } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('user_id', authed.userId)
      .maybeSingle()

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const customerIds = new Set<string>()
    if (row?.stripe_customer_id) customerIds.add(row.stripe_customer_id)
    try {
      const found = await stripe.customers.search({ query: `metadata['userId']:'${authed.userId}'`, limit: 10 })
      found.data.forEach((c) => customerIds.add(c.id))
    } catch {}

    const subs: Stripe.Subscription[] = []
    for (const customer of customerIds) {
      const list = await stripe.subscriptions.list({ customer, status: 'all', limit: 10 })
      subs.push(...list.data)
    }
    if (row?.stripe_subscription_id && !subs.some((s) => s.id === row.stripe_subscription_id)) {
      try { subs.push(await stripe.subscriptions.retrieve(row.stripe_subscription_id)) } catch {}
    }
    if (subs.length === 0) return NextResponse.json({ status: null })

    const newestFirst = [...subs].sort((a, b) => b.created - a.created)
    const subscription = newestFirst.find((s) => s.status === 'active' || s.status === 'trialing') ?? newestFirst[0]

    const update: Record<string, unknown> = {
      stripe_subscription_id: subscription.id,
      stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
      status: subscription.status,
    }
    const matched = PLAN_BY_PRICE[subscription.items?.data?.[0]?.price?.id || '']
    if (matched) { update.plan = matched.plan; update.billing_interval = matched.interval }

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
