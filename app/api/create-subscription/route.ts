import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MONTHLY_PRICE_MAP: Record<string, string | undefined> = {
  basic: process.env.STRIPE_PRICE_BASIC,
  mid: process.env.STRIPE_PRICE_MID,
  top: process.env.STRIPE_PRICE_TOP,
}

const YEARLY_PRICE_MAP: Record<string, string | undefined> = {
  basic: process.env.STRIPE_PRICE_BASIC_YEARLY,
  mid: process.env.STRIPE_PRICE_MID_YEARLY,
  top: process.env.STRIPE_PRICE_TOP_YEARLY,
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 500 })
    }

    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = authed.userId

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const { email, plan, billingInterval, discountCode } = await req.json()
    const interval = billingInterval === 'yearly' ? 'yearly' : 'monthly'

    const priceId = interval === 'yearly' ? YEARLY_PRICE_MAP[plan] : MONTHLY_PRICE_MAP[plan]
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    let customerId = existingSub?.stripe_customer_id

    // Verify the existing customer belongs to this user before reusing
    if (customerId) {
      try {
        const existingCustomer = await stripe.customers.retrieve(customerId) as Stripe.Customer
        if (existingCustomer.deleted || existingCustomer.metadata?.userId !== userId) {
          customerId = undefined
        }
      } catch {
        customerId = undefined
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({ email, metadata: { userId } })
      customerId = customer.id
    }

    // Apply discount code if provided
    let couponId: string | undefined
    if (discountCode) {
      const { data: discountRow } = await supabaseAdmin
        .from('discount_codes')
        .select('*')
        .eq('code', discountCode.trim().toUpperCase())
        .eq('active', true)
        .maybeSingle()

      if (discountRow && (discountRow.max_uses === null || discountRow.uses < discountRow.max_uses)) {
        // Find or create a Stripe coupon for this percentage
        const couponName = `${discountRow.percent_off}OFF`
        const existingCoupons = await stripe.coupons.list({ limit: 100 })
        const existing = existingCoupons.data.find((c) => c.name === couponName && c.percent_off === discountRow.percent_off)
        if (existing) {
          couponId = existing.id
        } else {
          const newCoupon = await stripe.coupons.create({ percent_off: discountRow.percent_off, duration: 'once', name: couponName })
          couponId = newCoupon.id
        }
        // Increment uses
        await supabaseAdmin.from('discount_codes').update({ uses: discountRow.uses + 1 }).eq('id', discountRow.id)
      }
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.confirmation_secret', 'pending_setup_intent'],
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
    })

    await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        plan,
        status: subscription.status,
        billing_interval: interval,
      }, { onConflict: 'user_id' })

    // Reset weekly usage counters so the new plan's limits start fresh, rather than
    // carrying over usage from before the user subscribed.
    await supabaseAdmin
      .from('business_profiles')
      .update({
        ideas_generated_this_week: 0,
        filming_generated_this_week: 0,
        scripts_generated_this_week: 0,
        usage_reset_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    const subData = subscription as unknown as {
      pending_setup_intent?: { client_secret: string } | null
      latest_invoice?: { confirmation_secret?: { client_secret: string } } | null
    }

    const clientSecret =
      subData.pending_setup_intent?.client_secret ||
      subData.latest_invoice?.confirmation_secret?.client_secret

    if (!clientSecret) {
      console.error('No client secret found on subscription:', subscription.id)
      return NextResponse.json({ error: 'Could not initialize payment' }, { status: 500 })
    }

    return NextResponse.json({ clientSecret })
  } catch (error) {
    console.error('create-subscription error:', error)
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
  }
}
