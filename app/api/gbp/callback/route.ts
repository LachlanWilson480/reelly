import { NextRequest, NextResponse } from 'next/server'
import { siteOrigin } from '@/lib/platforms'
import { gbpEnabled, readState, finishConnect, GbpError } from '@/lib/googleBusiness'

export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(`${siteOrigin()}/dashboard/scheduler?${q}`)
  if (!gbpEnabled()) return back('gbp_error=unavailable')
  const sp = req.nextUrl.searchParams
  if (sp.get('error')) return back('gbp_error=denied')
  const userId = readState(sp.get('state')); const code = sp.get('code')
  if (!userId || !code) return back('gbp_error=invalid')
  try { await finishConnect(userId, code); return back('gbp=connected') }
  catch (e) {
    console.error('gbp connect failed', e instanceof Error ? e.message : 'unknown')
    return back(`gbp_error=${encodeURIComponent(e instanceof GbpError ? e.message.slice(0, 120) : 'failed')}`)
  }
}
