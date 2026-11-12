'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import { type ScheduledPost } from '@/components/PublisherPanel'
import { PLATFORMS, type PlatformId } from '@/lib/socialProfiles'
import { cleanString } from '@/lib/cleanText'
import { buttonPrimary, buttonSecondary, inputCompact } from '@/lib/ui'
import Icon from '@/components/Icon'
import CollapsibleBox from '@/components/CollapsibleBox'
import Dropdown from '@/components/Dropdown'
import DatePicker from '@/components/DatePicker'
import TikTokSettings from '@/components/TikTokSettings'
import GoogleBusinessPanel from '@/components/GoogleBusinessPanel'
import { emptyTikTok, tiktokProblem, type TikTokOptions } from '@/lib/tiktok'

// Switched off for launch while the platforms approve our apps. Set to true to bring them back.
const SHOW_ACCOUNTS = false
// The calendar of scheduled posts stays hidden until scheduling is switched on
const SHOW_CALENDAR = false
// The Schedule button on each finished video stays hidden until scheduling is switched on
const SHOW_SCHEDULING = false

type Render = { id: string; output_url: string | null; created_at: string; title?: string | null; caption?: string | null; tags?: string | null; idea_id?: string | null; source?: string | null }
type Carousel = { id: string; image_paths: string[]; caption: string | null; created_at: string }
type Conn = { platform: PlatformId; account_name: string | null; status: string }

const label = (id: string) => PLATFORMS.find((p) => p.id === id)?.label || id
const STATUS: Record<string, string> = { scheduled: 'Scheduled', posting: 'Posting now', posted: 'Posted', partial: 'Partly posted', failed: 'Failed', cancelled: 'Cancelled', needs_connection: 'Not posted' }
const bad = (s: string) => s === 'failed' || s === 'needs_connection' || s === 'partial'

async function fetchQueue(): Promise<ScheduledPost[]> {
  try { const r = await authFetch('/api/scheduled-posts'); return r.ok ? (await r.json()).posts || [] : [] } catch { return [] }
}
async function fetchConnections(): Promise<{ connections: Conn[]; available: PlatformId[] }> {
  try { const r = await authFetch('/api/social/connections'); return r.ok ? await r.json() : { connections: [], available: [] } } catch { return { connections: [], available: [] } }
}

const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
const pad = (n: number) => String(n).padStart(2, '0')
const dayValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4), m = (i % 4) * 15
  return { value: `${pad(h)}:${pad(m)}`, label: `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}` }
})
const small = { fontSize: 12, color: 'var(--text-muted)', margin: 0 } as const
const heading = { fontSize: 18, fontWeight: 600, margin: 0 } as const
const chip = (on: boolean) => ({ padding: '8px 14px', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: on ? '1px solid var(--coral)' : '1px solid var(--line)', background: on ? 'rgba(255,106,77,0.08)' : '#fff', color: on ? 'var(--coral)' : 'var(--ink)' })

const CopyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>
)
const TickIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)

const PUBLISH_CSS = `
.pub-card { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 14px; border: 1px solid var(--line); border-radius: 4px; padding: 14px; background: #fff; }
.pub-thumb { width: 96px; height: 170px; object-fit: cover; background: #000; border-radius: 2px; display: block; }
.pub-info { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.pub-row { display: flex; gap: 10px; align-items: flex-start; }
.pub-text { flex: 1; min-width: 0; margin: 0; }
.pub-title { font-size: 14px; font-weight: 600; margin: 0 0 4px; line-height: 1.35; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.pub-desc { font-size: 12px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 96px; overflow-y: auto; }
.pub-copy { flex-shrink: 0; width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: 4px; background: #fff; color: var(--ink); cursor: pointer; padding: 0; }
.pub-copy:disabled { opacity: 0.4; cursor: default; }
.pub-actions { grid-column: 1 / -1; display: flex; gap: 10px; flex-wrap: wrap; }
.pub-dl { display: inline-flex; align-items: center; gap: 6px; background: var(--coral); color: #fff; border: none; border-radius: 4px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
.pub-field { width: 100%; box-sizing: border-box; border: 1px solid var(--line); border-radius: 4px; padding: 8px 10px; font: inherit; color: var(--ink); background: #fff; }
.pub-field:focus { outline: none; border-color: var(--coral); }
.pub-label { font-size: 11px; font-weight: 600; color: var(--text-muted); margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.04em; }
.pub-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.pub-tag { display: inline-flex; align-items: center; gap: 4px; background: rgba(255,106,77,0.08); color: var(--coral); border: 1px solid rgba(255,106,77,0.3); border-radius: 999px; padding: 3px 4px 3px 10px; font-size: 12px; font-weight: 600; }
.pub-tag button { background: none; border: none; color: inherit; cursor: pointer; padding: 0 4px; font-size: 14px; line-height: 1; }
.pub-tag-input { flex: 1; min-width: 120px; border: 1px dashed var(--line); border-radius: 999px; padding: 4px 10px; font: inherit; font-size: 12px; }
.pub-tag-input:focus { outline: none; border-color: var(--coral); }
.pub-dl:disabled { opacity: 0.6; cursor: default; }
@media (max-width: 640px) {
  .pub-card { grid-template-columns: 72px minmax(0, 1fr); gap: 12px; padding: 12px; }
  .pub-thumb { width: 72px; height: 128px; }
  .pub-copy { width: 44px; height: 44px; }
  .pub-dl { min-height: 40px; }
}
`

export default function SchedulerTab({ userId, carousels, isFree = false }: { userId: string | null; carousels: Carousel[]; isFree?: boolean }) {
  const [renders, setRenders] = useState<Render[]>([])
  const [loading, setLoading] = useState(true)
  const [queue, setQueue] = useState<ScheduledPost[]>([])
  const [conns, setConns] = useState<Conn[]>([])
  const [available, setAvailable] = useState<PlatformId[]>([])
  const [week, setWeek] = useState(() => startOfWeek(new Date()))
  // Where the scheduling form is open: under a video, or under the calendar for a chosen day
  const [plan, setPlan] = useState<{ from: 'video' | 'calendar'; renderId: string; day: string } | null>(null)
  const [openPost, setOpenPost] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [notice, setNotice] = useState(() => {
    if (typeof window === 'undefined') return ''
    const q = new URLSearchParams(window.location.search)
    if (q.get('connected')) return `${label(q.get('connected')!)} connected.`
    if (q.get('connect_error')) return q.get('connect_error') === 'denied' ? 'Connection cancelled.' : `Could not connect ${q.get('platform') ? label(q.get('platform')!) : 'that account'}. ${q.get('connect_error') === 'unavailable' ? 'This connection is not switched on yet.' : q.get('connect_error') || ''}`.trim()
    return ''
  })
  const [copied, setCopied] = useState<string | null>(null)
  const [now] = useState(() => Date.now())

  const reloadQueue = () => { fetchQueue().then(setQueue) }
  const reloadConns = () => { fetchConnections().then((r) => { setConns(r.connections); setAvailable(r.available) }) }

  useEffect(() => {
    if (!userId) return
    fetchQueue().then(setQueue)
    fetchConnections().then((r) => { setConns(r.connections); setAvailable(r.available) })
    const q = (cols: string) => supabase.from('renders').select(cols).eq('user_id', userId).eq('status', 'done').order('created_at', { ascending: false })
    q('id, output_url, created_at, title, caption, tags, idea_id, source').then(async (res) => {
      // Older databases have no `source` column yet, so fall back to the original columns
      const out = res.error ? await q('id, output_url, created_at, title, caption, tags, idea_id') : res
      setRenders(((out.data as unknown as Render[]) || []).filter((r) => r.output_url))
      setLoading(false)
    })
  }, [userId])

  const connected = conns.filter((c) => c.status === 'connected').map((c) => c.platform)

  const connect = async (platform: PlatformId) => {
    setNotice('')
    const res = await authFetch('/api/social/connect', { method: 'POST', body: JSON.stringify({ platform }) })
    const j = await res.json().catch(() => ({}))
    if (j.url) window.location.assign(j.url)
    else setNotice(j.error || 'Could not start the connection. Please try again.')
  }
  const disconnect = async (platform: PlatformId) => {
    await authFetch('/api/social/disconnect', { method: 'POST', body: JSON.stringify({ platform }) })
    reloadConns()
  }
  const deletePost = async (id: string) => {
    setDeleteError('')
    const res = await authFetch('/api/delete-scheduled-post', { method: 'POST', body: JSON.stringify({ postId: id }) })
    if (res.ok) { setQueue((q) => q.filter((p) => p.id !== id)); setConfirmDelete(null); setOpenPost((o) => (o === id ? null : o)) }
    else { const e = await res.json().catch(() => ({})); setDeleteError(e.error || 'Could not delete the post. Please try again.'); setConfirmDelete(null) }
  }
  const [downloading, setDownloading] = useState<string | null>(null)
  // Saves the video to the device. Only web addresses are fetched; if the browser blocks the save, the video opens in a new tab instead.
  const download = async (url: string, id: string, title?: string | null) => {
    if (!/^https:\/\//i.test(url)) return
    setDownloading(id)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('download failed')
      const blob = await res.blob()
      const name = (cleanString(title || '').replace(/[^\w\s-]/g, '').trim().slice(0, 60) || 'reelezy-video').replace(/\s+/g, '-')
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = href; a.download = `${name}.mp4`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(href), 10_000)
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
    setDownloading(null)
  }
  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text) } catch {
      // Older browsers: fall back to selecting a hidden box
      try { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t) } catch { return }
    }
    setCopied(key); setTimeout(() => setCopied(null), 2000)
  }
  // After scheduling: refresh, jump the calendar to that week and open the new post
  const scheduled = (msg: string, post?: { id: string; scheduledFor: string }) => {
    setPlan(null); setNotice(msg)
    fetchQueue().then((q) => {
      setQueue(q)
      if (post) { setWeek(startOfWeek(new Date(post.scheduledFor))); setConfirmDelete(null); setOpenPost(post.id); setTimeout(() => document.getElementById('pub-week')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80) }
    })
  }

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week])
  const live = queue.filter((p) => p.status !== 'cancelled')
  const postsOn = (d: Date) => live.filter((p) => new Date(p.scheduled_for).toDateString() === d.toDateString())
  const todayStr = new Date().toDateString()
  const weekLabel = `${days[0].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} to ${days[6].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
  const stuck = live.filter((p) => bad(p.status))

  const kindOf = (r: Render): 'script' | 'idea' | 'other' => {
    if (r.source === 'script' || r.idea_id?.startsWith('script-')) return 'script'
    if (r.source === 'idea') return 'idea'
    if (r.source === 'upload') return 'other'
    return r.title ? 'idea' : 'other'
  }
  const groups = [
    { key: 'idea', title: 'Generated idea videos', noun: 'video', items: renders.filter((r) => kindOf(r) === 'idea') },
    { key: 'script', title: 'Script generated videos', noun: 'video', items: renders.filter((r) => kindOf(r) === 'script') },
    { key: 'reels', title: 'Image reels', noun: 'reel', items: [] as Render[] },
    { key: 'other', title: 'Other videos', noun: 'video', items: renders.filter((r) => kindOf(r) === 'other') },
  ].map((g) => ({ ...g, count: g.key === 'reels' ? carousels.length : g.items.length })).filter((g) => g.count > 0)

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><span className="rly-spinner rly-spinner-coral" /></div>

  const openDetail = (id: string) => { setPlan(null); setConfirmDelete(null); setOpenPost(id); setTimeout(() => document.getElementById('post-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>
      <style>{PUBLISH_CSS}</style>
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px' }}>Publish</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Your finished videos, ready to download and post.</p>
      </div>

      {notice && <p role="status" style={{ fontSize: 13, background: 'var(--sand)', border: '1px solid var(--line)', borderRadius: 4, padding: '10px 14px', margin: 0 }}>{notice}</p>}

      {/* Accounts */}
      {SHOW_ACCOUNTS && <section aria-labelledby="pub-accounts" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 id="pub-accounts" style={heading}>Your accounts</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          {PLATFORMS.map((p) => {
            const c = conns.find((x) => x.platform === p.id)
            const isOn = c?.status === 'connected'
            const can = available.includes(p.id)
            return (
              <div key={p.id} style={{ border: '1px solid var(--line)', borderRadius: 4, padding: 14, background: '#fff', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{p.label}</p>
                <p style={{ ...small, minHeight: 32 }}>
                  {isOn ? `Connected${c?.account_name ? ` as ${c.account_name}` : ''}` : c?.status === 'expired' ? 'Connection expired. Reconnect to keep posting.' : can ? 'Not connected' : 'Coming soon'}
                </p>
                {isOn ? (
                  <button type="button" onClick={() => disconnect(p.id)} style={{ ...buttonSecondary, padding: '8px 14px', fontSize: 13 }}>Disconnect</button>
                ) : (
                  <button type="button" disabled={!can || isFree} onClick={() => connect(p.id)} style={{ ...buttonPrimary, padding: '8px 14px', fontSize: 13, opacity: can && !isFree ? 1 : 0.45, cursor: can && !isFree ? 'pointer' : 'not-allowed' }}>{c?.status === 'expired' ? 'Reconnect' : 'Connect'}</button>
                )}
                {p.id === 'instagram' && !isOn && (
                  <p style={{ ...small, fontSize: 12, lineHeight: 1.45 }}>Instagram only lets apps post to Business or Creator accounts, not personal ones. It&apos;s free to switch: Instagram Settings, then Account type and tools.</p>
                )}
              </div>
            )
          })}
        </div>
        {isFree && <p style={small}><a href="/plans" style={{ color: 'var(--coral)', fontWeight: 600 }}>Upgrade</a> to connect accounts and schedule posts.</p>}
      </section>}

      {SHOW_ACCOUNTS && <GoogleBusinessPanel isFree={isFree} />}

      {/* Calendar */}
      {SHOW_CALENDAR && <section aria-labelledby="pub-week" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h3 id="pub-week" style={{ ...heading, flex: 1 }}>Your calendar</h3>
          <button type="button" aria-label="Previous week" onClick={() => setWeek((w) => addDays(w, -7))} style={{ ...buttonSecondary, padding: '8px 10px' }}><Icon n="back" /></button>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 130, textAlign: 'center' }}>{weekLabel}</span>
          <button type="button" aria-label="Next week" onClick={() => setWeek((w) => addDays(w, 7))} style={{ ...buttonSecondary, padding: '8px 10px' }}><Icon n="forward" /></button>
        </div>
        {stuck.length > 0 && (
          <p style={{ fontSize: 13, margin: 0, color: '#D92D20' }}>
            {stuck.length === 1 ? '1 post needs attention.' : `${stuck.length} posts need attention.`}{' '}
            <button type="button" onClick={() => { setWeek(startOfWeek(new Date(stuck[0].scheduled_for))); openDetail(stuck[0].id) }} style={{ background: 'none', border: 'none', color: '#D92D20', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}>See details</button>
          </p>
        )}
        <div className="pub-week">
          {days.map((d) => {
            const here = postsOn(d)
            const past = d.getTime() < startOfWeek(new Date()).getTime() || (d.toDateString() !== todayStr && d.getTime() < now)
            return (
              <div key={d.toISOString()} className="pub-day" style={{ background: d.toDateString() === todayStr ? 'rgba(255,106,77,0.04)' : '#fff' }}>
                <div className="pub-day-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: d.toDateString() === todayStr ? 'var(--coral)' : 'var(--text-secondary)' }}>{d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' })}</span>
                  {!past && !isFree && renders.length > 0 && (
                    <button type="button" aria-label={`Schedule a video on ${d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}`} onClick={() => { setOpenPost(null); setPlan({ from: 'calendar', renderId: renders[0].id, day: dayValue(d) }) }} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 4, width: 24, height: 24, cursor: 'pointer', fontSize: 14, lineHeight: 1, color: 'var(--text-secondary)' }}>+</button>
                  )}
                </div>
                {here.map((p) => (
                  <button key={p.id} type="button" onClick={() => openDetail(p.id)} title={p.title} aria-label={`${p.title}, ${fmtTime(p.scheduled_for)}. Open details`} style={{ font: 'inherit', textAlign: 'left', cursor: 'pointer', fontSize: 11, lineHeight: 1.3, fontWeight: 600, borderRadius: 2, padding: '6px 7px', background: p.status === 'posted' ? '#1E8E4E' : bad(p.status) ? '#fff' : 'var(--coral)', color: p.status === 'posted' ? '#fff' : bad(p.status) ? '#D92D20' : '#fff', border: bad(p.status) ? '1px solid #D92D20' : '1px solid transparent', outline: openPost === p.id ? '2px solid var(--ink)' : 'none', outlineOffset: 1, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                    <span style={{ fontWeight: 500, opacity: 0.9 }}>{fmtTime(p.scheduled_for)}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
        <p style={small}>Orange is scheduled, green is posted, red outline needs attention. Click a post to see it.</p>

        {deleteError && <p role="alert" style={{ fontSize: 13, color: '#D92D20', margin: 0 }}>{deleteError}</p>}
        {(() => {
          const p = live.find((x) => x.id === openPost)
          if (!p) return null
          return (
            <div id="post-detail" role="region" aria-label="Post details" style={{ border: '1px solid var(--line)', borderRadius: 4, background: 'var(--sand)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{p.title}</p>
                  <p style={{ ...small, marginTop: 4 }}>{new Date(p.scheduled_for).toLocaleString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} · <strong style={{ color: bad(p.status) ? '#D92D20' : 'var(--text-secondary)' }}>{STATUS[p.status] || p.status}</strong></p>
                </div>
                <button type="button" aria-label="Close details" onClick={() => { setOpenPost(null); setConfirmDelete(null) }} style={{ ...buttonSecondary, padding: '6px 9px' }}><Icon n="close" /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: p.video_url ? '84px 1fr' : '1fr', gap: 14 }}>
                {p.video_url && <video src={p.video_url} muted playsInline preload="metadata" style={{ width: 84, height: 120, objectFit: 'cover', background: '#000', borderRadius: 2 }} />}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                  <div>
                    {p.platforms.map((x) => {
                      const r = p.results?.[x]
                      return (
                        <p key={x} style={{ fontSize: 12, margin: '0 0 2px', color: r?.status === 'failed' || r?.status === 'not_connected' ? '#D92D20' : 'var(--text-secondary)' }}>
                          {label(x)}: {r ? (r.status === 'posted' ? (r.url && /^https:\/\//i.test(r.url) ? <a href={r.url} target="_blank" rel="noreferrer" style={{ color: 'var(--coral)', fontWeight: 600 }}>Posted, view it</a> : 'Posted') : r.status === 'not_connected' ? 'Account not connected' : r.error || 'Failed') : p.status === 'scheduled' ? 'Waiting to post' : '-'}
                        </p>
                      )
                    })}
                  </div>
                  {p.caption && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 96, overflowY: 'auto' }}>{cleanString(p.caption)}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {p.video_url && <button type="button" onClick={() => download(p.video_url!, p.id, p.title)} style={{ ...buttonSecondary, padding: '8px 14px', fontSize: 13 }}>Download video</button>}
                {p.status !== 'posting' && (confirmDelete === p.id ? (
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{p.status === 'posted' || p.status === 'partial' ? 'Remove from this list? It stays on the platform.' : 'Delete this scheduled post?'}</span>
                    <button type="button" onClick={() => deletePost(p.id)} style={{ ...buttonSecondary, padding: '8px 14px', fontSize: 13, color: '#D92D20', fontWeight: 700 }}>Delete</button>
                    <button type="button" onClick={() => setConfirmDelete(null)} style={{ ...buttonSecondary, padding: '8px 14px', fontSize: 13 }}>Keep</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(p.id)} style={{ ...buttonSecondary, padding: '8px 14px', fontSize: 13, color: '#D92D20' }}>Delete</button>
                ))}
              </div>
            </div>
          )
        })()}

        {plan?.from === 'calendar' && (
          <PlanPanel key={`c-${plan.day}`} plan={plan} renders={renders} connected={connected} onClose={() => setPlan(null)} onDone={scheduled} />
        )}
      </section>}

      {/* Videos */}
      <section aria-labelledby="pub-ready" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 id="pub-ready" style={heading}>Your videos</h3>
        {groups.length === 0 && <p style={{ ...small, fontSize: 13 }}>Finished videos show up here. Make one from Content Ideas or an AI Editor.</p>}
        {groups.map((g, gi) => (
          <CollapsibleBox key={g.key} title={g.title} summary={`${g.count} ${g.noun}${g.count === 1 ? '' : 's'}`} defaultOpen={gi === 0}>
            {g.key === 'reels' ? (
              <>
                <p style={small}>Image reels can not be posted automatically yet. Copy the caption and post them from your phone.</p>
                {carousels.map((c) => (
                  <div key={c.id} style={{ border: '1px solid var(--line)', borderRadius: 4, padding: '10px 14px', background: '#fff', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.caption ? cleanString(c.caption) : `${c.image_paths.length} image carousel, ${new Date(c.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}</span>
                    {c.caption && <button type="button" onClick={() => copy(cleanString(c.caption!), c.id)} style={{ ...buttonSecondary, padding: '6px 12px', fontSize: 12 }}>{copied === c.id ? 'Copied' : 'Copy'}</button>}
                  </div>
                ))}
              </>
            ) : g.items.map((r) => (
              <VideoCard
                key={r.id}
                r={r}
                isFree={isFree}
                copied={copied}
                downloading={downloading === r.id}
                onCopy={copy}
                onDownload={() => download(r.output_url!, r.id, r.title)}
                onSaved={(patch) => setRenders((cur) => cur.map((x) => (x.id === r.id ? { ...x, ...patch } : x)))}
                schedule={SHOW_SCHEDULING && connected.length > 0 ? { open: plan?.from === 'video' && plan.renderId === r.id, toggle: () => { setOpenPost(null); setPlan(plan?.renderId === r.id && plan.from === 'video' ? null : { from: 'video', renderId: r.id, day: dayValue(addDays(new Date(), 1)) }) }, panel: plan?.from === 'video' && plan.renderId === r.id ? <PlanPanel key={`v-${r.id}`} plan={plan} renders={renders} connected={connected} onClose={() => setPlan(null)} onDone={scheduled} /> : null } : null}
              />
            ))}
          </CollapsibleBox>
        ))}
      </section>
    </div>
  )
}

// Scheduling form. From a video it is one button (we pick a good time); the person can choose a date and time instead.
function PlanPanel({ plan, renders, connected, onClose, onDone }: { plan: { from: 'video' | 'calendar'; renderId: string; day: string }; renders: Render[]; connected: PlatformId[]; onClose: () => void; onDone: (msg: string, post?: { id: string; scheduledFor: string }) => void }) {
  const fromCalendar = plan.from === 'calendar'
  const [renderId, setRenderId] = useState(plan.renderId)
  const [custom, setCustom] = useState(fromCalendar)
  const [day, setDay] = useState(plan.day)
  const [time, setTime] = useState('18:30')
  const [picked, setPicked] = useState<PlatformId[]>(connected)
  const [tt, setTt] = useState<TikTokOptions>(emptyTikTok)
  const render = renders.find((r) => r.id === renderId)
  const [text, setText] = useState(() => cleanString([render?.caption, render?.tags].filter(Boolean).join('\n')))
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const pickRender = (id: string) => {
    setRenderId(id)
    const r = renders.find((x) => x.id === id)
    setText(cleanString([r?.caption, r?.tags].filter(Boolean).join('\n')))
  }
  const submit = async () => {
    setMsg('')
    if (!render) { setMsg('Choose a video.'); return }
    if (picked.length === 0) { setMsg('Choose at least one account to post to.'); return }
    if (picked.includes('tiktok')) { const p = tiktokProblem(tt); if (p) { setMsg(p); return } }
    setBusy(true)
    try {
      let res: Response
      if (custom) {
        const when = new Date(`${day}T${time}`)
        if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 60_000) { setMsg('Pick a time in the future.'); setBusy(false); return }
        res = await authFetch('/api/schedule-post', { method: 'POST', body: JSON.stringify({ ideaId: render.id, title: cleanString(render.title || 'Untitled video'), caption: text, tags: null, videoUrl: render.output_url, scheduledFor: when.toISOString(), platforms: picked, tiktok: picked.includes('tiktok') ? tt : undefined }) })
      } else {
        res = await authFetch('/api/auto-schedule', { method: 'POST', body: JSON.stringify({ renderId: render.id, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, caption: text, platforms: picked, force: true, tiktok: picked.includes('tiktok') ? tt : undefined }) })
      }
      if (!res.ok) { const e = await res.json().catch(() => ({})); setMsg(e.error && e.error !== 'no_accounts' ? e.error : 'Could not schedule. Please try again.'); setBusy(false); return }
      const j = await res.json().catch(() => ({}))
      const post = j.post ? { id: j.post.id, scheduledFor: j.post.scheduled_for } : j.id ? { id: j.id, scheduledFor: j.scheduledFor } : undefined
      onDone('Scheduled. It is on your calendar below.', post)
    } catch { setMsg('Could not schedule. Please try again.'); setBusy(false) }
  }
  const lab = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 } as const
  const link = { background: 'none', border: 'none', color: 'var(--coral)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 } as const

  if (connected.length === 0) return null

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 4, background: 'var(--sand)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {fromCalendar && (
        <>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Schedule for {new Date(`${plan.day}T12:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div><span style={lab}>Video</span><Dropdown ariaLabel="Video" value={renderId} onChange={pickRender} options={renders.map((r) => ({ value: r.id, label: cleanString(r.title || 'Untitled video') }))} /></div>
            <div><span style={lab}>Time</span><Dropdown ariaLabel="Time" value={time} onChange={setTime} options={TIME_OPTIONS} /></div>
          </div>
        </>
      )}
      {!fromCalendar && custom && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div><span style={lab}>Day</span><DatePicker id="pp-day" label="Day" value={day} onChange={setDay} /></div>
          <div><span style={lab}>Time</span><Dropdown ariaLabel="Time" value={time} onChange={setTime} options={TIME_OPTIONS} /></div>
        </div>
      )}
      {connected.length > 1 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Post to</span>
          {PLATFORMS.filter((p) => connected.includes(p.id)).map((p) => (
            <button key={p.id} type="button" aria-pressed={picked.includes(p.id)} onClick={() => setPicked((c) => c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id])} style={chip(picked.includes(p.id))}>{p.label}</button>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Posting to {label(connected[0])}</p>
      )}
      {picked.includes('tiktok') && <TikTokSettings videoUrl={render?.output_url || null} value={tt} onChange={setTt} />}
      {editing ? (
        <div><label htmlFor="pp-cap" style={lab}>Caption</label><textarea id="pp-cap" value={text} onChange={(e) => setText(e.target.value)} rows={4} style={{ ...inputCompact, resize: 'vertical' }} /></div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          {text ? <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text.split('\n')[0]}</span> : 'No caption yet.'}
          <button type="button" onClick={() => setEditing(true)} style={link}>{text ? 'Edit caption' : 'Add a caption'}</button>
        </p>
      )}
      {msg && <p role="alert" style={{ fontSize: 13, color: '#D92D20', margin: 0 }}>{msg}</p>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={submit} disabled={busy} style={{ ...buttonPrimary, opacity: busy ? 0.6 : 1 }}>{busy ? 'Scheduling...' : custom ? 'Schedule' : 'Schedule it for me'}</button>
        <button type="button" onClick={onClose} style={buttonSecondary}>Cancel</button>
        {!fromCalendar && <button type="button" onClick={() => setCustom((c) => !c)} style={{ ...link, marginLeft: 'auto' }}>{custom ? 'Pick the time for me' : 'Choose a date and time'}</button>}
      </div>
    </div>
  )
}

// Splits saved hashtags ("#a #b, c") into a clean list with one # each
const parseTags = (t: string | null | undefined) => Array.from(new Set((t || '').split(/[\s,]+/).map((x) => x.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean))).map((x) => `#${x}`)

// One finished video in Publish: edit its title, description and hashtags, copy them, and download the video
function VideoCard({ r, isFree, copied, downloading, onCopy, onDownload, onSaved, schedule }: {
  r: Render; isFree: boolean; copied: string | null; downloading: boolean
  onCopy: (text: string, key: string) => void; onDownload: () => void
  onSaved: (patch: Partial<Render>) => void
  schedule: { open: boolean; toggle: () => void; panel: React.ReactNode } | null
}) {
  const [title, setTitle] = useState(() => (r.title ? cleanString(r.title) : ''))
  const [desc, setDesc] = useState(() => (r.caption ? cleanString(r.caption) : ''))
  const [tags, setTags] = useState<string[]>(() => parseTags(r.tags))
  const [tagDraft, setTagDraft] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')

  const save = async (patch: { title?: string; caption?: string; tags?: string }) => {
    setState('saving')
    try {
      const res = await authFetch('/api/update-render-text', { method: 'POST', body: JSON.stringify({ renderId: r.id, ...patch }) })
      if (!res.ok) throw new Error('save failed')
      onSaved(patch)
      setState('saved'); setTimeout(() => setState((s) => (s === 'saved' ? 'idle' : s)), 1500)
    } catch { setState('failed') }
  }
  const saveTags = (next: string[]) => { setTags(next); save({ tags: next.join(' ') }) }
  const addTag = () => {
    const extra = parseTags(tagDraft)
    setTagDraft('')
    if (extra.length === 0) return
    saveTags(Array.from(new Set([...tags, ...extra])))
  }
  const fullDesc = [desc.trim(), tags.join(' ')].filter(Boolean).join('\n\n')

  return (
    <div className="pub-card">
      <video className="pub-thumb" src={r.output_url!} muted playsInline preload="metadata" />
      <div className="pub-info">
        <div>
          <p className="pub-label">Title</p>
          <div className="pub-row">
            <input className="pub-field" aria-label="Video title" value={title} maxLength={200} placeholder="Untitled video" onChange={(e) => setTitle(e.target.value)} onBlur={() => { if (title !== (r.title ? cleanString(r.title) : '')) save({ title }) }} style={{ fontSize: 14, fontWeight: 600 }} />
            <button type="button" className="pub-copy" aria-label="Copy title" title="Copy title" disabled={!title.trim()} onClick={() => onCopy(title.trim(), `${r.id}-t`)}>{copied === `${r.id}-t` ? <TickIcon /> : <CopyIcon />}</button>
          </div>
        </div>
        <div>
          <p className="pub-label">Description</p>
          <div className="pub-row">
            <textarea className="pub-field" aria-label="Video description" value={desc} maxLength={2200} rows={3} placeholder="Add a description" onChange={(e) => setDesc(e.target.value)} onBlur={() => { if (desc !== (r.caption ? cleanString(r.caption) : '')) save({ caption: desc }) }} style={{ fontSize: 12, lineHeight: 1.5, resize: 'vertical' }} />
            <button type="button" className="pub-copy" aria-label="Copy description and hashtags" title="Copy description and hashtags" disabled={!fullDesc} onClick={() => onCopy(fullDesc, `${r.id}-d`)}>{copied === `${r.id}-d` ? <TickIcon /> : <CopyIcon />}</button>
          </div>
        </div>
        <div>
          <p className="pub-label">Hashtags</p>
          <div className="pub-row">
            <div className="pub-tags" style={{ flex: 1, minWidth: 0 }}>
              {tags.map((t) => (
                <span key={t} className="pub-tag">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => saveTags(tags.filter((x) => x !== t))}>×</button></span>
              ))}
              <input className="pub-tag-input" aria-label="Add a hashtag" value={tagDraft} placeholder="Add a hashtag" onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); addTag() } else if (e.key === 'Backspace' && !tagDraft && tags.length) saveTags(tags.slice(0, -1)) }} onBlur={addTag} />
            </div>
            <button type="button" className="pub-copy" aria-label="Copy hashtags" title="Copy hashtags" disabled={tags.length === 0} onClick={() => onCopy(tags.join(' '), `${r.id}-h`)}>{copied === `${r.id}-h` ? <TickIcon /> : <CopyIcon />}</button>
          </div>
        </div>
        <p style={{ ...small, minHeight: 16 }} role="status">
          {new Date(r.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          {state === 'saving' && ' · Saving...'}{state === 'saved' && ' · Saved'}
          {state === 'failed' && <span style={{ color: '#D92D20' }}> · Could not save. Please try again.</span>}
        </p>
      </div>
      {!isFree && (
        <div className="pub-actions">
          <button type="button" className="pub-dl" disabled={downloading} onClick={onDownload}><Icon n="download" />{downloading ? 'Downloading...' : 'Download'}</button>
          {schedule && <button type="button" onClick={schedule.toggle} style={{ ...buttonSecondary, padding: '8px 14px', fontSize: 13 }}>Schedule</button>}
        </div>
      )}
      {schedule?.panel && <div style={{ gridColumn: '1 / -1' }}>{schedule.panel}</div>}
    </div>
  )
}
