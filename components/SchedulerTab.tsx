'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Render = {
  id: string
  output_url: string | null
  status: string
  created_at: string
  title?: string | null
  caption?: string | null
  tags?: string | null
}

type Carousel = {
  id: string
  image_paths: string[]
  caption: string | null
  created_at: string
}

function RenderCard({ render, copied, onCopy, onDownload, onClear }: {
  render: Render
  copied: string | null
  onCopy: (text: string, key: string) => void
  onDownload: (url: string) => void
  onClear: (id: string) => void
}) {
  const caption = render.caption || ''
  const tags = render.tags || ''
  const fullCaption = [caption, tags].filter(Boolean).join('\n')

  return (
    <div style={{ background: 'var(--sand)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr' }}>
        <div style={{ background: '#000' }}>
          {render.output_url ? (
            <video
              src={render.output_url}
              style={{ width: '100%', height: '100%', objectFit: 'cover', maxHeight: 280, display: 'block' }}
              muted loop
              onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
              onMouseLeave={(e) => { (e.currentTarget as HTMLVideoElement).pause(); (e.currentTarget as HTMLVideoElement).currentTime = 0 }}
            />
          ) : <div style={{ height: 200 }} />}
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                {new Date(render.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              {render.title && <p style={{ fontSize: 14, fontWeight: 600 }}>{render.title}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {render.output_url && (
                <button onClick={() => onDownload(render.output_url!)} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Download
                </button>
              )}
              <button onClick={() => onClear(render.id)} style={{ background: 'none', border: '1px solid rgba(200,50,50,0.4)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'rgba(200,50,50,0.8)', cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          </div>
          {fullCaption ? (
            <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Caption</p>
                <button onClick={() => onCopy(fullCaption, `caption-${render.id}`)} style={{ fontSize: 11, color: copied === `caption-${render.id}` ? 'var(--coral)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {copied === `caption-${render.id}` ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{fullCaption}</p>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No caption · generate filming instructions for this idea to get a suggested caption.</p>
          )}
          {tags && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--coral)', flex: 1 }}>{tags}</p>
              <button onClick={() => onCopy(tags, `tags-${render.id}`)} style={{ fontSize: 11, color: copied === `tags-${render.id}` ? 'var(--coral)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
                {copied === `tags-${render.id}` ? '✓ Copied!' : 'Copy tags'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SchedulerTab({ userId, carousels }: { userId: string | null; carousels: Carousel[] }) {
  const [renders, setRenders] = useState<Render[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [carouselThumbs, setCarouselThumbs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('renders')
        .select('id, output_url, status, created_at, title, caption, tags')
        .eq('user_id', userId)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
      setRenders(data || [])
      setLoading(false)
    }
    load()
  }, [userId])

  useEffect(() => {
    if (!carousels.length) return
    const load = async () => {
      const thumbs: Record<string, string> = {}
      for (const c of carousels) {
        if (c.image_paths.length > 0) {
          const { data } = await supabase.storage.from('video-uploads').createSignedUrl(c.image_paths[0], 3600)
          if (data) thumbs[c.id] = data.signedUrl
        }
      }
      setCarouselThumbs(thumbs)
    }
    load()
  }, [carousels])

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

  const clearRender = async (renderId: string) => {
    await supabase.from('renders').update({ status: 'cleared' }).eq('id', renderId)
    setRenders((prev) => prev.filter((r) => r.id !== renderId))
  }

  const ideaRenders = renders.filter((r) => r.title)
  const freeRenders = renders.filter((r) => !r.title)

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><span className="rly-spinner rly-spinner-coral" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div>
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Ready to post</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your completed videos and carousels with suggested captions and hashtags.</p>
      </div>

      <div style={{ background: 'rgba(216,90,48,0.08)', border: '1px solid rgba(216,90,48,0.25)', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Auto-posting coming soon</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Download your video and copy your caption to post manually for now.</p>
        </div>
        <button style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'not-allowed', opacity: 0.7 }}>Connect Instagram</button>
      </div>

      {renders.length === 0 && carousels.length === 0 && (
        <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>No completed videos or carousels yet.</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Head to AI Editor, Editor For Any Video, or Carousel Reels to create content.</p>
        </div>
      )}

      {ideaRenders.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>From your ideas</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {ideaRenders.map((render) => (
              <RenderCard key={render.id} render={render} copied={copied} onCopy={copyToClipboard} onDownload={downloadVideo} onClear={clearRender} />
            ))}
          </div>
        </div>
      )}

      {freeRenders.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>Other renders</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {freeRenders.map((render) => (
              <RenderCard key={render.id} render={render} copied={copied} onCopy={copyToClipboard} onDownload={downloadVideo} onClear={clearRender} />
            ))}
          </div>
        </div>
      )}

      {carousels.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>Carousel posts</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {carousels.map((c) => (
              <div key={c.id} style={{ background: 'var(--sand)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr' }}>
                  <div style={{ background: '#000' }}>
                    {carouselThumbs[c.id] ? (
                      <img src={carouselThumbs[c.id]} alt="Carousel" style={{ width: '100%', height: '100%', objectFit: 'cover', maxHeight: 200, display: 'block' }} />
                    ) : <div style={{ height: 200 }} />}
                  </div>
                  <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{new Date(c.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>{c.image_paths.length} image carousel</p>
                    {c.caption ? (
                      <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Caption</p>
                          <button onClick={() => copyToClipboard(c.caption!, `caption-${c.id}`)} style={{ fontSize: 11, color: copied === `caption-${c.id}` ? 'var(--coral)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                            {copied === `caption-${c.id}` ? '✓ Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{c.caption}</p>
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No caption added.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
