'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// The pictures and clips kept for laying over videos. They are added from the overlay pop-up and show here straight away.
const BUCKET = 'video-uploads'
export const ELEMENTS_CHANGED = 'reelezy:elements-changed'

type Element = { path: string; label: string; kind: 'image' | 'video' }

const kindOf = (name: string, mime: string): 'image' | 'video' | null =>
  mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|svg)$/i.test(name) ? 'image'
    : mime.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(name) ? 'video'
      : null

export default function OverlayElements({ userId }: { userId: string | null }) {
  const [items, setItems] = useState<Element[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.storage.from(BUCKET).list(`${userId}/elements`, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
    const list: Element[] = []
    for (const f of data || []) {
      const kind = kindOf(f.name, (f.metadata as { mimetype?: string } | null)?.mimetype || '')
      if (kind) list.push({ path: `${userId}/elements/${f.name}`, label: f.name.replace(/^\d+-[a-z0-9]{1,6}-/i, ''), kind })
    }
    setItems(list)
    if (list.length > 0) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(list.map((e) => e.path), 3600)
      const out: Record<string, string> = {}
      ;(signed || []).forEach((s) => { if (s.path && s.signedUrl) out[s.path] = s.signedUrl })
      setUrls(out)
    } else setUrls({})
    setLoading(false)
  }, [userId])

  useEffect(() => {
    const t = setTimeout(() => { void refresh() }, 0)
    const onChange = () => { void refresh() }
    window.addEventListener(ELEMENTS_CHANGED, onChange)
    return () => { clearTimeout(t); window.removeEventListener(ELEMENTS_CHANGED, onChange) }
  }, [refresh])

  const remove = async (e: Element) => {
    setConfirm(null)
    const { error } = await supabase.storage.from(BUCKET).remove([e.path])
    if (error) setMessage('Could not delete that one. Please try again.')
    else setMessage('')
    window.dispatchEvent(new Event(ELEMENTS_CHANGED))
  }

  return (
    <section aria-label="Overlay pictures and clips" style={{ marginTop: 28 }}>
      <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>Overlay pictures and clips</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>What you add from the overlay pop-up in the editor. Add more there and they show here straight away.</p>
      {message && <p role="alert" style={{ fontSize: 12, color: '#d92d20', margin: '0 0 8px' }}>{message}</p>}
      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nothing here yet. Open Overlay in the editor, press Add to library, and your pictures show up here.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
          {items.map((e) => (
            <div key={e.path} style={{ position: 'relative', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--card-bg)' }}>
              <div style={{ aspectRatio: '1 / 1', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {urls[e.path] && (e.kind === 'image'
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={urls[e.path]} alt={e.label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <video src={urls[e.path]} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />)}
              </div>
              <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.label}>{e.label}</span>
                {confirm === e.path ? (
                  <button type="button" onClick={() => { void remove(e) }} style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: '#d92d20', fontWeight: 700, cursor: 'pointer' }}>Delete?</button>
                ) : (
                  <button type="button" aria-label={`Delete ${e.label}`} onClick={() => setConfirm(e.path)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
