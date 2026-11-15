import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { rateLimit } from '@/lib/rateLimit'
import { musicTags, searchSongs, soundstripeOn, type MusicTrack } from '@/lib/soundstripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// The few tracks Reelezy hosts itself. Used when no Soundstripe key is set, so the library still works.
const LIB = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/music-library`
const OWN_TRACKS: MusicTrack[] = [
  { id: 'track-2', title: 'Chill Lo-fi', artist: 'Relaxed', duration: 0, bpm: null, energy: 'low', vocals: false, url: `${LIB}/chill-lofi.mp3`, image: null, source: 'reelezy' },
  { id: 'track-3', title: 'Cinematic Build', artist: 'Dramatic', duration: 0, bpm: null, energy: 'medium', vocals: false, url: `${LIB}/cinematic.mp3`, image: null, source: 'reelezy' },
  { id: 'track-4', title: 'Trending Pop', artist: 'Fun', duration: 0, bpm: null, energy: 'high', vocals: false, url: `${LIB}/trending-pop.mp3`, image: null, source: 'reelezy' },
  { id: 'track-1', title: 'Upbeat Piano', artist: 'Energetic', duration: 0, bpm: null, energy: 'high', vocals: false, url: `${LIB}/upbeat-corporate.mp3`, image: null, source: 'reelezy' },
]

const TERMS_KEY = 'soundstripe_terms_accepted_at'

export async function GET(req: NextRequest) {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = await rateLimit(`music:${authed.userId}`, 120, 60000)
  if (!rl.allowed) return NextResponse.json({ error: 'Too many searches. Please wait a moment.' }, { status: 429 })

  const sp = req.nextUrl.searchParams
  const on = soundstripeOn()

  if (sp.get('info') === '1') {
    let accepted = false
    if (on) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(authed.userId)
      accepted = !!data.user?.app_metadata?.[TERMS_KEY]
    }
    const tags = on ? await musicTags() : { moods: [], genres: [] }
    return NextResponse.json({ configured: on, accepted, ...tags })
  }

  if (!on) {
    const q = (sp.get('q') || '').toLowerCase().trim()
    const tracks = OWN_TRACKS.filter((t) => !q || `${t.title} ${t.artist}`.toLowerCase().includes(q))
    return NextResponse.json({ configured: false, tracks, hasMore: false })
  }

  const vocals = sp.get('vocals')
  const r = await searchSongs({
    q: sp.get('q') || undefined,
    mood: sp.get('mood') || undefined,
    genre: sp.get('genre') || undefined,
    energy: sp.get('energy') || undefined,
    vocals: vocals === 'instrumental' || vocals === 'vocals' ? vocals : 'any',
    maxLength: Number(sp.get('max')) || undefined,
    page: Number(sp.get('page')) || 1,
  })
  if (!r.ok) {
    const why = r.status === 401 || r.status === 403 ? 'The music library is not set up properly yet.' : r.status === 429 ? 'The music library is busy. Please try again in a moment.' : 'Could not load music right now. Please try again.'
    return NextResponse.json({ configured: true, error: why, tracks: [], hasMore: false }, { status: 502 })
  }
  return NextResponse.json({ configured: true, tracks: r.tracks, hasMore: r.hasMore })
}

// Records that this person agreed to Soundstripe's Terms of Use, which the Soundstripe API terms require
export async function POST(req: NextRequest) {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (body?.accept !== true) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })
  const { data } = await supabaseAdmin.auth.admin.getUserById(authed.userId)
  const meta = data.user?.app_metadata || {}
  const { error } = await supabaseAdmin.auth.admin.updateUserById(authed.userId, { app_metadata: { ...meta, [TERMS_KEY]: new Date().toISOString() } })
  if (error) return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
