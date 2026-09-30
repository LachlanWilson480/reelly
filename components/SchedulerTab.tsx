'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Render = {
  id: string
  output_url: string | null
  status: string
  created_at: string
  idea_id?: string | null
  title?: string | null
  caption?: string | null
  tags?: string | null
}

type FilmingItem = {
  id: string
  title: string
  caption?: string
  tags?: string
  hook?: string
  description?: string
}

const BEST_TIMES = [
  { day: 'Monday', times: ['7am', '12pm', '7pm'], reason: 'Start of week energy' },
  { day: 'Tuesday', times: ['8am', '1pm', '8pm'], reason: 'High engagement midweek' },
  { day: 'Wednesday', times: ['7am', '11am', '6pm'], reason: 'Peak midweek traffic' },
  { day: 'Thursday', times: ['8am', '12pm', '7pm'], reason: 'Pre-weekend build-up' },
  { day: 'Friday', times: ['7am', '2pm', '5pm'], reason: 'End of week wind-down' },
  { day: 'Saturday', times: ['9am', '11am', '7pm'], reason: 'Leisure browsing peak' },
  { day: 'Sunday', times: ['10am', '2pm', '7pm'], reason: 'Sunday scroll session' },
]

function getBestPostingTime(): string {
  const now = new Date()
  const dayName = now.toLocaleDateString('en-AU', { weekday: 'long' })
  const day = BEST_TIMES.find((d) => d.day === dayName)
  if (!day) return 'Tomorrow at 7am'
  const nextDay = BEST_TIMES[(BEST_TIMES.findIndex((d) => d.day === dayName) + 1) % 7]
  return `${nextDay.day} at ${nextDay.times[0]} — ${nextDay.reason}`
}

export default function SchedulerTab({ userId, filmingItems }: { userId: string | null; filmingItems: FilmingItem[] }) {
  const [renders, setRenders] = useState<Render[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRender, setSelectedRender] = useState<Render | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('renders')
        .select('id, output_url, status, created_at, idea_id, title, caption, tags')
        .eq('user_id', userId)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
      setRenders(data || [])
      setLoading(false)
    }
    load()
  }, [userId])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const downloadVideo = async (url: string) => {
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'reelezy-video.mp4'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><span className="rly-spinner rly-spinner-coral" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Ready to post</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your completed videos with suggested captions, hashtags and best times to post.</p>
      </div>

      {/* Instagram connect banner */}
      <div style={{ background: 'rgba(216,90,48,0.08)', border: '1px solid rgba(216,90,48,0.25)', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Auto-posting coming soon</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Download your video and copy your caption to post manually for now.</p>
        </div>
        <button style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'not-allowed', opacity: 0.7 }}>
          Connect Instagram
        </button>
      </div>

      {/* Best times to post */}
      <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '20px 24px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>📅 Best times to post this week</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {BEST_TIMES.map((day) => (
            <div key={day.day} style={{ background: 'var(--card-bg)', borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{day.day}</p>
              <p style={{ fontSize: 11, color: 'var(--coral)', marginBottom: 2 }}>{day.times.join(' · ')}</p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{day.reason}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Renders */}
      {(() => {
        const ideaRenders = renders.filter((r) => r.title)
        const freeRenders = renders.filter((r) => !r.title)
        if (renders.length === 0) return (
          <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>No completed videos yet.</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Head to AI Editor or Editor For Any Video to create your first video.</p>
          </div>
        )
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {ideaRenders.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>🎬 From your ideas</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {ideaRenders.map((render) => {
            const caption = render.caption || ''
            const tags = render.tags || ''
            const fullCaption = [caption, tags].filter(Boolean).join('\n')
            const bestTime = getBestPostingTime()

            return (
              <div key={render.id} style={{ background: 'var(--sand)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 0 }}>
                  {/* Video preview */}
                  <div style={{ background: '#000', position: 'relative' }}>
                    {render.output_url ? (
                      <video
                        src={render.output_url}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', maxHeight: 280 }}
                        controls={false}
                        muted
                        loop
                        onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLVideoElement).pause(); (e.currentTarget as HTMLVideoElement).currentTime = 0 }}
                      />
                    ) : (
                      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p style={{ fontSize: 12, color: '#666' }}>No preview</p>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                          {new Date(render.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        {render.title && <p style={{ fontSize: 14, fontWeight: 600 }}>{render.title}</p>}
                      </div>
                      {render.output_url && (
                        <button
                          onClick={() => downloadVideo(render.output_url!)}
                          style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                        >
                          ⬇ Download
                        </button>
                      )}
                    </div>

                    {/* Caption */}
                    {fullCaption ? (
                      <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)' }}>💬 Caption</p>
                          <button
                            onClick={() => copyToClipboard(fullCaption, `caption-${render.id}`)}
                            style={{ fontSize: 11, color: copied === `caption-${render.id}` ? 'var(--coral)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                          >
                            {copied === `caption-${render.id}` ? '✓ Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{fullCaption}</p>
                      </div>
                    ) : (
                      <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No caption available — generate filming instructions for this idea to get a suggested caption.</p>
                      </div>
                    )}

                    {/* Best time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏰ Best time to post:</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--coral)' }}>{bestTime}</span>
                    </div>

                    {/* Hashtags */}
                    {tags && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontSize: 12, color: 'var(--coral)', flex: 1 }}>{tags}</p>
                        <button
                          onClick={() => copyToClipboard(tags, `tags-${render.id}`)}
                          style={{ fontSize: 11, color: copied === `tags-${render.id}` ? 'var(--coral)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
                        >
                          {copied === `tags-${render.id}` ? '✓ Copied!' : 'Copy tags'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
