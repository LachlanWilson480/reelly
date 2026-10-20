import { NextRequest, NextResponse } from 'next/server'
import { currencyForCountry } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

// Tells the pricing page which currency to show, based on where the visitor is (Vercel adds the country header)
export async function GET(req: NextRequest) {
  const country = (req.headers.get('x-vercel-ip-country') || '').toUpperCase()
  return NextResponse.json({ country: country || null, currency: currencyForCountry(country) }, { headers: { 'Cache-Control': 'no-store' } })
}
