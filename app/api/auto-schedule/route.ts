import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { rateLimit } from '@/lib/rateLimit'
import { supabaseAdmin } from '@/lib/platforms'
import { cleanString } from '@/lib/cleanText'
import { parseTikTokOptions } from '@/lib/tiktok'

// Time zones for countries that have one. Others use the time zone of the person's own device.
const COUNTRY_TZ: Record<string, string> = { NZ: 'Pacific/Auckland', UK: 'Europe/London', IE: 'Europe/Dublin', ZA: 'Africa/Johannesburg', SG: 'Asia/Singapore' }
const validTz = (tz: unknown): tz is string => { if (typeof tz !== 'string' || tz.length > 60) return false; try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true } catch { return false } }

// Local wall clock time in a zone to a real moment
function zoned(tz: string, y: number, m: number, d: number, h: number, min: number): Date {
  let t = Date.UTC(y, m, d, h, min)
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(t)).map((x) => [x.type, +x.value]))
    t += Date.UTC(y, m, d, h, min) - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  }
  return new Date(t)
}
const dayKey = (tz: string, d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d)

// Good evening and weekend slots for small local businesses, one post per day, at least a few hours away
function pickTime(tz: string, taken: Set<string>): Date {
  const now = Date.now()
  const today = new Date()
  for (let i = 0; i < 21; i++) {
    const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i, 12))
    const local = new Date(base.toLocaleString('en-US', { timeZone: tz }))
    const dow = local.getDay()
    const [h, min] = dow === 6 ? [10, 0] : dow === 0 ? [18, 0] : [18, 30]
    const at = zoned(tz, local.getFullYear(), local.getMonth(), local.getDate(), h, min)
    if (at.getTime() < now + 3 * 3600_000) continue
    if (taken.has(dayKey(tz, at))) continue
    return at
  }
  return new Date(now + 24 * 3600_000)
}

export async function POST(req: NextRequest) {
  try {
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rl = await rateLimit(`autosched:${authed.userId}`, 20, 60_000)
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    const { renderId, timezone, caption: customCaption, platforms: wanted, force, tiktok } = await req.json().catch(() => ({}))
    if (typeof renderId !== 'string' || !renderId) return NextResponse.json({ error: 'Missing video' }, { status: 400 })

    const { data: render } = await supabaseAdmin.from('renders').select('id, title, caption, tags, output_url, status').eq('id', renderId).eq('user_id', authed.userId).maybeSingle()
    if (!render || !render.output_url) return NextResponse.json({ error: 'Video not found' }, { status: 404 })

    const { data: existing } = await supabaseAdmin.from('scheduled_posts').select('idea_id, scheduled_for, status').eq('user_id', authed.userId).neq('status', 'cancelled')
    // The finished-video popup asks only once per video. The Publish page can schedule the same video again.
    if (!force && (existing || []).some((p) => p.idea_id === renderId)) return NextResponse.json({ ok: true, already: true })

    const { data: conns } = await supabaseAdmin.from('social_connections').select('platform').eq('user_id', authed.userId).eq('status', 'connected').neq('platform', 'google_business')
    const connectedNow = (conns || []).map((c) => c.platform as string)
    // TikTok needs the person's own choices (who can view and so on), so it is only included when they were sent
    const tiktokOptions = parseTikTokOptions(tiktok)
    const platforms = (Array.isArray(wanted) ? connectedNow.filter((p) => wanted.includes(p)) : connectedNow).filter((p) => p !== 'tiktok' || tiktokOptions)
    if (platforms.length === 0) return NextResponse.json({ error: connectedNow.length > 0 ? 'tiktok_needs_settings' : 'no_accounts' }, { status: 409 })

    const { data: profile } = await supabaseAdmin.from('business_profiles').select('country').eq('user_id', authed.userId).maybeSingle()
    const tz = COUNTRY_TZ[profile?.country as string] || (validTz(timezone) ? timezone : 'Australia/Sydney')
    const taken = new Set((existing || []).map((p) => dayKey(tz, new Date(p.scheduled_for))))
    const when = pickTime(tz, taken)

    const caption = (typeof customCaption === 'string' ? customCaption.slice(0, 4000) : [render.caption, render.tags].filter(Boolean).join('\n')) || null
    const { data: created, error } = await supabaseAdmin.from('scheduled_posts').insert({ user_id: authed.userId, idea_id: render.id, title: cleanString(render.title || 'Untitled video'), caption, tags: null, video_url: render.output_url, scheduled_for: when.toISOString(), platforms, status: 'scheduled', tiktok_options: platforms.includes('tiktok') ? tiktokOptions : null }).select('id, scheduled_for').single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, id: created.id, scheduledFor: created.scheduled_for })
  } catch (e) {
    console.error('auto-schedule error:', e instanceof Error ? e.message : JSON.stringify(e))
    return NextResponse.json({ error: 'Could not schedule' }, { status: 500 })
  }
}
