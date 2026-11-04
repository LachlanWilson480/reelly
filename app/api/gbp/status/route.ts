import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { supabaseAdmin } from '@/lib/platforms'
import { gbpEnabled, getConn, chooseLocation, listLocations, failure } from '@/lib/googleBusiness'

// Is Google Business Profile switched on, and is this person connected to it?
export async function GET(req: NextRequest) {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!gbpEnabled()) return NextResponse.json({ enabled: false, connected: false })
  const c = await getConn(authed.userId)
  if (!c) return NextResponse.json({ enabled: true, connected: false })
  let locations: { path: string; title: string }[] = []
  if (c.status === 'connected') { try { locations = await listLocations(c) } catch { /* the panel still works with the saved business */ } }
  return NextResponse.json({ enabled: true, connected: true, expired: c.status !== 'connected', business: c.account_name, location: c.account_id, locations })
}

// Pick which business to manage
export async function POST(req: NextRequest) {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { location } = await req.json().catch(() => ({}))
  const c = await getConn(authed.userId)
  if (!c || typeof location !== 'string') return NextResponse.json({ error: 'Not connected' }, { status: 400 })
  try { return NextResponse.json({ business: (await chooseLocation(c, location)).title }) }
  catch (e) { const f = failure(e); return NextResponse.json({ error: f.message }, { status: f.status }) }
}

export async function DELETE(req: NextRequest) {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await supabaseAdmin.from('social_connections').delete().eq('user_id', authed.userId).eq('platform', 'google_business')
  return NextResponse.json({ ok: true })
}
