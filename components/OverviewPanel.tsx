'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/authFetch'
import type { ScheduledPost } from '@/components/PublisherPanel'

type Note = { id: string; text: string; action?: { label: string; onClick: () => void }; tone?: 'alert' }
type Analytics = { totals: { views: number; likes: number; comments: number; shares: number }; top: { title: string; views: number }[]; tracked: number }
type Conn = { platform: string; status: string }

async function load(): Promise<{ posts: ScheduledPost[]; conns: Conn[]; analytics: Analytics | null }> {
  const get = async <T,>(url: string): Promise<T | null> => { try { const r = await authFetch(url); return r.ok ? await r.json() : null } catch { return null } }
  const [p, c, a] = await Promise.all([get<{ posts: ScheduledPost[] }>('/api/scheduled-posts'), get<{ connections: Conn[] }>('/api/social/connections'), get<Analytics>('/api/analytics')])
  return { posts: p?.posts || [], conns: c?.connections || [], analytics: a }
}

// Top of the Overview: what needs attention, and how posts are doing
export default function OverviewPanel({ isFree, ideasReady, onGo }: { isFree: boolean; ideasReady: number; onGo: (tab: 'ideas' | 'scheduler' | 'aiuploads') => void }) {
  const [data, setData] = useState<{ posts: ScheduledPost[]; conns: Conn[]; analytics: Analytics | null } | null>(null)
  const [now] = useState(() => Date.now())
  useEffect(() => { load().then(setData) }, [])
  if (!data) return null

  const notes: Note[] = []
  const stuck = data.posts.filter((p) => ['failed', 'needs_connection', 'partial'].includes(p.status))
  if (stuck.length > 0) notes.push({ id: 'stuck', tone: 'alert', text: `${stuck.length} ${stuck.length === 1 ? 'post needs' : 'posts need'} attention: ${stuck[0].title}`, action: { label: 'Review', onClick: () => onGo('scheduler') } })
  if (data.conns.some((c) => c.status === 'expired')) notes.push({ id: 'expired', tone: 'alert', text: 'A connected account has expired. Reconnect it to keep posting.', action: { label: 'Reconnect', onClick: () => onGo('scheduler') } })
  const soon = data.posts.filter((p) => p.status === 'scheduled' && new Date(p.scheduled_for).getTime() - now < 48 * 3600_000)
  if (soon.length > 0) notes.push({ id: 'soon', text: `${soon.length} ${soon.length === 1 ? 'post goes' : 'posts go'} out in the next 2 days.`, action: { label: 'View calendar', onClick: () => onGo('scheduler') } })
  if (!isFree && !data.conns.some((c) => c.status === 'connected')) notes.push({ id: 'connect', text: 'Connect your social accounts so Reelezy can post your videos for you.', action: { label: 'Connect accounts', onClick: () => onGo('scheduler') } })
  if (ideasReady === 0) notes.push({ id: 'ideas', text: 'No ideas for this week yet.', action: { label: 'Generate ideas', onClick: () => onGo('ideas') } })

  const a = data.analytics
  const box = { border: '1px solid var(--line)', borderRadius: 4, background: '#fff', padding: '16px 18px' } as const
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20 }}>
      <section aria-labelledby="ov-notes" style={box}>
        <h3 id="ov-notes" style={{ fontSize: 16, fontWeight: 600, margin: '0 0 10px' }}>Notifications</h3>
        {notes.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>You are all caught up.</p> : notes.map((n) => (
          <div key={n.id} style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: n.tone === 'alert' ? '#D92D20' : 'var(--ink)', flex: 1, minWidth: 160 }}>{n.text}</span>
            {n.action && <button type="button" onClick={n.action.onClick} style={{ background: 'none', border: 'none', color: 'var(--coral)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }}>{n.action.label}</button>}
          </div>
        ))}
      </section>
      <section aria-labelledby="ov-perf" style={box}>
        <h3 id="ov-perf" style={{ fontSize: 16, fontWeight: 600, margin: '0 0 10px' }}>How your posts are doing</h3>
        {!a || a.tracked === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>Views and likes show up here once your posts are live. Reelezy uses your best posts to suggest similar ideas.</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 10 }}>
              {([['Views', a.totals.views], ['Likes', a.totals.likes], ['Comments', a.totals.comments]] as const).map(([k, v]) => (
                <div key={k}><p style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{v.toLocaleString('en-AU')}</p><p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{k}</p></div>
              ))}
            </div>
            {a.top[0] && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Best post: <strong>{a.top[0].title}</strong> ({a.top[0].views.toLocaleString('en-AU')} views)</p>}
          </>
        )}
      </section>
    </div>
  )
}
