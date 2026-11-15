// Server only. Talks to the Soundstripe music API with the key kept on the server.
// Docs: https://docs.soundstripe.com (JSON:API, "Authorization: Token <key>", 25 requests a second).

const BASE = 'https://api.soundstripe.com/v1'

export const soundstripeKey = () => (process.env.SOUNDSTRIPE_API_KEY || '').trim()
export const soundstripeOn = () => soundstripeKey().length > 0

export type MusicTrack = {
  id: string
  title: string
  artist: string
  duration: number
  bpm: number | null
  energy: string | null
  vocals: boolean
  url: string
  image: string | null
  source: 'soundstripe' | 'reelezy'
}

type Res = { id: string; type: string; attributes?: Record<string, unknown>; relationships?: Record<string, { data?: { id: string; type: string }[] | { id: string; type: string } | null }> }
type Doc = { data?: Res | Res[]; included?: Res[]; links?: { next?: string | null } }

async function call(path: string, params?: URLSearchParams): Promise<{ ok: boolean; status: number; doc: Doc | null }> {
  const url = `${BASE}${path}${params && [...params.keys()].length ? `?${params.toString()}` : ''}`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Token ${soundstripeKey()}`, Accept: 'application/vnd.api+json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return { ok: false, status: res.status, doc: null }
    return { ok: true, status: res.status, doc: (await res.json()) as Doc }
  } catch {
    return { ok: false, status: 0, doc: null }
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const relIds = (r: Res, name: string) => {
  const d = r.relationships?.[name]?.data
  return Array.isArray(d) ? d.map((x) => x.id) : d ? [d.id] : []
}

function toTrack(song: Res, included: Res[], prefer: 'mp3' | 'best'): MusicTrack | null {
  const byKey = new Map(included.map((r) => [`${r.type}:${r.id}`, r]))
  const audio = relIds(song, 'audio_files').map((id) => byKey.get(`audio_files:${id}`)).find(Boolean)
  const artist = relIds(song, 'artists').map((id) => byKey.get(`artists:${id}`)).find(Boolean)
  const versions = (audio?.attributes?.versions || {}) as Record<string, unknown>
  const mp3 = str(versions.mp3)
  const wav = str(versions.wav)
  const url = prefer === 'best' ? wav || mp3 : mp3
  if (!url) return null
  const a = song.attributes || {}
  return {
    id: String(song.id),
    title: str(a.title) || 'Untitled',
    artist: str(artist?.attributes?.name),
    duration: num(audio?.attributes?.duration) ?? 0,
    bpm: num(a.bpm),
    energy: str(a.energy) || null,
    vocals: audio?.attributes?.instrumental === false,
    url,
    image: str(artist?.attributes?.image) || null,
    source: 'soundstripe',
  }
}

export type MusicSearch = {
  q?: string; mood?: string; genre?: string; energy?: string
  vocals?: 'any' | 'instrumental' | 'vocals'
  maxLength?: number; page?: number
}

export async function searchSongs(s: MusicSearch): Promise<{ ok: boolean; status: number; tracks: MusicTrack[]; hasMore: boolean }> {
  const p = new URLSearchParams()
  if (s.q) p.set('filter[q]', s.q.slice(0, 200))
  if (s.mood) p.set('filter[tags][mood]', s.mood)
  if (s.genre) p.set('filter[tags][genre]', s.genre)
  if (s.energy && ['very_low', 'low', 'medium', 'high'].includes(s.energy)) p.set('filter[energy]', s.energy)
  if (s.vocals === 'instrumental') p.set('filter[instrumental]', 'true')
  if (s.vocals === 'vocals') p.set('filter[vocals]', 'true')
  if (s.maxLength && s.maxLength > 0) p.set('filter[duration][max]', String(Math.round(s.maxLength)))
  p.set('page[size]', '20')
  p.set('page[number]', String(Math.max(1, Math.min(500, Math.round(s.page || 1)))))
  const r = await call('/songs', p)
  if (!r.ok || !r.doc) return { ok: false, status: r.status, tracks: [], hasMore: false }
  const list = Array.isArray(r.doc.data) ? r.doc.data : []
  const inc = r.doc.included || []
  const tracks = list.map((song) => toTrack(song, inc, 'mp3')).filter((t): t is MusicTrack => !!t)
  return { ok: true, status: r.status, tracks, hasMore: !!r.doc.links?.next || list.length >= 20 }
}

// The file used for the finished video: full quality when the key allows it, fetched fresh so the link has not expired
export async function songForRender(id: string): Promise<MusicTrack | null> {
  if (!/^\d{1,12}$/.test(id)) return null
  const r = await call(`/songs/${id}`)
  if (!r.ok || !r.doc || !r.doc.data || Array.isArray(r.doc.data)) return null
  return toTrack(r.doc.data, r.doc.included || [], 'best')
}

// Mood and genre names for the filter chips. Cached for a day; falls back to a fixed list if the call fails.
let tagCache: { at: number; moods: string[]; genres: string[] } | null = null
export async function musicTags(): Promise<{ moods: string[]; genres: string[] }> {
  if (tagCache && Date.now() - tagCache.at < 86400000) return tagCache
  const get = async (category: string) => {
    const r = await call('/tags', new URLSearchParams({ 'filter[category]': category, 'page[size]': '100' }))
    const list = r.doc && Array.isArray(r.doc.data) ? r.doc.data : []
    return list
      .filter((t) => !t.attributes?.category || t.attributes.category === category)
      .map((t) => str(t.attributes?.name))
      .filter(Boolean)
  }
  const [moods, genres] = await Promise.all([get('mood'), get('genre')])
  if (moods.length || genres.length) tagCache = { at: Date.now(), moods, genres }
  return { moods, genres }
}
