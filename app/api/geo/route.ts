import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Tells the pricing page which currency to show, based on where the visitor is (Vercel adds the country header)
export async function GET(req: NextRequest) {
  const country = (req.headers.get('x-vercel-ip-country') || '').toUpperCase()
  const currency = !country ? null : country === 'AU' ? 'AUD' : ['GB', 'GG', 'JE', 'IM'].includes(country) ? 'GBP' : 'USD'
  return NextResponse.json({ country: country || null, currency }, { headers: { 'Cache-Control': 'no-store' } })
}
