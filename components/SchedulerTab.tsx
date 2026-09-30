'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ScheduledPost = {
  id: string
  title: string
  caption: string | null
  tags: string | null
  video_url: string | null
  scheduled_for: string
  platforms: string[]
  status: string
  idea_id: string | null
}

type Idea = { id: string; title: string; hook: string; tags: string }
type FilmingItem = Idea & { checklist: string[]; caption?: string; script?: string }

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getWeekDates(offset: number): Date[] {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - dayOfWeek + offset * 7)
  startOfWeek.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })
}

export default function SchedulerTab({ userId, savedIdeas, filmingItems }: { userId: string | null; savedIdeas: Idea[]; filmingItems: FilmingItem[] }) {
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekDates, setWeekDates] = useState<Date[]>(getWeekDates(0))
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null)
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleIdeaId, setScheduleIdeaId] = useState<string>('')
  const [scheduleCaption, setScheduleCaption] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [scheduleDate, setScheduleDate] = useState('')
  const [schedulePlatforms, setSchedulePlatforms] = useState<string[]>(['instagram'])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setWeekDates(getWeekDates(weekOffset))
  }, [weekOffset])

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      setLoading(true)
      const res = await fetch(`/api/scheduled-posts?userId=${userId}`)
      const data = await res.json()
      setScheduledPosts(data.posts || [])
      setLoading(false)
    }
    load()
  }, [userId])

  const openScheduleModal = (date: Date, hour: number) => {
    const d = new Date(date)
    d.setHours(hour, 0, 0, 0)
    setScheduleDate(d.toISOString().split('T')[0])
    setScheduleTime(`${String(hour).padStart(2, '0')}:00`)
    setScheduleIdeaId('')
    setScheduleCaption('')
    setSchedulePlatforms(['instagram'])
    setSelectedSlot({ date, hour })
    setShowScheduleModal(true)
  }

  const handleIdeaSelect = (ideaId: string) => {
    setScheduleIdeaId(ideaId)
    const idea = [...savedIdeas, ...filmingItems].find((i) => i.id === ideaId)
    if (idea && 'caption' in idea && idea.caption) {
      setScheduleCaption(idea.caption + (idea.tags ? '\n' + idea.tags : ''))
    } else if (idea) {
      setScheduleCaption(idea.tags || '')
    }
  }

  const handleSchedule = async () => {
    if (!userId || !scheduleIdeaId) return
    setSaving(true)
    const idea = [...savedIdeas, ...filmingItems].find((i) => i.id === scheduleIdeaId)
    const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()

    const res = await fetch('/api/schedule-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        ideaId: scheduleIdeaId,
        title: idea?.title || 'Untitled',
        caption: scheduleCaption,
        tags: idea?.tags || '',
        scheduledFor,
        platforms: schedulePlatforms,
      }),
    })
    const data = await res.json()
    if (res.ok && data.post) {
      setScheduledPosts((prev) => [...prev, data.post])
    }
    setSaving(false)
    setShowScheduleModal(false)
    setSelectedSlot(null)
  }

  const handleDelete = async (postId: string) => {
    await fetch('/api/update-scheduled-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, postId, updates: { status: 'cancelled' } }),
    })
    setScheduledPosts((prev) => prev.filter((p) => p.id !== postId))
    setSelectedPost(null)
  }

  const postsForSlot = (date: Date, hour: number) => {
    return scheduledPosts.filter((p) => {
      const d = new Date(p.scheduled_for)
      return d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate() &&
        d.getHours() === hour &&
        p.status !== 'cancelled'
    })
  }

  const formatDate = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  const isToday = (d: Date) => {
    const now = new Date()
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }

  // Deduplicate — filmingItems may share ids with savedIdeas
  const allIdeasMap = new Map<string, Idea>()
  ;[...savedIdeas, ...filmingItems].forEach((i) => allIdeasMap.set(i.id, i))
  const allIdeas = Array.from(allIdeasMap.values())

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Content Scheduler</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Click any time slot to schedule a post. Instagram posting coming soon.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setWeekOffset((p) => p - 1)} style={{ background: 'var(--sand)', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 15, color: 'var(--ink)' }}>←</button>
          <button onClick={() => setWeekOffset(0)} style={{ background: 'var(--sand)', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>This week</button>
          <button onClick={() => setWeekOffset((p) => p + 1)} style={{ background: 'var(--sand)', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 15, color: 'var(--ink)' }}>→</button>
        </div>
      </div>

      {/* Instagram connect banner */}
      <div style={{ background: 'rgba(216,90,48,0.08)', border: '1px solid rgba(216,90,48,0.25)', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Connect Instagram to enable auto-posting</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Currently in planning mode — posts are saved but not published automatically.</p>
        </div>
        <button style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'not-allowed', opacity: 0.7 }}>
          Coming soon
        </button>
      </div>

      {/* Calendar grid */}
      <div style={{ background: 'var(--sand)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', borderBottom: '1px solid rgba(128,128,128,0.12)' }}>
          <div />
          {weekDates.map((d, i) => (
            <div key={i} style={{ padding: '12px 8px', textAlign: 'center', borderLeft: '1px solid rgba(128,128,128,0.08)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: isToday(d) ? 'var(--coral)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{DAYS[i]}</p>
              <p style={{ fontSize: 16, fontWeight: isToday(d) ? 700 : 400, color: isToday(d) ? 'var(--coral)' : 'var(--ink)' }}>{d.getDate()}</p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDate(d)}</p>
            </div>
          ))}
        </div>

        {/* Hour rows — show 7am to 10pm */}
        <div style={{ overflowY: 'auto', maxHeight: 520 }}>
          {HOURS.filter((h) => h >= 7 && h <= 22).map((hour) => (
            <div key={hour} style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', borderBottom: '1px solid rgba(128,128,128,0.06)', minHeight: 52 }}>
              <div style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', paddingTop: 8 }}>
                {hour === 12 ? '12pm' : hour > 12 ? `${hour - 12}pm` : `${hour}am`}
              </div>
              {weekDates.map((date, di) => {
                const posts = postsForSlot(date, hour)
                const slotTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0)
        const isPast = slotTime < new Date()
                return (
                  <div
                    key={di}
                    onClick={() => !isPast && openScheduleModal(date, hour)}
                    style={{ borderLeft: '1px solid rgba(128,128,128,0.08)', padding: '4px', cursor: isPast ? 'default' : 'pointer', background: isToday(date) ? 'rgba(216,90,48,0.03)' : 'transparent', transition: 'background 0.1s', position: 'relative' }}
                    onMouseEnter={(e) => { if (!isPast) e.currentTarget.style.background = 'rgba(216,90,48,0.07)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isToday(date) ? 'rgba(216,90,48,0.03)' : 'transparent' }}
                  >
                    {posts.map((post) => (
                      <div
                        key={post.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedPost(post) }}
                        style={{ background: post.status === 'posted' ? 'rgba(34,197,94,0.15)' : 'var(--coral)', borderRadius: 5, padding: '3px 6px', marginBottom: 2, cursor: 'pointer', overflow: 'hidden', maxWidth: '100%' }}
                      >
                        <p style={{ fontSize: 10, fontWeight: 600, color: post.status === 'posted' ? 'rgb(34,197,94)' : '#fff', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {post.status === 'posted' ? '✓ ' : ''}{post.title}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming posts list */}
      {scheduledPosts.filter((p) => p.status === 'scheduled' && new Date(p.scheduled_for) > new Date()).length > 0 && (
        <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '20px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>Upcoming posts</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scheduledPosts
              .filter((p) => p.status === 'scheduled' && new Date(p.scheduled_for) > new Date())
              .slice(0, 5)
              .map((post) => (
                <div key={post.id} onClick={() => setSelectedPost(post)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--card-bg)', borderRadius: 8, cursor: 'pointer' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{post.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(post.scheduled_for).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--coral)', background: 'rgba(216,90,48,0.1)', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>
                    {post.platforms.join(' · ')}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Schedule modal */}
      {showScheduleModal && (
        <div onClick={() => setShowScheduleModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: '32px', maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Schedule a post</h3>

            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>Choose an idea</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20, maxHeight: 180, overflowY: 'auto' }}>
              {allIdeas.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No saved ideas yet. Star ideas in Content Ideas first.</p>}
              {allIdeas.map((idea) => (
                <label key={idea.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 8, background: scheduleIdeaId === idea.id ? 'rgba(216,90,48,0.1)' : 'var(--sand)', cursor: 'pointer', border: scheduleIdeaId === idea.id ? '1.5px solid var(--coral)' : '1px solid transparent' }}>
                  <input type="radio" name="idea" checked={scheduleIdeaId === idea.id} onChange={() => handleIdeaSelect(idea.id)} style={{ marginTop: 2, accentColor: 'var(--coral)' }} />
                  <span style={{ fontSize: 13, fontWeight: scheduleIdeaId === idea.id ? 600 : 400 }}>{idea.title}</span>
                </label>
              ))}
            </div>

            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>Caption</p>
            <textarea
              value={scheduleCaption}
              onChange={(e) => setScheduleCaption(e.target.value)}
              rows={3}
              placeholder="Write your caption or it will auto-fill from the idea..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--sand)', color: 'var(--ink)', fontSize: 13, fontFamily: "'Inter', sans-serif", resize: 'vertical', boxSizing: 'border-box', marginBottom: 16 }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Date</p>
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--sand)', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Time</p>
                <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--sand)', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>

            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>Platforms</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {['instagram', 'tiktok', 'facebook'].map((p) => (
                <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: schedulePlatforms.includes(p) ? 'rgba(216,90,48,0.1)' : 'var(--sand)', border: schedulePlatforms.includes(p) ? '1.5px solid var(--coral)' : '1px solid rgba(128,128,128,0.2)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: schedulePlatforms.includes(p) ? 'var(--coral)' : 'var(--ink)', textTransform: 'capitalize' }}>
                  <input type="checkbox" checked={schedulePlatforms.includes(p)} onChange={(e) => { setSchedulePlatforms((prev) => e.target.checked ? [...prev, p] : prev.filter((x) => x !== p)) }} style={{ display: 'none' }} />
                  {p}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowScheduleModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'none', color: 'var(--ink)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSchedule} disabled={saving || !scheduleIdeaId || !scheduleDate} style={{ flex: 2, padding: '11px', borderRadius: 8, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving || !scheduleIdeaId || !scheduleDate ? 'not-allowed' : 'pointer', opacity: saving || !scheduleIdeaId || !scheduleDate ? 0.6 : 1 }}>
                {saving ? 'Scheduling...' : 'Schedule post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post detail modal */}
      {selectedPost && (
        <div onClick={() => setSelectedPost(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: '32px', maxWidth: 420, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700 }}>{selectedPost.title}</h3>
              <span style={{ fontSize: 11, fontWeight: 600, color: selectedPost.status === 'posted' ? 'rgb(34,197,94)' : 'var(--coral)', background: selectedPost.status === 'posted' ? 'rgba(34,197,94,0.1)' : 'rgba(216,90,48,0.1)', borderRadius: 20, padding: '3px 10px' }}>{selectedPost.status}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {new Date(selectedPost.scheduled_for).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </p>
            {selectedPost.caption && (
              <div style={{ background: 'var(--sand)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Caption</p>
                <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{selectedPost.caption}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(selectedPost.caption || '')}
                  style={{ marginTop: 8, background: 'none', border: '1px solid rgba(128,128,128,0.25)', borderRadius: 6, padding: '5px 12px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Copy caption
                </button>
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Platforms: {selectedPost.platforms.join(', ')}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSelectedPost(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.3)', background: 'none', color: 'var(--ink)', fontSize: 13, cursor: 'pointer' }}>Close</button>
              {selectedPost.status === 'scheduled' && (
                <button onClick={() => handleDelete(selectedPost.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(200,50,50,0.4)', background: 'none', color: 'rgba(200,50,50,0.8)', fontSize: 13, cursor: 'pointer' }}>Cancel post</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
