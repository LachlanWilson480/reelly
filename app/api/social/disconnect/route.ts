import { NextRequest, NextResponse } from 'next/server'
import { tooMany } from '@/lib/limit'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { isPlatform, supabaseAdmin } from '@/lib/platforms'

export async function POST(req: NextRequest) {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  { const limited = await tooMany('social/disconnect:' + authed.userId, 10, 600000); if (limited) return limited }
  const { platform } = await req.json().catch(() => ({}))
  if (!isPlatform(platform)) return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
  await supabaseAdmin.from('social_connections').delete().eq('user_id', authed.userId).eq('platform', platform)
  return NextResponse.json({ ok: true })
}
