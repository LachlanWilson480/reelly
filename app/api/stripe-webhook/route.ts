import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DELETION_GRACE_DAYS = 60

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
      const updateData: Record<string, unknown> = { status: subscription.status }

      const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
        || subscription.items?.data?.[0]?.current_period_end

      let periodEndDate: Date | null = null
      if (typeof periodEnd === 'number' && !isNaN(periodEnd)) {
        periodEndDate = new Date(periodEnd * 1000)
        updateData.current_period_end = periodEndDate.toISOString()
      }

      if (subscription.status === 'active' || subscription.status === 'trialing') {
        // still active (or resubscribed) — cancel any pending deletion
        updateData.deletion_scheduled_at = null
        updateData.deletion_warning_sent = false
      } else if (periodEndDate) {
        // canceled / unpaid / expired — schedule deletion 60 days after period end
        const deletionDate = new Date(periodEndDate.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000)
        updateData.deletion_scheduled_at = deletionDate.toISOString()
      }

      await supabaseAdmin
        .from('subscriptions')
        .update(updateData)
        .eq('stripe_subscription_id', subscription.id)
    }
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = (invoice as unknown as { subscription?: string }).subscription
        || (invoice as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription
      if (subscriptionId) {
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'active', deletion_scheduled_at: null, deletion_warning_sent: false })
          .eq('stripe_subscription_id', subscriptionId)
      }
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('stripe-webhook error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}