import { NextRequest, NextResponse } from 'next/server'
import { completeConnection, isConfigured, isPlatform, readState, siteOrigin } from '@/lib/platforms'

// The platform sends the person back here after they approve access
export async function GET(req: NextRequest, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params
  const back = (q: string) => NextResponse.redirect(`${siteOrigin()}/dashboard/scheduler?${q}`)
  if (!isPlatform(platform) || !isConfigured(platform)) return back('connect_error=unavailable')
  const sp = req.nextUrl.searchParams
  if (sp.get('error')) return back(`connect_error=denied&platform=${platform}`)
  const userId = readState(sp.get('state'), platform)
  const code = sp.get('code')
  if (!userId || !code) return back(`connect_error=invalid&platform=${platform}`)
  try {
    await completeConnection(platform, userId, code)
    return back(`connected=${platform}`)
  } catch (e) {
    console.error('social connect failed', platform, e instanceof Error ? e.message : 'unknown')
    return back(`connect_error=${encodeURIComponent((e instanceof Error ? e.message : 'failed').slice(0, 120))}&platform=${platform}`)
  }
}
