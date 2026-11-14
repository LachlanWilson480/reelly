import { rateLimit } from '@/lib/rateLimit'
import { upsertSubscription } from '@/lib/subscriptionWrite'
import { tooMany } from '@/lib/limit'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { currencyForCountry, currencyForHost, REFERRAL_PERCENT_OFF } from '@/lib/pricing'

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
    { const limited = await tooMany('create-subscription:' + authed.userId, 10, 600000); if (limited) return limited }
    const userId = authed.userId

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const { email, plan, billingInterval, discountCode } = await req.json()
    if (plan !== 'basic' && plan !== 'mid' && plan !== 'top') return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 })
    const interval = billingInterval === 'yearly' ? 'yearly' : 'monthly'

    const priceId = interval === 'yearly' ? YEARLY_PRICE_MAP[plan] : MONTHLY_PRICE_MAP[plan]
    if (!priceId) {
      const suffix = interval === 'yearly' ? '_YEARLY' : ''
      const varName = `STRIPE_PRICE_${String(plan).toUpperCase() === 'MID' ? 'MID' : String(plan).toUpperCase()}${suffix}`
      console.error(`create-subscription: no Stripe price configured for plan "${plan}" (${interval}). Check the ${varName} environment variable.`)
      return NextResponse.json({ error: `This plan isn't available for ${interval} billing right now. Try the other billing option or contact support.` }, { status: 400 })
    }

    // Charge in the currency for the account's country (from onboarding), or the visitor's location if there is none
    const { data: profileRow } = await supabaseAdmin.from('business_profiles').select('country').eq('user_id', userId).maybeSingle()
    const currency = (currencyForHost(req.headers.get('host')) ?? currencyForCountry(profileRow?.country) ?? currencyForCountry(req.headers.get('x-vercel-ip-country')) ?? 'AUD').toLowerCase()

    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, status')
      .eq('user_id', userId)
      .maybeSingle()

    // Someone who already pays must change plan instead. Starting a second checkout would overwrite their paid
    // subscription here (cutting their access) while Stripe keeps billing it, and paying again would charge them twice.
    if (existingSub?.stripe_subscription_id && (existingSub.status === 'active' || existingSub.status === 'trialing')) {
      try {
        const live = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id)
        if (live.status === 'active' || live.status === 'trialing') {
          return NextResponse.json({ error: 'You already have a subscription. To switch plans, use Change plan in Settings.', alreadySubscribed: true }, { status: 409 })
        }
      } catch {}
    }

    let customerId = existingSub?.stripe_customer_id

    // Verify the existing customer belongs to this user before reusing
    if (customerId) {
      try {
        const existingCustomer = await stripe.customers.retrieve(customerId) as Stripe.Customer
        if (existingCustomer.deleted || existingCustomer.metadata?.userId !== userId || (existingCustomer.currency && existingCustomer.currency !== currency)) {
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

    // Starting again (for example after changing plan) leaves an unpaid attempt behind, so close those first
    try {
      const stale = await stripe.subscriptions.list({ customer: customerId, status: 'incomplete', limit: 10 })
      for (const s of stale.data) await stripe.subscriptions.cancel(s.id)
    } catch {}

    // Discount: a discount code, or 30% off for a friend who joined with a referral code. Only the bigger one applies.
    let couponId: string | undefined
    let referralPercent = 0
    try {
      const { data: refRow } = await supabaseAdmin.from('referrals').select('status').eq('referred_id', userId).maybeSingle()
      if (refRow && refRow.status === 'signed_up') referralPercent = REFERRAL_PERCENT_OFF
    } catch {}

    const couponForPercent = async (percent: number) => {
      const couponName = `${percent}OFF`
      // Only reuse a coupon that is still valid and has no limits, so an old dashboard coupon with the same name cannot break checkout
      const existingCoupons = await stripe.coupons.list({ limit: 100 })
      const existing = existingCoupons.data.find((c) => c.name === couponName && c.percent_off === percent && c.valid && c.duration === 'once' && !c.redeem_by && !c.max_redemptions && !c.applies_to)
      if (existing) return existing.id
      const created = await stripe.coupons.create({ percent_off: percent, duration: 'once', name: couponName })
      return created.id
    }

    let codePercent = 0
    let codeRow: { id: string; uses: number; percent_off: number } | null = null
    if (discountCode) {
      const { data: discountRow } = await supabaseAdmin
        .from('discount_codes')
        .select('*')
        .eq('code', discountCode.trim().toUpperCase())
        .eq('active', true)
        .maybeSingle()
      if (discountRow && (discountRow.max_uses === null || discountRow.uses < discountRow.max_uses) && (!discountRow.expires_at || new Date(discountRow.expires_at) > new Date())) {
        codePercent = Number(discountRow.percent_off)
        codeRow = discountRow
      }
    }
    if (referralPercent > 0 && referralPercent >= codePercent) {
      couponId = await couponForPercent(referralPercent)
    } else if (codeRow) {
      couponId = await couponForPercent(codePercent)
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      currency,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      // Lets the Stripe webhook find the right person even if they opened checkout more than once
      metadata: { userId, plan, billing_interval: interval },
      expand: ['latest_invoice.confirmation_secret', 'pending_setup_intent'],
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      // The code is counted as used once the payment goes through (see the Stripe webhook), not each time checkout opens
      ...(codeRow && couponId && !(referralPercent > 0 && referralPercent >= codePercent) ? { metadata: { userId, plan, billing_interval: interval, discount_code_id: String(codeRow.id) } } : {}),
    })

    await upsertSubscription(supabaseAdmin, {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        plan,
        status: subscription.status,
        billing_interval: interval,
        // An unpaid checkout attempt until the Stripe webhook confirms the payment
        paid: false,
      })

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
