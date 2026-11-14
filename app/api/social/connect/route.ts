import { NextRequest, NextResponse } from 'next/server'
import { tooMany } from '@/lib/limit'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { authorizeUrl, isConfigured, isPlatform, makeState } from '@/lib/platforms'

// Returns the address of the platform's own sign-in page for this person
export async function POST(req: NextRequest) {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  { const limited = await tooMany('social/connect:' + authed.userId, 10, 600000); if (limited) return limited }
  const { platform } = await req.json().catch(() => ({}))
  if (!isPlatform(platform)) return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
  if (!isConfigured(platform)) return NextResponse.json({ error: 'This connection is not switched on yet' }, { status: 503 })
  return NextResponse.json({ url: authorizeUrl(platform, makeState(authed.userId, platform)) })
}
