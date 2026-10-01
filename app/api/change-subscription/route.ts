import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PRICE_MAP: Record<string, string | undefined> = {
  basic: process.env.STRIPE_PRICE_BASIC,
  mid: process.env.STRIPE_PRICE_MID,
  top: process.env.STRIPE_PRICE_TOP,
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 500 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = authed.userId

    const { newPlan } = await req.json()

    if (!newPlan) {
      return NextResponse.json({ error: 'Missing newPlan' }, { status: 400 })
    }

    const newPriceId = PRICE_MAP[newPlan]
    if (!newPriceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const { data: subRow } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, plan, status')
      .eq('user_id', userId)
      .maybeSingle()

    if (!subRow || !subRow.stripe_subscription_id || subRow.status !== 'active') {
      return NextResponse.json({ error: 'No active subscription found to change. Please subscribe first.' }, { status: 400 })
    }

    if (subRow.plan === newPlan) {
      return NextResponse.json({ error: 'You are already on this plan.' }, { status: 400 })
    }

    if (subRow.plan === 'top' || newPlan === 'top') {
      return NextResponse.json(
        { error: 'Unable to change plan directly. Please visit the Plans page.' },
        { status: 400 }
      )
    }

    const stripeSub = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id)
    const currentItemId = stripeSub.items.data[0]?.id
    if (!currentItemId) {
      return NextResponse.json({ error: 'Could not find subscription item to update.' }, { status: 500 })
    }

    if (stripeSub.status !== 'active' && stripeSub.status !== 'trialing') {
      // Supabase and Stripe are out of sync - the real subscription was never confirmed with payment.
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: stripeSub.status })
        .eq('user_id', userId)
      return NextResponse.json(
        { error: 'Your subscription was never fully confirmed with a payment method. Please subscribe again from the Plans page.' },
        { status: 400 }
      )
    }

    // Swap the price with no proration credit/charge, and reset the billing cycle to start now,
    // then separately invoice the customer immediately for the new plan's full flat price -
    // so an upgrade or downgrade always costs the new plan's full rate, never a prorated amount.
    const updatedSub = await stripe.subscriptions.update(subRow.stripe_subscription_id, {
      items: [{ id: currentItemId, price: newPriceId }],
      proration_behavior: 'none',
      billing_cycle_anchor: 'now',
    })

    const newPriceObj = await stripe.prices.retrieve(newPriceId)
    const customerId = typeof updatedSub.customer === 'string' ? updatedSub.customer : updatedSub.customer.id

    await stripe.invoiceItems.create({
      customer: customerId,
      amount: newPriceObj.unit_amount || 0,
      currency: newPriceObj.currency,
      description: `Plan change to ${newPlan}`,
    })

    const invoice = await stripe.invoices.create({
      customer: customerId,
      auto_advance: true,
      collection_method: 'charge_automatically',
    })

    if (invoice.id) {
      await stripe.invoices.finalizeInvoice(invoice.id)
      await stripe.invoices.pay(invoice.id)
    }

    await supabaseAdmin
      .from('subscriptions')
      .update({ plan: newPlan, status: updatedSub.status })
      .eq('user_id', userId)

    // Reset weekly usage counters so the new plan's limits start fresh.
    await supabaseAdmin
      .from('business_profiles')
      .update({
        ideas_generated_this_week: 0,
        filming_generated_this_week: 0,
        scripts_generated_this_week: 0,
        usage_reset_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    return NextResponse.json({ success: true, plan: newPlan, status: updatedSub.status })
  } catch (error) {
    console.error('change-subscription error:', error)
    return NextResponse.json({ error: 'Failed to change subscription' }, { status: 500 })
  }
}
