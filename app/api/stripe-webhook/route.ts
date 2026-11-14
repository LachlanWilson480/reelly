import { NextRequest, NextResponse } from 'next/server'
import { updateSubscription } from '@/lib/subscriptionWrite'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { rewardReferrerForInvoice } from '@/lib/referralReward'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DELETION_GRACE_DAYS = 60

const PLAN_BY_PRICE: Record<string, { plan: string; interval: 'monthly' | 'yearly' }> = {}
const addPrice = (id: string | undefined, plan: string, interval: 'monthly' | 'yearly') => { if (id) PLAN_BY_PRICE[id] = { plan, interval } }
addPrice(process.env.STRIPE_PRICE_BASIC, 'basic', 'monthly')
addPrice(process.env.STRIPE_PRICE_MID, 'mid', 'monthly')
addPrice(process.env.STRIPE_PRICE_TOP, 'top', 'monthly')
addPrice(process.env.STRIPE_PRICE_BASIC_YEARLY, 'basic', 'yearly')
addPrice(process.env.STRIPE_PRICE_MID_YEARLY, 'mid', 'yearly')
addPrice(process.env.STRIPE_PRICE_TOP_YEARLY, 'top', 'yearly')

// Updates the row for this Stripe subscription. If the row points at a different checkout attempt (the person
// opened checkout twice and paid the other one), it finds the person from the subscription and points the row at it.
async function updateForSubscription(sub: Stripe.Subscription, update: Record<string, unknown>) {
  const { data } = await updateSubscription(supabaseAdmin, 'stripe_subscription_id', sub.id, update)
  if (data && data.length > 0) return
  const userId = sub.metadata?.userId
  if (!userId || !(sub.status === 'active' || sub.status === 'trialing')) return
  const matched = PLAN_BY_PRICE[sub.items?.data?.[0]?.price?.id || '']
  await updateSubscription(supabaseAdmin, 'user_id', userId, {
    ...update,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    ...(matched ? { plan: matched.plan, billing_interval: matched.interval } : {}),
  })
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 500 })
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  try {
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const paidNow = subscription.status === 'active' || subscription.status === 'trialing'
      // Only a subscription that has really been paid for counts as paid. An unpaid attempt stays false.
      const updateData: Record<string, unknown> = { status: subscription.status, ...(paidNow ? {} : { paid: false }) }

      const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
        || subscription.items?.data?.[0]?.current_period_end

      let periodEndDate: Date | null = null
      if (typeof periodEnd === 'number' && !isNaN(periodEnd)) {
        periodEndDate = new Date(periodEnd * 1000)
        updateData.current_period_end = periodEndDate.toISOString()
      }

      if (subscription.status === 'active' || subscription.status === 'trialing') {
        // still active (or resubscribed) - cancel any pending deletion
        updateData.deletion_scheduled_at = null
        updateData.deletion_warning_sent = false
      } else if (periodEndDate && subscription.status !== 'incomplete' && subscription.status !== 'incomplete_expired' && subscription.metadata?.referral_reward !== 'true') {
        // canceled / unpaid / expired - schedule deletion 60 days after period end
        const deletionDate = new Date(periodEndDate.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000)
        updateData.deletion_scheduled_at = deletionDate.toISOString()
      }

      await updateForSubscription(subscription, updateData)
    }
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = (invoice as unknown as { subscription?: string }).subscription
        || (invoice as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription
      // A real payment (not a zero amount invoice) marks the subscription as paid
      const amountPaid = (invoice as unknown as { amount_paid?: number }).amount_paid ?? 0
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        await updateForSubscription(sub, {
          status: 'active', deletion_scheduled_at: null, deletion_warning_sent: false,
          ...(amountPaid > 0 || sub.status === 'active' ? { paid: true, paid_at: new Date().toISOString() } : {}),
        })
      }
      // Count a discount code as used once its first payment goes through
      try {
        if (subscriptionId && (invoice as unknown as { billing_reason?: string }).billing_reason === 'subscription_create') {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          const codeId = sub.metadata?.discount_code_id
          if (codeId) {
            const { data: row } = await supabaseAdmin.from('discount_codes').select('uses').eq('id', codeId).maybeSingle()
            if (row) await supabaseAdmin.from('discount_codes').update({ uses: (row.uses || 0) + 1 }).eq('id', codeId)
          }
        }
      } catch (e) { console.error('discount use count failed:', e) }
      // A friend's first real payment earns their referrer 30% off their next month
      await rewardReferrerForInvoice(stripe, invoice)
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('stripe-webhook error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}