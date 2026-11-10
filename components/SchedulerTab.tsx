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
  const download = async (url: string) => {
    const blob = await (await fetch(url)).blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'reelezy-video.mp4'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }
  const copy = (text: string, key: string) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000) }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
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
      <section aria-labelledby="pub-week" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                          {label(x)}: {r ? (r.status === 'posted' ? (r.url ? <a href={r.url} target="_blank" rel="noreferrer" style={{ color: 'var(--coral)', fontWeight: 600 }}>Posted, view it</a> : 'Posted') : r.status === 'not_connected' ? 'Account not connected' : r.error || 'Failed') : p.status === 'scheduled' ? 'Waiting to post' : '-'}
                        </p>
                      )
                    })}
                  </div>
                  {p.caption && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 96, overflowY: 'auto' }}>{cleanString(p.caption)}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {p.video_url && <button type="button" onClick={() => download(p.video_url!)} style={{ ...buttonSecondary, padding: '8px 14px', fontSize: 13 }}>Download video</button>}
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
      </section>

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
              <div key={r.id} style={{ border: '1px solid var(--line)', borderRadius: 4, padding: 12, background: '#fff', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 14 }}>
                  <video src={r.output_url!} muted playsInline preload="metadata" style={{ width: 72, height: 104, objectFit: 'cover', background: '#000', borderRadius: 2 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.title ? cleanString(r.title) : 'Untitled video'}</p>
                    <p style={small}>{new Date(r.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {isFree ? <a href="/plans" style={{ ...buttonPrimary, textDecoration: 'none', padding: '8px 14px', fontSize: 13 }}>Upgrade to schedule</a>
                        : <button type="button" onClick={() => { setOpenPost(null); setPlan(plan?.renderId === r.id && plan.from === 'video' ? null : { from: 'video', renderId: r.id, day: dayValue(addDays(new Date(), 1)) }) }} style={{ ...buttonPrimary, padding: '8px 14px', fontSize: 13 }}>Schedule</button>}
                      {!isFree && <button type="button" onClick={() => download(r.output_url!)} style={{ ...buttonSecondary, padding: '8px 14px', fontSize: 13 }}>Download</button>}
                    </div>
                  </div>
                </div>
                {plan?.from === 'video' && plan.renderId === r.id && (
                  <PlanPanel key={`v-${r.id}`} plan={plan} renders={renders} connected={connected} onClose={() => setPlan(null)} onDone={scheduled} />
                )}
              </div>
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
      if (!res.ok) { const e = await res.json().catch(() => ({})); setMsg(e.error === 'no_accounts' ? 'Connect an account first.' : e.error || 'Could not schedule. Please try again.'); setBusy(false); return }
      const j = await res.json().catch(() => ({}))
      const post = j.post ? { id: j.post.id, scheduledFor: j.post.scheduled_for } : j.id ? { id: j.id, scheduledFor: j.scheduledFor } : undefined
      onDone('Scheduled. It is on your calendar below.', post)
    } catch { setMsg('Could not schedule. Please try again.'); setBusy(false) }
  }
  const lab = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 } as const
  const link = { background: 'none', border: 'none', color: 'var(--coral)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 } as const

  if (connected.length === 0) {
    return (
      <div style={{ border: '1px solid var(--line)', borderRadius: 4, background: 'var(--sand)', padding: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, margin: 0, flex: 1, minWidth: 200 }}>Connect an account at the top of this page, then you can schedule.</p>
        <button type="button" onClick={onClose} style={{ ...buttonSecondary, padding: '8px 14px', fontSize: 13 }}>Close</button>
      </div>
    )
  }

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
