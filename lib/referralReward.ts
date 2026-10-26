import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { CURRENCY_PRICES, currencyForCountry, type Currency } from '@/lib/pricing'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Most free months one person can earn from referrals
export const MAX_REFERRAL_REWARDS = 12

const MONTHLY_PRICE: Record<string, string | undefined> = {
  basic: process.env.STRIPE_PRICE_BASIC,
  mid: process.env.STRIPE_PRICE_MID,
  top: process.env.STRIPE_PRICE_TOP,
}

const planName = (plan: string) => (plan === 'top' ? 'Pro' : 'Basic')

async function freeMonthCoupon(stripe: Stripe): Promise<string> {
  const id = 'REELEZY_REFERRAL_FREE_MONTH'
  try {
    await stripe.coupons.retrieve(id)
  } catch {
    try {
      await stripe.coupons.create({ id, percent_off: 100, duration: 'once', name: 'Referral reward: 1 month free' })
    } catch {
      // created by another request at the same moment
    }
  }
  return id
}

type Granted = { type: 'credit' | 'free_month'; detail: string }

// Gives the referrer one month of the plan their friend bought:
// money off their next bill if they pay already, or a free month of that plan if they are on the Free plan.
async function grantFreeMonth(stripe: Stripe, referrerId: string, plan: string): Promise<Granted> {
  const { data: row } = await admin
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id, status')
    .eq('user_id', referrerId)
    .maybeSingle()
  const name = planName(plan)

  if (row?.stripe_subscription_id && (row.status === 'active' || row.status === 'trialing')) {
    const live = await stripe.subscriptions.retrieve(row.stripe_subscription_id)
    if (live.status === 'active' || live.status === 'trialing') {
      const currencyKey = (live.currency || 'aud').toUpperCase() as Currency
      const cp = CURRENCY_PRICES[currencyKey] ?? CURRENCY_PRICES.AUD
      const price = plan === 'top' ? cp.pro : cp.basic
      const customerId = typeof live.customer === 'string' ? live.customer : live.customer.id
      await stripe.customers.createBalanceTransaction(customerId, {
        amount: -Math.round(price * 100),
        currency: live.currency || 'aud',
        description: `Referral reward: 1 month of ${name} free`,
      })
      return { type: 'credit', detail: `${cp.symbol}${price.toFixed(2)} off your next bill` }
    }
  }

  const priceId = MONTHLY_PRICE[plan] || MONTHLY_PRICE.mid
  if (!priceId) throw new Error(`No Stripe price configured for plan ${plan}`)

  const { data: authUser } = await admin.auth.admin.getUserById(referrerId)
  const email = authUser?.user?.email
  const { data: profile } = await admin.from('business_profiles').select('country').eq('user_id', referrerId).maybeSingle()
  let currency = (currencyForCountry(profile?.country) ?? 'AUD').toLowerCase()

  let customerId = row?.stripe_customer_id || undefined
  if (customerId) {
    try {
      const existing = (await stripe.customers.retrieve(customerId)) as Stripe.Customer
      if (existing.deleted || existing.metadata?.userId !== referrerId) customerId = undefined
      else if (existing.currency) currency = existing.currency
    } catch {
      customerId = undefined
    }
  }
  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId: referrerId } })
    customerId = customer.id
  }

  const coupon = await freeMonthCoupon(stripe)
  const sub = await stripe.subscriptions.create({
    customer: customerId,
    currency,
    items: [{ price: priceId }],
    discounts: [{ coupon }],
    cancel_at_period_end: true,
    metadata: { referral_reward: 'true', userId: referrerId },
  })

  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end || sub.items?.data?.[0]?.current_period_end
  await admin.from('subscriptions').upsert({
    user_id: referrerId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    plan,
    status: sub.status,
    billing_interval: 'monthly',
    current_period_end: typeof periodEnd === 'number' ? new Date(periodEnd * 1000).toISOString() : null,
    deletion_scheduled_at: null,
    deletion_warning_sent: false,
  }, { onConflict: 'user_id' })

  return { type: 'free_month', detail: `a free month of ${name}` }
}

async function emailReferrer(referrerId: string, plan: string, granted: Granted) {
  try {
    if (!process.env.RESEND_API_KEY) return
    const { data: authUser } = await admin.auth.admin.getUserById(referrerId)
    const email = authUser?.user?.email
    if (!email) return
    const { data: profile } = await admin.from('business_profiles').select('business_name').eq('user_id', referrerId).maybeSingle()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.reelezy.com'
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Reelezy <noreply@reelezy.com>',
      to: email,
      subject: 'Your friend subscribed. You earned a free month',
      html: `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #2C2C2A;">Thanks for spreading the word, ${profile?.business_name || 'there'}!</h2>
        <p style="color: #555;">A friend you referred just subscribed to ${planName(plan)}. As a thank you, you've got ${granted.detail}.</p>
        <a href="${siteUrl}/refer" style="display: inline-block; background: #FF6A4D; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Refer another friend</a>
      </div>`,
    })
  } catch (err) {
    console.error('referral email failed:', err instanceof Error ? err.message : 'Unknown error')
  }
}

// Called when an invoice is paid. Only the friend's first real payment counts, and each friend rewards their referrer once.
export async function rewardReferrerForInvoice(stripe: Stripe, invoice: Stripe.Invoice) {
  if (invoice.billing_reason !== 'subscription_create' || !invoice.amount_paid || invoice.amount_paid <= 0) return
  const subscriptionId = (invoice as unknown as { subscription?: string }).subscription
    || (invoice as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription
  if (!subscriptionId) return

  const { data: friendSub } = await admin.from('subscriptions').select('user_id, plan').eq('stripe_subscription_id', subscriptionId).maybeSingle()
  if (!friendSub) return

  // Claim it first, so two webhook deliveries can never reward twice
  const { data: claimed } = await admin
    .from('referrals')
    .update({ status: 'rewarding', plan_bought: friendSub.plan })
    .eq('referred_id', friendSub.user_id)
    .eq('status', 'signed_up')
    .select('id, referrer_id')
    .maybeSingle()
  if (!claimed) return

  try {
    if (claimed.referrer_id === friendSub.user_id) {
      await admin.from('referrals').update({ status: 'rewarded', reward_type: 'void', rewarded_at: new Date().toISOString() }).eq('id', claimed.id)
      return
    }
    const { count } = await admin
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', claimed.referrer_id)
      .eq('status', 'rewarded')
      .in('reward_type', ['credit', 'free_month'])
    if ((count ?? 0) >= MAX_REFERRAL_REWARDS) {
      await admin.from('referrals').update({ status: 'rewarded', reward_type: 'capped', rewarded_at: new Date().toISOString() }).eq('id', claimed.id)
      return
    }

    const granted = await grantFreeMonth(stripe, claimed.referrer_id, friendSub.plan)
    await admin.from('referrals').update({ status: 'rewarded', reward_type: granted.type, rewarded_at: new Date().toISOString() }).eq('id', claimed.id)
    await emailReferrer(claimed.referrer_id, friendSub.plan, granted)
  } catch (err) {
    // Put it back so the next delivery of this event tries again
    await admin.from('referrals').update({ status: 'signed_up' }).eq('id', claimed.id)
    throw err
  }
}
