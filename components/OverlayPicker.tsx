'use client'

import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/components/Icon'
import { supabase } from '@/lib/supabase'

// Pictures and clips the person keeps to lay over their videos: logos, stickers, product shots, b-roll.
// They live in their own folder of the video storage, so no database change is needed.
const BUCKET = 'video-uploads'
const MAX_ELEMENT_BYTES = 50 * 1024 * 1024
const MAX_ELEMENTS = 100

type Element = { name: string; path: string; label: string; kind: 'image' | 'video'; mime: string; created: string }

const kindOf = (name: string, mime: string): 'image' | 'video' | null =>
  mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|svg)$/i.test(name) ? 'image'
    : mime.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(name) ? 'video'
      : null

// Takes off the number prefix added when the file was saved
const labelOf = (stored: string) => stored.replace(/^\d+-[a-z0-9]{1,6}-/i, '')

function useElements(userId: string | null) {
  const [items, setItems] = useState<Element[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.storage.from(BUCKET).list(`${userId}/elements`, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
    const list: Element[] = []
    for (const f of data || []) {
      const mime = (f.metadata as { mimetype?: string } | null)?.mimetype || ''
      const kind = kindOf(f.name, mime)
      if (!kind) continue
      list.push({ name: f.name, path: `${userId}/elements/${f.name}`, label: labelOf(f.name), kind, mime, created: f.created_at || '' })
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
    return () => clearTimeout(t)
  }, [refresh])

  return { items, urls, loading, refresh }
}

const tile: React.CSSProperties = { position: 'relative', aspectRatio: '1 / 1', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--sand)', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, color: 'var(--ink)', fontSize: 12, fontWeight: 600 }
// A grid of squares with a checkerboard behind them, so see-through logos show up
const checker: React.CSSProperties = { backgroundImage: 'linear-gradient(45deg, rgba(128,128,128,0.18) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.18) 75%), linear-gradient(45deg, rgba(128,128,128,0.18) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.18) 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0, 8px 8px' }

export default function OverlayPicker({ userId, logoUrl, onClose, onPick, onLogo }: {
  userId: string | null
  logoUrl: string | null | undefined
  onClose: () => void
  onPick: (file: File) => void
  onLogo: () => void
}) {
  const { items, urls, loading, refresh } = useElements(userId)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(0)
  const [working, setWorking] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = async (files: File[]) => {
    if (!userId) return
    setMessage('')
    let count = items.length
    const problems: string[] = []
    setBusy((n) => n + files.length)
    for (const f of files) {
      const kind = kindOf(f.name, f.type)
      if (!kind) problems.push(`${f.name}: only pictures and videos can be added.`)
      else if (f.size > MAX_ELEMENT_BYTES) problems.push(`${f.name}: over 50 MB. Try a smaller one.`)
      else if (count >= MAX_ELEMENTS) problems.push(`${f.name}: your library is full (${MAX_ELEMENTS}). Delete something first.`)
      else {
        const path = `${userId}/elements/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${f.name.replace(/[^\w.-]+/g, '_')}`
        const { error } = await supabase.storage.from(BUCKET).upload(path, f, f.type ? { contentType: f.type } : undefined)
        if (error) problems.push(`${f.name}: the upload did not finish.`)
        else count++
      }
      setBusy((n) => n - 1)
    }
    if (problems.length > 0) setMessage(problems.join(' '))
    await refresh()
  }

  const use = async (e: Element) => {
    setWorking(e.path)
    setMessage('')
    try {
      const url = urls[e.path]
      if (!url) throw new Error('no link')
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const blob = await res.blob()
      onPick(new File([blob], e.label, { type: e.mime || blob.type || (e.kind === 'image' ? 'image/png' : 'video/mp4') }))
      onClose()
    } catch {
      setWorking(null)
      setMessage('Could not load that one. Please try again.')
    }
  }

  const remove = async (e: Element) => {
    setConfirmDelete(null)
    const { error } = await supabase.storage.from(BUCKET).remove([e.path])
    if (error) setMessage('Could not delete that one. Please try again.')
    await refresh()
  }

  const q = search.trim().toLowerCase()
  const shown = items.filter((e) => e.label.toLowerCase().includes(q))

  if (typeof document === 'undefined') return null
  return createPortal(
    <div role="dialog" aria-label="Add to your video" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(ev) => ev.stopPropagation()} style={{ background: 'var(--card-bg, #fff)', color: 'var(--ink)', borderRadius: 8, width: '100%', maxWidth: 560, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Add to your video</p>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}><Icon n="close" /></button>
        </div>
        <div style={{ padding: '0 20px 12px' }}>
          <input type="search" value={search} onChange={(ev) => setSearch(ev.target.value)} placeholder="Search your library" aria-label="Search your library" style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sand)', color: 'var(--ink)' }} />
        </div>
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={(ev) => { void addFiles(Array.from(ev.target.files || [])); ev.target.value = '' }} />
        <div style={{ padding: '4px 20px 20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 10 }}>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy > 0} title="Add pictures or videos to your library" style={{ ...tile, borderStyle: 'dashed', cursor: busy > 0 ? 'wait' : 'pointer' }}>
              <span style={{ fontSize: 24, lineHeight: 1, color: 'var(--coral)' }}>+</span>
              {busy > 0 ? `Adding ${busy}…` : 'Add to library'}
            </button>
            {logoUrl ? (
              <button type="button" onClick={() => { onLogo(); onClose() }} title="Use the logo from your Settings" style={tile}>
                <span style={{ ...checker, position: 'absolute', inset: 0 }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="" style={{ position: 'relative', width: '70%', height: '70%', objectFit: 'contain' }} />
                <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '4px 6px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11 }}>My logo</span>
              </button>
            ) : (
              <a href="/settings" title="Upload your logo in Settings" style={{ ...tile, textDecoration: 'none', color: 'var(--text-muted)', textAlign: 'center', padding: 8, borderStyle: 'dashed' }}>No logo yet. Add one in Settings</a>
            )}
          </div>

          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 18 }}>Loading your library…</p>
          ) : items.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 18 }}>Nothing here yet. Press &quot;Add to library&quot; to keep pictures and clips you use a lot, like stickers, product shots and b-roll. Then add them to any video with one tap.</p>
          ) : (
            <>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: '18px 0 10px' }}>{q ? `Results (${shown.length})` : 'Recent'}</p>
              {shown.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing matches that search.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 10 }}>
                  {shown.map((e) => (
                    <div key={e.path} style={{ position: 'relative' }}>
                      <button type="button" onClick={() => void use(e)} disabled={working !== null} title={`Add ${e.label} to your video`} aria-label={`Add ${e.label} to your video`} style={{ ...tile, width: '100%', opacity: working && working !== e.path ? 0.5 : 1, cursor: working ? 'wait' : 'pointer' }}>
                        <span style={{ ...checker, position: 'absolute', inset: 0 }} />
                        {urls[e.path] && (e.kind === 'image'
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={urls[e.path]} alt="" style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain' }} />
                          : <video src={`${urls[e.path]}#t=0.1`} preload="metadata" muted playsInline style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />)}
                        {e.kind === 'video' && <span aria-hidden="true" style={{ position: 'absolute', left: 6, bottom: 6, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '1px 6px' }}>Video</span>}
                        {working === e.path && <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>Adding…</span>}
                      </button>
                      {confirmDelete === e.path ? (
                        <button type="button" onClick={() => void remove(e)} style={{ position: 'absolute', top: 4, right: 4, background: '#d92d20', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Delete?</button>
                      ) : (
                        <button type="button" onClick={() => setConfirmDelete(e.path)} aria-label={`Delete ${e.label} from your library`} title="Delete from library" style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 14, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><Icon n="close" /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {message && <p role="alert" style={{ fontSize: 12, color: '#d92d20', marginTop: 12, lineHeight: 1.5 }}>{message}</p>}
        </div>
      </div>
    </div>,
    document.body
  )
}
