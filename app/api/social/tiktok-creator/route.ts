import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { rateLimit } from '@/lib/rateLimit'
import { supabaseAdmin, getTikTokCreator, type Conn } from '@/lib/platforms'

// The connected TikTok account's name, picture and what it is allowed to post right now (never returns tokens)
export async function GET(req: NextRequest) {
  try {
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rl = await rateLimit(`ttcreator:${authed.userId}`, 30, 60_000)
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    const { data: conn } = await supabaseAdmin.from('social_connections').select('*').eq('user_id', authed.userId).eq('platform', 'tiktok').eq('status', 'connected').maybeSingle()
    if (!conn) return NextResponse.json({ error: 'TikTok is not connected' }, { status: 404 })
    return NextResponse.json({ creator: await getTikTokCreator(conn as Conn) })
  } catch (e) {
    console.error('tiktok-creator error:', e instanceof Error ? e.message : 'unknown')
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load your TikTok account' }, { status: 502 })
  }
}
