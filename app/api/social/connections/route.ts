import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { isConfigured, supabaseAdmin } from '@/lib/platforms'
import { PLATFORMS } from '@/lib/socialProfiles'

// Which accounts the person has connected, and which platforms can be connected at all (never returns tokens)
export async function GET(req: NextRequest) {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabaseAdmin.from('social_connections').select('platform, account_name, status').eq('user_id', authed.userId)
  return NextResponse.json({
    connections: data || [],
    available: PLATFORMS.filter((p) => isConfigured(p.id)).map((p) => p.id),
  })
}
