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
  idea_id?: string | null
  source?: string | null
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
      <div className="render-card-grid" style={{ display: 'grid', gridTemplateColumns: '200px 1fr' }}>
        <div style={{ background: '#000' }}>
          {render.output_url ? (
            <video
              src={render.output_url}
              style={{ width: '100%', height: '100%', objectFit: 'cover', maxHeight: 280, display: 'block' }}
              loop controls
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
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {render.output_url && (
              <button onClick={() => onDownload(render.output_url!)} style={{ flex: 1, background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Download
              </button>
            )}
            <button onClick={() => onClear(render.id)} style={{ flex: 1, background: 'none', border: '1px solid rgba(200,50,50,0.4)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'rgba(200,50,50,0.8)', cursor: 'pointer' }}>
              Remove
            </button>
          </div>
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

function Folder({ id, title, count, noun, open, onToggle, children }: {
  id: string
  title: string
  count: number
  noun: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div id={id} style={{ scrollMarginTop: 80 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--sand)', border: '1px solid rgba(128,128,128,0.15)', borderRadius: 12, padding: '14px 18px', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: 'var(--ink)', textAlign: 'left' }}
      >
        <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none', color: 'var(--text-muted)' }}>›</span>
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{count} {noun}{count === 1 ? '' : 's'}</span>
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>{children}</div>}
    </div>
  )
}

export default function SchedulerTab({ userId, carousels }: { userId: string | null; carousels: Carousel[] }) {
  const [renders, setRenders] = useState<Render[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [carouselThumbs, setCarouselThumbs] = useState<Record<string, string>>({})
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      setLoading(true)
      const query = (cols: string) => supabase
        .from('renders')
        .select(cols)
        .eq('user_id', userId)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
      let result = await query('id, output_url, status, created_at, title, caption, tags, idea_id, source')
      if (result.error) {
        // `source` column not added yet, fall back to the original columns
        result = await query('id, output_url, status, created_at, title, caption, tags, idea_id')
      }
      setRenders((result.data as unknown as Render[]) || [])
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

  const kindOf = (r: Render): 'script' | 'idea' | 'other' => {
    if (r.source === 'script') return 'script'
    if (r.source === 'idea') return 'idea'
    if (r.source === 'upload') return 'other'
    if (r.idea_id && r.idea_id.startsWith('script-')) return 'script'
    return r.title ? 'idea' : 'other'
  }
  const scriptRenders = renders.filter((r) => kindOf(r) === 'script')
  const ideaRenders = renders.filter((r) => kindOf(r) === 'idea')
  const otherRenders = renders.filter((r) => kindOf(r) === 'other')

  const counts: Record<string, number> = { script: scriptRenders.length, idea: ideaRenders.length, reel: carousels.length, other: otherRenders.length }
  const defaultOpen = ['script', 'idea', 'reel', 'other'].find((k) => counts[k] > 0)
  const isOpen = (k: string) => openFolders[k] ?? k === defaultOpen
  const toggleFolder = (k: string) => setOpenFolders((p) => ({ ...p, [k]: !isOpen(k) }))
  const jumpTo = (k: string) => {
    setOpenFolders((p) => ({ ...p, [k]: true }))
    setTimeout(() => document.getElementById(`folder-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  const shortcuts = [
    { key: 'script', label: 'Scripts' },
    { key: 'idea', label: 'Premade ideas' },
    { key: 'reel', label: 'Image reels' },
  ]

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><span className="rly-spinner rly-spinner-coral" /></div>

  const emptyNote = (text: string) => (
    <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 2px', margin: 0 }}>{text}</p>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div>
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Ready to post</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your completed videos and carousels with suggested captions and hashtags.</p>
      </div>

      <div style={{ background: 'var(--sand)', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(128,128,128,0.12)' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(216,90,48,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="var(--coral)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="5.5"/><line x1="7" y1="4" x2="7" y2="7.5"/><circle cx="7" cy="9.5" r="0.5" fill="var(--coral)"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>In-app scheduling coming soon</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              We&apos;re building direct Instagram and TikTok posting. In the meantime, all your rendered videos are available to download below, complete with captions, descriptions and hashtags ready to paste when you post.
            </p>
          </div>
        </div>
      </div>

      {renders.length === 0 && carousels.length === 0 && (
        <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>No completed videos or carousels yet.</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Head to AI Editor, Editor For Any Video, or Carousel Reels to create content.</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {shortcuts.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => jumpTo(s.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, border: '1px solid rgba(128,128,128,0.3)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {s.label}
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{counts[s.key]}</span>
          </button>
        ))}
      </div>

      <Folder id="folder-script" title="Scripts" count={scriptRenders.length} noun="video" open={isOpen('script')} onToggle={() => toggleFolder('script')}>
        {scriptRenders.length === 0
          ? emptyNote('No finished videos from your scripts yet.')
          : scriptRenders.map((render) => (
              <RenderCard key={render.id} render={render} copied={copied} onCopy={copyToClipboard} onDownload={downloadVideo} onClear={clearRender} />
            ))}
      </Folder>

      <Folder id="folder-idea" title="Premade ideas" count={ideaRenders.length} noun="video" open={isOpen('idea')} onToggle={() => toggleFolder('idea')}>
        {ideaRenders.length === 0
          ? emptyNote('No finished videos from your content ideas yet.')
          : ideaRenders.map((render) => (
              <RenderCard key={render.id} render={render} copied={copied} onCopy={copyToClipboard} onDownload={downloadVideo} onClear={clearRender} />
            ))}
      </Folder>

      <Folder id="folder-reel" title="Image reels" count={carousels.length} noun="carousel" open={isOpen('reel')} onToggle={() => toggleFolder('reel')}>
        {carousels.length === 0 ? emptyNote('No image reels yet.') : (
          <>
            {carousels.map((c) => (
              <div key={c.id} style={{ background: 'var(--sand)', borderRadius: 16, overflow: 'hidden' }}>
                <div className="render-card-grid" style={{ display: 'grid', gridTemplateColumns: '200px 1fr' }}>
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
          </>
        )}
      </Folder>

      {otherRenders.length > 0 && (
        <Folder id="folder-other" title="Other renders" count={otherRenders.length} noun="video" open={isOpen('other')} onToggle={() => toggleFolder('other')}>
          {otherRenders.map((render) => (
            <RenderCard key={render.id} render={render} copied={copied} onCopy={copyToClipboard} onDownload={downloadVideo} onClear={clearRender} />
          ))}
        </Folder>
      )}

    </div>
  )
}
