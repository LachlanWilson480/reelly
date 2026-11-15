'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/components/Icon'
import { authFetch } from '@/lib/authFetch'

export type PickedTrack = { id: string; title: string; artist: string; url: string; source: 'soundstripe' | 'reelezy' }

type Track = PickedTrack & { duration: number; bpm: number | null; energy: string | null; vocals: boolean; image: string | null }
type Info = { configured: boolean; accepted: boolean; moods: string[]; genres: string[] }

const TERMS_URL = 'https://www.soundstripe.com/end-user-license-agreement'
// Used as search words when the mood list could not be loaded
const FALLBACK_MOODS = ['Happy', 'Uplifting', 'Chill', 'Energetic', 'Inspiring', 'Dramatic', 'Calm', 'Playful', 'Romantic', 'Confident']
// Moods shown first when the full list is long, so the chips most useful for short business videos lead
const LEAD_MOODS = ['happy', 'uplifting', 'energetic', 'chill', 'inspiring', 'confident', 'playful', 'calm', 'dramatic', 'romantic', 'hopeful', 'dreamy']

const fmt = (s: number) => (s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '')
const orderMoods = (list: string[]) => {
  const rank = (m: string) => { const i = LEAD_MOODS.indexOf(m.toLowerCase()); return i < 0 ? 99 : i }
  return [...list].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

const chip = (on: boolean) => ({
  flex: '0 0 auto', fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap' as const,
  border: `1px solid ${on ? 'var(--coral)' : 'var(--line)'}`, background: on ? 'var(--coral)' : 'transparent', color: on ? '#fff' : 'var(--ink)',
})

export default function MusicLibrary({ onClose, onPick, chosenId }: { onClose: () => void; onPick: (t: PickedTrack) => void; chosenId?: string | null }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [infoError, setInfoError] = useState('')
  const [agreeing, setAgreeing] = useState(false)
  const [q, setQ] = useState('')
  const [typed, setTyped] = useState('')
  const [mood, setMood] = useState('')
  const [genre, setGenre] = useState('')
  const [vocals, setVocals] = useState<'any' | 'instrumental' | 'vocals'>('any')
  const [tracks, setTracks] = useState<Track[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const runRef = useRef(0)

  const stop = useCallback(() => { audioRef.current?.pause(); setPlaying(null); setProgress(0) }, [])
  const close = useCallback(() => { stop(); onClose() }, [stop, onClose])

  // Stop the preview when the library closes
  useEffect(() => () => { audioRef.current?.pause() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const res = await authFetch('/api/music?info=1')
        const d = await res.json()
        if (!live) return
        if (!res.ok) { setInfoError(d.error || 'Could not open the music library. Please try again.'); return }
        setInfo({ configured: !!d.configured, accepted: !!d.accepted, moods: orderMoods(d.moods || []), genres: [...(d.genres || [])].sort((a: string, b: string) => a.localeCompare(b)) })
      } catch {
        if (live) setInfoError('Could not open the music library. Check your connection and try again.')
      }
    })()
    return () => { live = false }
  }, [])

  // Wait for typing to pause before searching
  useEffect(() => { const t = setTimeout(() => setQ(typed.trim()), 400); return () => clearTimeout(t) }, [typed])

  const moodsFromApi = !!info && info.moods.length > 0
  const ready = !!info && (!info.configured || info.accepted)

  const load = useCallback(async (pageNo: number) => {
    const run = ++runRef.current
    setLoading(true)
    setError('')
    const p = new URLSearchParams()
    const words = [q, !moodsFromApi && mood ? mood : ''].filter(Boolean).join(' ')
    if (words) p.set('q', words)
    if (moodsFromApi && mood) p.set('mood', mood)
    if (genre) p.set('genre', genre)
    if (vocals !== 'any') p.set('vocals', vocals)
    p.set('page', String(pageNo))
    try {
      const res = await authFetch(`/api/music?${p.toString()}`)
      const d = await res.json()
      if (run !== runRef.current) return
      if (!res.ok) { setError(d.error || 'Could not load music right now. Please try again.'); if (pageNo === 1) setTracks([]); setHasMore(false); return }
      const list: Track[] = d.tracks || []
      setTracks((prev) => {
        if (pageNo === 1) return list
        const seen = new Set(prev.map((t) => t.id))
        return [...prev, ...list.filter((t) => !seen.has(t.id))]
      })
      setHasMore(!!d.hasMore && list.length > 0)
      setPage(pageNo)
    } catch {
      if (run === runRef.current) setError('Could not load music. Check your connection and try again.')
    } finally {
      if (run === runRef.current) setLoading(false)
    }
  }, [q, mood, genre, vocals, moodsFromApi])

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => { stop(); void load(1) }, 0)
    return () => clearTimeout(t)
  }, [ready, load, stop])

  const agree = async () => {
    setAgreeing(true)
    try {
      const res = await authFetch('/api/music', { method: 'POST', body: JSON.stringify({ accept: true }) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setInfoError(d.error || 'Could not save that. Please try again.'); return }
      setInfo((i) => (i ? { ...i, accepted: true } : i))
    } catch {
      setInfoError('Could not save that. Check your connection and try again.')
    } finally {
      setAgreeing(false)
    }
  }

  const toggle = (t: Track) => {
    if (playing === t.id) { stop(); return }
    audioRef.current?.pause()
    const a = new Audio(t.url)
    a.ontimeupdate = () => { if (a.duration > 0 && Number.isFinite(a.duration)) setProgress(a.currentTime / a.duration) }
    a.onended = () => { setPlaying(null); setProgress(0) }
    a.onerror = () => { setPlaying(null); setError('That preview would not play. Please try another track.') }
    audioRef.current = a
    setProgress(0)
    setPlaying(t.id)
    void a.play().catch(() => setPlaying(null))
  }

  const use = (t: Track) => { stop(); onPick({ id: t.id, title: t.title, artist: t.artist, url: t.url, source: t.source }); onClose() }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Music library" onClick={close} className="rly-ml-back" style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <style>{`
        .rly-ml-chips::-webkit-scrollbar{display:none}
        @media (max-width:640px){
          .rly-ml-back{padding:0 !important;align-items:stretch !important}
          .rly-ml-box{max-width:none !important;max-height:none !important;height:100% !important;border-radius:0 !important}
        }
      `}</style>
      <div className="rly-ml-box" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg, #fff)', color: 'var(--ink)', borderRadius: 4, width: '100%', maxWidth: 600, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Music library</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {info?.configured ? 'Thousands of licensed tracks, cleared for your business videos.' : 'Licensed tracks for your videos.'}
              </p>
            </div>
            <button type="button" onClick={close} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: 6 }}><Icon n="close" /></button>
          </div>
          {ready && (
            <>
              <input
                type="search" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Search music"
                placeholder={info?.configured ? 'Search by song, artist, mood or style' : 'Search tracks'}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 16, padding: '10px 12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg, #fff)', color: 'var(--ink)' }}
              />
              {info?.configured && (
                <>
                  <div className="rly-ml-chips" role="group" aria-label="Mood" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -18px', padding: '0 18px' }}>
                    <button type="button" onClick={() => setMood('')} aria-pressed={!mood} style={chip(!mood)}>All moods</button>
                    {(moodsFromApi ? info.moods : FALLBACK_MOODS).map((m) => (
                      <button key={m} type="button" onClick={() => setMood(mood === m ? '' : m)} aria-pressed={mood === m} style={chip(mood === m)}>{m}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {info.genres.length > 0 && (
                      <select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre" style={{ fontSize: 13, padding: '7px 10px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg, #fff)', color: 'var(--ink)', maxWidth: '50%' }}>
                        <option value="">All genres</option>
                        {info.genres.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    )}
                    <div role="group" aria-label="Vocals" style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                      {([['any', 'Any'], ['instrumental', 'No vocals'], ['vocals', 'With vocals']] as const).map(([v, label]) => (
                        <button key={v} type="button" onClick={() => setVocals(v)} aria-pressed={vocals === v} style={{ fontSize: 12, fontWeight: 600, padding: '7px 10px', border: 'none', cursor: 'pointer', background: vocals === v ? 'var(--ink)' : 'transparent', color: vocals === v ? 'var(--card-bg, #fff)' : 'var(--ink)' }}>{label}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div style={{ padding: '10px 18px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {infoError ? (
            <p role="alert" style={{ fontSize: 13, color: '#d92d20', margin: '8px 0' }}>{infoError}</p>
          ) : !info ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0', display: 'flex', alignItems: 'center' }}><span className="rly-spinner rly-spinner-coral" />Opening the music library...</p>
          ) : !ready ? (
            <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
                The music in Reelezy comes from Soundstripe. Every track is licensed for your videos, including business and promotional posts on TikTok, Instagram, Facebook and YouTube.
              </p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--text-muted)' }}>
                To use it, please agree to <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--coral)' }}>Soundstripe&apos;s Terms of Use</a>. You can only use the music inside videos you make with Reelezy.
              </p>
              <button type="button" onClick={() => void agree()} disabled={agreeing} style={{ alignSelf: 'flex-start', background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: agreeing ? 'wait' : 'pointer', opacity: agreeing ? 0.7 : 1 }}>
                {agreeing ? 'Saving...' : 'I agree, show me the music'}
              </button>
            </div>
          ) : (
            <>
              {tracks.map((t) => {
                const on = playing === t.id
                const meta = [t.artist, fmt(t.duration), t.bpm ? `${Math.round(t.bpm)} BPM` : '', t.vocals ? 'Vocals' : ''].filter(Boolean).join(' · ')
                return (
                  <div key={t.id} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${chosenId === t.id ? 'var(--coral)' : 'var(--line)'}`, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                    <button type="button" onClick={() => toggle(t)} aria-label={on ? `Pause ${t.title}` : `Play ${t.title}`} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {on ? <Icon n="pause" /> : <Icon n="play" />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                      {meta && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</p>}
                    </div>
                    <button type="button" onClick={() => use(t)} style={{ flexShrink: 0, background: chosenId === t.id ? 'var(--coral)' : 'none', color: chosenId === t.id ? '#fff' : 'var(--ink)', border: `1px solid ${chosenId === t.id ? 'var(--coral)' : 'var(--line)'}`, borderRadius: 4, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {chosenId === t.id ? 'In use' : 'Use this track'}
                    </button>
                    {on && <span aria-hidden style={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: `${progress * 100}%`, background: 'var(--coral)' }} />}
                  </div>
                )
              })}
              {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0', display: 'flex', alignItems: 'center' }}><span className="rly-spinner rly-spinner-coral" />Finding music...</p>}
              {!loading && !error && tracks.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0' }}>No tracks match that. Try other words or fewer filters.</p>}
              {error && <p role="alert" style={{ fontSize: 12, color: '#d92d20', margin: '6px 0' }}>{error}</p>}
              {!loading && hasMore && (
                <button type="button" onClick={() => void load(page + 1)} style={{ alignSelf: 'center', marginTop: 4, background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}>Show more</button>
              )}
            </>
          )}
        </div>

        {ready && info?.configured && (
          <p style={{ margin: 0, padding: '10px 18px', borderTop: '1px solid var(--line)', fontSize: 11, color: 'var(--text-muted)' }}>
            Music by Soundstripe. Use is covered by <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>Soundstripe&apos;s Terms of Use</a>.
          </p>
        )}
      </div>
    </div>,
    document.body
  )
}
