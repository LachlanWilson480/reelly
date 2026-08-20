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
    const { userId, email, plan } = await req.json()

    const priceId = PRICE_MAP[plan]
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    let customerId = existingSub?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({ email, metadata: { userId } })
      customerId = customer.id
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.confirmation_secret', 'pending_setup_intent'],
    })

    await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        plan,
        status: subscription.status,
      }, { onConflict: 'user_id' })

    const subData = subscription as unknown as {
      pending_setup_intent?: { client_secret: string } | null
      latest_invoice?: { confirmation_secret?: { client_secret: string } } | null
    }

    const clientSecret =
      subData.pending_setup_intent?.client_secret ||
      subData.latest_invoice?.confirmation_secret?.client_secret

    if (!clientSecret) {
      console.error('No client secret found on subscription:', JSON.stringify(subscription, null, 2))
      return NextResponse.json({ error: 'Could not initialize payment' }, { status: 500 })
    }

    return NextResponse.json({ clientSecret })
  } catch (error) {
    console.error('create-subscription error:', error)
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
  }
}
