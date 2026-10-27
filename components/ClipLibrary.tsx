'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  type LibraryClip, type LibraryPlan,
  deleteFromLibrary, formatBytes, isVideoName, libraryClipToFile, libraryLimitBytes, listLibrary, renameInLibrary, saveToLibrary, signedUrls,
} from '@/lib/clipLibrary'

// Loads the person's clips and a preview link for each one
function useLibrary(userId: string | null) {
  const [clips, setClips] = useState<LibraryClip[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    const list = await listLibrary()
    setClips(list)
    setUrls(await signedUrls(list.map((c) => c.path)))
    setLoading(false)
  }, [userId])

  useEffect(() => {
    const t = setTimeout(() => { void refresh() }, 0)
    return () => clearTimeout(t)
  }, [refresh])

  return { clips, urls, loading, refresh }
}

const fmtDuration = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '')

function Thumb({ url }: { url?: string }) {
  return url
    ? <video src={`${url}#t=0.1`} preload="metadata" muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#17151f' }} />
    : <div style={{ width: '100%', height: '100%', background: '#17151f' }} />
}

function StorageBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100))
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{formatBytes(used)} used</span>
        <span style={{ color: 'var(--text-muted)' }}>{formatBytes(limit)} on your plan</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'rgba(128,128,128,0.18)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 90 ? '#d92d20' : 'var(--coral)' }} />
      </div>
    </div>
  )
}

// The Library tab: upload, rename and delete clips
export default function ClipLibrary({ userId, plan, onPlans }: { userId: string | null; plan: LibraryPlan; onPlans?: () => void }) {
  const { clips, urls, loading, refresh } = useLibrary(userId)
  const [busy, setBusy] = useState(0)
  const [message, setMessage] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const used = clips.reduce((n, c) => n + (c.size_bytes || 0), 0)
  const limit = libraryLimitBytes(plan)

  const addFiles = async (files: File[]) => {
    if (!userId) return
    const vids = files.filter(isVideoName)
    if (vids.length === 0) { setMessage('Only video files can go in the library.'); return }
    setMessage('')
    let usedNow = used
    const problems: string[] = []
    setBusy((n) => n + vids.length)
    for (const f of vids) {
      const r = await saveToLibrary(userId, f, usedNow, limit)
      if (r.clip) usedNow += r.clip.size_bytes
      else if (r.error) problems.push(`${f.name}: ${r.error}`)
      setBusy((n) => n - 1)
    }
    if (problems.length > 0) setMessage(problems.join(' '))
    await refresh()
  }

  const finishRename = async (c: LibraryClip) => {
    const name = renameText.trim()
    setRenaming(null)
    if (!name || name === c.name) return
    if (await renameInLibrary(c.id, name)) await refresh()
  }

  const remove = async (c: LibraryClip) => {
    setConfirmDelete(null)
    if (await deleteFromLibrary(c)) await refresh()
    else setMessage('Could not delete that clip. Please try again.')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100, margin: '32px auto', padding: '0 24px' }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Clip library</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Upload a clip once, then add it to any video from the editor.</p>
      </div>

      <div style={{ background: 'var(--sand)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <StorageBar used={used} limit={limit} />
        {used / limit >= 0.9 && onPlans && plan !== 'top' && (
          <button type="button" onClick={onPlans} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--coral)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Almost full. See plans with more space</button>
        )}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(Array.from(e.dataTransfer.files || [])) }}
          style={{ border: `2px dashed ${dragOver ? 'var(--coral)' : 'rgba(128,128,128,0.3)'}`, borderRadius: 12, padding: '22px 16px', textAlign: 'center', background: dragOver ? 'rgba(255,106,77,0.06)' : 'transparent' }}
        >
          <input ref={inputRef} type="file" accept="video/*" multiple style={{ display: 'none' }} onChange={(e) => { void addFiles(Array.from(e.target.files || [])); e.target.value = '' }} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy > 0} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 24, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: busy > 0 ? 'not-allowed' : 'pointer', opacity: busy > 0 ? 0.6 : 1 }}>
            {busy > 0 ? `Uploading ${busy} ${busy === 1 ? 'clip' : 'clips'}…` : '+ Upload clips'}
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>or drag and drop videos here</p>
        </div>
        {message && <p role="alert" style={{ fontSize: 12, color: '#d92d20', margin: 0, lineHeight: 1.5 }}>{message}</p>}
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading your clips…</p>
      ) : clips.length === 0 ? (
        <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '36px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px' }}>No clips yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Upload clips above, or press &quot;Save to library&quot; on a clip in the editor.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
          {clips.map((c) => (
            <div key={c.id} style={{ background: 'var(--card-bg)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(128,128,128,0.15)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', aspectRatio: '16 / 10', background: '#17151f' }}>
                <Thumb url={urls[c.path]} />
                {c.duration ? <span style={{ position: 'absolute', right: 8, bottom: 8, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 10, padding: '2px 8px' }}>{fmtDuration(c.duration)}</span> : null}
              </div>
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {renaming === c.id ? (
                  <input autoFocus value={renameText} onChange={(e) => setRenameText(e.target.value)} onBlur={() => finishRename(c)} onKeyDown={(e) => { if (e.key === 'Enter') void finishRename(c); if (e.key === 'Escape') setRenaming(null) }} style={{ fontSize: 13, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--coral)', background: 'var(--card-bg)', color: 'var(--ink)', width: '100%', boxSizing: 'border-box' }} />
                ) : (
                  <button type="button" onClick={() => { setRenaming(c.id); setRenameText(c.name) }} title="Rename" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatBytes(c.size_bytes)}</span>
                  {confirmDelete === c.id ? (
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button type="button" onClick={() => remove(c)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, fontWeight: 700, color: '#d92d20', cursor: 'pointer' }}>Delete</button>
                      <button type="button" onClick={() => setConfirmDelete(null)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>Keep</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(c.id)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// The picker opened from the editors: choose clips from the library to add to the video
export function LibraryPicker({ userId, onClose, onAdd }: { userId: string | null; onClose: () => void; onAdd: (files: File[]) => void }) {
  const { clips, urls, loading } = useLibrary(userId)
  const [picked, setPicked] = useState<string[]>([])
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const add = async () => {
    setWorking(true)
    setError('')
    const files: File[] = []
    for (const id of picked) {
      const clip = clips.find((c) => c.id === id)
      const f = clip ? await libraryClipToFile(clip) : null
      if (f) files.push(f)
    }
    setWorking(false)
    if (files.length === 0) { setError('Could not load those clips. Please try again.'); return }
    onAdd(files)
    onClose()
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div role="dialog" aria-label="Add from library" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg, #fff)', color: 'var(--ink)', borderRadius: 18, width: '100%', maxWidth: 760, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(128,128,128,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Add from library</p>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading your clips…</p>
          ) : clips.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Your library is empty. Add clips in the Library tab, or press &quot;Save to library&quot; on a clip.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {clips.map((c) => {
                const on = picked.includes(c.id)
                return (
                  <button key={c.id} type="button" onClick={() => toggle(c.id)} aria-pressed={on} style={{ padding: 0, textAlign: 'left', background: 'var(--sand)', border: on ? '2px solid var(--coral)' : '2px solid transparent', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}>
                    <div style={{ position: 'relative', aspectRatio: '16 / 10', background: '#17151f' }}>
                      <Thumb url={urls[c.path]} />
                      {on && <span style={{ position: 'absolute', left: 8, top: 8, width: 22, height: 22, borderRadius: '50%', background: 'var(--coral)', color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{picked.indexOf(c.id) + 1}</span>}
                      {c.duration ? <span style={{ position: 'absolute', right: 6, bottom: 6, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 7px' }}>{fmtDuration(c.duration)}</span> : null}
                    </div>
                    <p style={{ margin: 0, padding: '7px 9px', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{c.name}</p>
                  </button>
                )
              })}
            </div>
          )}
          {error && <p role="alert" style={{ fontSize: 12, color: '#d92d20', marginTop: 12 }}>{error}</p>}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(128,128,128,0.15)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ background: 'none', border: '1px solid rgba(128,128,128,0.35)', borderRadius: 24, padding: '9px 18px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={add} disabled={picked.length === 0 || working} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 24, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: picked.length === 0 || working ? 'not-allowed' : 'pointer', opacity: picked.length === 0 || working ? 0.55 : 1 }}>
            {working ? 'Adding…' : picked.length === 0 ? 'Choose clips' : `Add ${picked.length} ${picked.length === 1 ? 'clip' : 'clips'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// A small "Save to library" button for a clip in the editors
export function SaveToLibraryButton({ userId, plan, getFile }: { userId: string | null; plan: LibraryPlan; getFile: () => File | null }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const save = async () => {
    const f = getFile()
    if (!userId || !f) return
    setState('saving')
    setMsg('')
    const clips = await listLibrary()
    const used = clips.reduce((n, c) => n + (c.size_bytes || 0), 0)
    const r = await saveToLibrary(userId, f, used, libraryLimitBytes(plan))
    if (r.clip) setState('saved')
    else { setState('error'); setMsg(r.error || 'Could not save.') }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button type="button" onClick={save} disabled={state === 'saving' || state === 'saved'} style={{ fontSize: 11, color: state === 'saved' ? '#1a9d4a' : 'var(--text-muted)', background: 'none', border: '1px solid rgba(128,128,128,0.25)', borderRadius: 6, padding: '3px 8px', cursor: state === 'saving' || state === 'saved' ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved to library ✓' : 'Save to library'}
      </button>
      {state === 'error' && <span role="alert" style={{ fontSize: 11, color: '#d92d20' }}>{msg}</span>}
    </span>
  )
}
