import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { runCreatorStatements } from '@/lib/creatorCommission'

export const maxDuration = 300

// Runs once a month (see vercel.json): ends the 30 day hold on commission, makes payouts and emails statements
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Billing not configured' }, { status: 500 })
  try {
    const result = await runCreatorStatements(new Stripe(process.env.STRIPE_SECRET_KEY))
    return NextResponse.json(result)
  } catch (e) {
    console.error('creator-statements error:', e)
    return NextResponse.json({ error: 'Creator statements failed' }, { status: 500 })
  }
}
