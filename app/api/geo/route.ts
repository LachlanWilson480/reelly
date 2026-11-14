import { NextRequest, NextResponse } from 'next/server'
import { tooMany, ipOf } from '@/lib/limit'
import { currencyForCountry, currencyForHost } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

// Tells the pricing page which currency to show, based on where the visitor is (Vercel adds the country header)
export async function GET(req: NextRequest) {
  { const limited = await tooMany('geo-ip:' + ipOf(req), 60, 60000); if (limited) return limited }
  const country = (req.headers.get('x-vercel-ip-country') || '').toUpperCase()
  return NextResponse.json({ country: country || null, currency: currencyForHost(req.headers.get('host')) ?? currencyForCountry(country) }, { headers: { 'Cache-Control': 'no-store' } })
}
