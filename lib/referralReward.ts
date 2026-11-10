import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { CURRENCY_PRICES, REFERRAL_PERCENT_OFF, type Currency } from '@/lib/pricing'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Most months of referral discount one person can earn
export const MAX_REFERRAL_REWARDS = 12

// Reward types that count towards that limit. 'free_month' is from the earlier free-month offer.
const COUNTED = ['credit', 'free_month', 'discount_pending']

const planName = (plan: string) => (plan === 'top' ? 'Pro' : 'Basic')

type Granted = { type: 'credit' | 'discount_pending'; detail: string }

// 30% of one month of a live subscription, in the smallest unit of its currency (cents)
function monthlyDiscount(live: Stripe.Subscription): { amount: number; currency: string; label: string } {
  const price = live.items.data[0]?.price
  const unit = price?.unit_amount ?? 0
  const every = price?.recurring?.interval_count || 1
  const months = price?.recurring?.interval === 'year' ? 12 * every : every
  const amount = Math.round((unit / months) * REFERRAL_PERCENT_OFF / 100)
  const currency = live.currency || 'aud'
  const symbol = CURRENCY_PRICES[currency.toUpperCase() as Currency]?.symbol || ''
  return { amount, currency, label: `${symbol}${(amount / 100).toFixed(2)}` }
}

async function addCredit(stripe: Stripe, subscriptionId: string): Promise<string> {
  const live = await stripe.subscriptions.retrieve(subscriptionId)
  const { amount, currency, label } = monthlyDiscount(live)
  if (amount <= 0) throw new Error('No price found to discount')
  const customerId = typeof live.customer === 'string' ? live.customer : live.customer.id
  await stripe.customers.createBalanceTransaction(customerId, {
    amount: -amount,
    currency,
    description: `Referral reward: ${REFERRAL_PERCENT_OFF}% off one month`,
  })
  return label
}

// Gives the referrer 30% off their next month. If they already pay, it comes off their next bill.
// If they are on the Free plan, it is saved and applied once they subscribe.
async function grantDiscount(stripe: Stripe, referrerId: string): Promise<Granted> {
  const { data: row } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', referrerId)
    .maybeSingle()
  if (row?.stripe_subscription_id && (row.status === 'active' || row.status === 'trialing')) {
    const live = await stripe.subscriptions.retrieve(row.stripe_subscription_id)
    if (live.status === 'active' || live.status === 'trialing') {
      const label = await addCredit(stripe, row.stripe_subscription_id)
      return { type: 'credit', detail: `${REFERRAL_PERCENT_OFF}% off your next month (${label} off your next bill)` }
    }
  }
  return { type: 'discount_pending', detail: `${REFERRAL_PERCENT_OFF}% off your first month when you subscribe` }
}

// When someone with saved discounts subscribes, each saved discount becomes 30% off one of their next bills
async function settlePending(stripe: Stripe, userId: string, subscriptionId: string) {
  const { data: pending } = await admin.from('referrals').select('id').eq('referrer_id', userId).eq('reward_type', 'discount_pending')
  for (const r of pending || []) {
    const { data: claimed } = await admin.from('referrals').update({ reward_type: 'credit' }).eq('id', r.id).eq('reward_type', 'discount_pending').select('id').maybeSingle()
    if (!claimed) continue
    try {
      await addCredit(stripe, subscriptionId)
    } catch (err) {
      await admin.from('referrals').update({ reward_type: 'discount_pending' }).eq('id', r.id)
      throw err
    }
  }
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
      subject: `Your friend subscribed. You earned ${REFERRAL_PERCENT_OFF}% off`,
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
// The friend already got their 30% off on that first payment. The referrer gets 30% off their next month.
export async function rewardReferrerForInvoice(stripe: Stripe, invoice: Stripe.Invoice) {
  if (invoice.billing_reason !== 'subscription_create' || !invoice.amount_paid || invoice.amount_paid <= 0) return
  const subscriptionId = (invoice as unknown as { subscription?: string }).subscription
    || (invoice as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription
  if (!subscriptionId) return

  const { data: friendSub } = await admin.from('subscriptions').select('user_id, plan').eq('stripe_subscription_id', subscriptionId).maybeSingle()
  if (!friendSub) return

  // If this person earned discounts before they subscribed, they start now
  await settlePending(stripe, friendSub.user_id, subscriptionId)

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
      .in('reward_type', COUNTED)
    if ((count ?? 0) >= MAX_REFERRAL_REWARDS) {
      await admin.from('referrals').update({ status: 'rewarded', reward_type: 'capped', rewarded_at: new Date().toISOString() }).eq('id', claimed.id)
      return
    }

    const granted = await grantDiscount(stripe, claimed.referrer_id)
    await admin.from('referrals').update({ status: 'rewarded', reward_type: granted.type, rewarded_at: new Date().toISOString() }).eq('id', claimed.id)
    await emailReferrer(claimed.referrer_id, friendSub.plan, granted)
  } catch (err) {
    // Put it back so the next delivery of this event tries again
    await admin.from('referrals').update({ status: 'signed_up' }).eq('id', claimed.id)
    throw err
  }
}
