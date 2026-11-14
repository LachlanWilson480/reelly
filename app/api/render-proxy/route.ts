import { rateLimit } from '@/lib/rateLimit'
import { tooMany } from '@/lib/limit'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const hostOf = (u: string | undefined) => { try { return u ? new URL(u).host : null } catch { return null } }
function isTrustedVideoUrl(raw: string): boolean {
  let u: URL
  try { u = new URL(raw) } catch { return false }
  if (u.protocol !== 'https:') return false
  const allowed = [hostOf(process.env.NEXT_PUBLIC_SUPABASE_URL), hostOf(process.env.RENDER_SERVER_URL), hostOf(process.env.RENDER_SERVER_PUBLIC_URL)].filter(Boolean)
  return allowed.includes(u.host) || u.host.endsWith('.up.railway.app')
}

export async function GET(req: NextRequest) {
  try {
    const renderId = req.nextUrl.searchParams.get('renderId')
    if (!renderId) return NextResponse.json({ error: 'Missing renderId' }, { status: 400 })

    // Auth check
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    { const limited = await tooMany('render-proxy:' + authed.userId, 60, 60000); if (limited) return limited }
    const userId = authed.userId

    const { data: renderRow } = await supabaseAdmin
      .from('renders')
      .select('output_url, status, user_id')
      .eq('id', renderId)
      .single()

    if (!renderRow || !renderRow.output_url) {
      return NextResponse.json({ error: 'Render not found' }, { status: 404 })
    }

    // Ensure the render belongs to the requesting user
    if (renderRow.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Only fetch from our own storage or render server, never any other address saved on the row
    if (!isTrustedVideoUrl(renderRow.output_url)) return NextResponse.json({ error: 'Render not found' }, { status: 404 })
    const videoRes = await fetch(renderRow.output_url, { redirect: 'error' })
    if (!videoRes.ok) return NextResponse.json({ error: 'Failed to fetch video' }, { status: 502 })

    const headers = new Headers()
    headers.set('Content-Type', 'video/mp4')
    headers.set('Accept-Ranges', 'bytes')
    const contentLength = videoRes.headers.get('content-length')
    if (contentLength) headers.set('Content-Length', contentLength)

    return new NextResponse(videoRes.body, { status: 200, headers })
  } catch (error) {
    console.error('render-proxy error:', error)
    return NextResponse.json({ error: 'Failed to proxy video' }, { status: 500 })
  }
}
