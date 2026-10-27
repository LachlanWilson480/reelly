'use client'

import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  type LibraryClip, type LibraryAlbum, type LibraryPlan,
  createAlbum, deleteAlbum, deleteFromLibrary, formatBytes, isVideoName, libraryClipToFile, libraryLimitBytes, listAlbums, listLibrary, moveToAlbum, renameAlbum, renameInLibrary, saveToLibrary, signedUrls,
} from '@/lib/clipLibrary'

// Loads the person's clips and a preview link for each one
function useLibrary(userId: string | null) {
  const [clips, setClips] = useState<LibraryClip[]>([])
  const [albums, setAlbums] = useState<LibraryAlbum[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    const [list, albumList] = await Promise.all([listLibrary(), listAlbums()])
    setClips(list)
    setAlbums(albumList)
    setUrls(await signedUrls(list.map((c) => c.path)))
    setLoading(false)
  }, [userId])

  useEffect(() => {
    const t = setTimeout(() => { void refresh() }, 0)
    return () => clearTimeout(t)
  }, [refresh])

  return { clips, albums, urls, loading, refresh }
}

type View = 'all' | string
const inView = (c: LibraryClip, v: View) => v === 'all' ? true : c.album_id === v
// Newest first
const byDate = (a: LibraryClip, b: LibraryClip) => (b.created_at || '').localeCompare(a.created_at || '')

// A small dropdown in the site's style (instead of the browser's own select menu)
function PickMenu({ label, options, onPick }: { label: string; options: { value: string; label: string }[]; onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 20, border: open ? '1px solid var(--coral)' : '1px solid rgba(128,128,128,0.3)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {label}
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div role="listbox" aria-label={label} style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20, minWidth: 180, maxHeight: 260, overflowY: 'auto', background: 'var(--card-bg)', border: '1px solid rgba(128,128,128,0.25)', borderRadius: 14, padding: 6, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
          {options.map((o) => (
            <button key={o.value} type="button" role="option" aria-selected={false} onClick={() => { setOpen(false); onPick(o.value) }} className="lib-option" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 9, border: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}
const albumChip = (on: boolean): React.CSSProperties => ({ flexShrink: 0, padding: '7px 14px', borderRadius: 20, border: on ? '1px solid var(--coral)' : '1px solid rgba(128,128,128,0.3)', background: on ? 'rgba(255,106,77,0.1)' : 'var(--card-bg)', color: 'var(--ink)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' })

// The row of album buttons used in the Library tab and in the picker
function AlbumBar({ clips, albums, view, setView, onCreate }: { clips: LibraryClip[]; albums: LibraryAlbum[]; view: View; setView: (v: View) => void; onCreate?: (name: string) => Promise<void> }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const create = async () => {
    const n = name.trim()
    setAdding(false)
    setName('')
    if (n && onCreate) await onCreate(n)
  }
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, alignItems: 'center' }}>
      <button type="button" onClick={() => setView('all')} style={albumChip(view === 'all')}>All clips ({clips.length})</button>
      {albums.map((a) => (
        <button key={a.id} type="button" onClick={() => setView(a.id)} style={albumChip(view === a.id)}>{a.name} ({clips.filter((c) => c.album_id === a.id).length})</button>
      ))}
      {onCreate && (adding ? (
        <input autoFocus value={name} placeholder="Album name" onChange={(e) => setName(e.target.value)} onBlur={create} onKeyDown={(e) => { if (e.key === 'Enter') void create(); if (e.key === 'Escape') { setAdding(false); setName('') } }} style={{ flexShrink: 0, width: 150, fontSize: 12, padding: '7px 12px', borderRadius: 20, border: '1px solid var(--coral)', background: 'var(--card-bg)', color: 'var(--ink)' }} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} style={{ ...albumChip(false), borderStyle: 'dashed', color: 'var(--text-muted)' }}>+ New album</button>
      ))}
    </div>
  )
}

const fmtDuration = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '')

function Thumb({ url }: { url?: string }) {
  return url
    ? <video src={`${url}#t=0.1`} preload="metadata" muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#17151f', pointerEvents: 'none' }} />
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

// The Library tab: albums down the side, clips in a grid, upload and storage along the top
export default function ClipLibrary({ userId, plan, onPlans }: { userId: string | null; plan: LibraryPlan; onPlans?: () => void }) {
  const { clips, albums, urls, loading, refresh } = useLibrary(userId)
  const [view, setView] = useState<View>('all')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(0)
  const [message, setMessage] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const dragIds = useRef<string[]>([])
  const [albumRename, setAlbumRename] = useState(false)
  const [albumConfirmDelete, setAlbumConfirmDelete] = useState(false)
  const [newAlbum, setNewAlbum] = useState<string | null>(null)
  const [playing, setPlaying] = useState<LibraryClip | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const used = clips.reduce((n, c) => n + (c.size_bytes || 0), 0)
  const limit = libraryLimitBytes(plan)
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const currentAlbum = albums.find((a) => a.id === view)
  const sel = selected.filter((id) => clips.some((c) => c.id === id))
  const shown = clips.filter((c) => inView(c, view) && c.name.toLowerCase().includes(search.trim().toLowerCase())).sort(byDate)
  const viewTitle = view === 'all' ? 'All clips' : currentAlbum?.name || 'Album'

  const addFiles = async (files: File[]) => {
    if (!userId) return
    const vids = files.filter(isVideoName)
    if (vids.length === 0) { setMessage('Only video files can go in the library.'); return }
    setMessage('')
    let usedNow = used
    const problems: string[] = []
    setBusy((n) => n + vids.length)
    for (const f of vids) {
      const r = await saveToLibrary(userId, f, usedNow, limit, currentAlbum ? currentAlbum.id : null)
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

  const makeAlbum = async (name: string) => {
    setNewAlbum(null)
    const n = name.trim()
    if (!n || !userId) return
    const a = await createAlbum(userId, n)
    if (!a) { setMessage('Could not make that album. Make sure the albums update has been run in Supabase, then try again.'); return }
    setMessage('')
    await refresh()
    setView(a.id)
  }

  const saveAlbumName = async (a: LibraryAlbum, name: string) => {
    setAlbumRename(false)
    const n = name.trim()
    if (!n || n === a.name) return
    if (await renameAlbum(a.id, n)) await refresh()
  }

  const removeAlbum = async (a: LibraryAlbum) => {
    setAlbumConfirmDelete(false)
    if (await deleteAlbum(a.id)) { setView('all'); await refresh() }
    else setMessage('Could not delete that album. Please try again.')
  }

  const move = async (c: LibraryClip, albumId: string) => {
    if (await moveToAlbum(c.id, albumId || null)) await refresh()
    else setMessage('Could not move that clip. Make sure the albums update has been run in Supabase, then try again.')
  }

  const toggleSel = (id: string) => { setBulkConfirm(false); setSelected((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) }
  const clearSel = () => { setSelected([]); setBulkConfirm(false) }
  const moveMany = async (ids: string[], albumId: string | null) => {
    const results = await Promise.all(ids.map((id) => moveToAlbum(id, albumId)))
    if (results.some((ok) => !ok)) setMessage('Some clips could not be moved. Please try again.')
    else setMessage('')
    clearSel()
    await refresh()
  }
  const deleteMany = async (ids: string[]) => {
    const targets = clips.filter((c) => ids.includes(c.id))
    const results = await Promise.all(targets.map((c) => deleteFromLibrary(c)))
    if (results.some((ok) => !ok)) setMessage('Some clips could not be deleted. Please try again.')
    else setMessage('')
    clearSel()
    await refresh()
  }
  const goTo = (v: View) => { clearSel(); setView(v); setAlbumRename(false); setAlbumConfirmDelete(false); setSearch('') }
  const sideItem = (id: View, label: string, count: number) => (
    <button key={id} type="button" onClick={() => goTo(id)} aria-current={view === id}
      onDragOver={(e) => { if (dragIds.current.length === 0) return; e.preventDefault(); e.stopPropagation(); setDropTarget(id) }}
      onDragLeave={() => setDropTarget((t) => t === id ? null : t)}
      onDrop={(e) => { if (dragIds.current.length === 0) return; e.preventDefault(); e.stopPropagation(); const ids = dragIds.current; dragIds.current = []; setDropTarget(null); void moveMany(ids, id === 'all' ? null : id) }} className="lib-side-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none', background: dropTarget === id ? 'rgba(255,106,77,0.28)' : view === id ? 'rgba(255,106,77,0.12)' : 'transparent', outline: dropTarget === id ? '2px dashed var(--coral)' : 'none', color: view === id ? 'var(--coral)' : 'var(--ink)', fontSize: 13, fontWeight: view === id ? 700 : 500, cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{count}</span>
    </button>
  )
  const smallBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }

  return (
    <div style={{ maxWidth: 1180, margin: '32px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <input ref={inputRef} type="file" accept="video/*" multiple style={{ display: 'none' }} onChange={(e) => { void addFiles(Array.from(e.target.files || [])); e.target.value = '' }} />

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Clip library</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Upload a clip once, then use it in any video.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5, gap: 12 }}>
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{formatBytes(used)}</span>
              <span style={{ color: 'var(--text-muted)' }}>of {formatBytes(limit)}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(128,128,128,0.2)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(pct, used > 0 ? 2 : 0)}%`, height: '100%', background: pct >= 90 ? '#d92d20' : 'var(--coral)' }} />
            </div>
            {pct >= 90 && onPlans && plan !== 'top' && (
              <button type="button" onClick={onPlans} style={{ ...smallBtn, color: 'var(--coral)', fontWeight: 600, marginTop: 5 }}>Almost full. See plans with more space</button>
            )}
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy > 0} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 24, padding: '11px 22px', fontSize: 13, fontWeight: 700, cursor: busy > 0 ? 'not-allowed' : 'pointer', opacity: busy > 0 ? 0.65 : 1, whiteSpace: 'nowrap' }}>
            {busy > 0 ? `Uploading ${busy}…` : '+ Upload clips'}
          </button>
        </div>
      </div>

      {message && <p role="alert" style={{ fontSize: 12, color: '#d92d20', margin: 0, lineHeight: 1.5 }}>{message}</p>}

      <div className="lib-layout">
        <nav className="lib-side" aria-label="Albums">
          <p className="lib-side-title" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 6px 12px' }}>Albums</p>
          {sideItem('all', 'All clips', clips.length)}
          {albums.map((a) => sideItem(a.id, a.name, clips.filter((c) => c.album_id === a.id).length))}
          {newAlbum !== null ? (
            <input autoFocus value={newAlbum} placeholder="Album name" onChange={(e) => setNewAlbum(e.target.value)} onBlur={() => makeAlbum(newAlbum)} onKeyDown={(e) => { if (e.key === 'Enter') void makeAlbum(newAlbum); if (e.key === 'Escape') setNewAlbum(null) }} style={{ flexShrink: 0, width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--coral)', background: 'var(--card-bg)', color: 'var(--ink)', outline: 'none' }} />
          ) : (
            <button type="button" onClick={() => setNewAlbum('')} style={{ flexShrink: 0, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px dashed rgba(128,128,128,0.35)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap' }}>+ New album</button>
          )}
        </nav>

        <section
          onDragOver={(e) => { if (dragIds.current.length > 0) return; e.preventDefault(); setDragOver(true) }}
          onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false) }}
          onDrop={(e) => { if (dragIds.current.length > 0) return; e.preventDefault(); setDragOver(false); void addFiles(Array.from(e.dataTransfer.files || [])) }}
          style={{ minWidth: 0, position: 'relative', minHeight: 320, borderRadius: 16, outline: dragOver ? '2px dashed var(--coral)' : 'none', outlineOffset: 6 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
              {albumRename && currentAlbum ? (
                <input autoFocus defaultValue={currentAlbum.name} onBlur={(e) => saveAlbumName(currentAlbum, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setAlbumRename(false) }} style={{ fontSize: 16, fontWeight: 700, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--coral)', background: 'var(--card-bg)', color: 'var(--ink)' }} />
              ) : (
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{viewTitle}</h3>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{shown.length} {shown.length === 1 ? 'clip' : 'clips'}</span>
              {currentAlbum && (
                albumConfirmDelete ? (
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Clips stay in the library.</span>
                    <button type="button" onClick={() => removeAlbum(currentAlbum)} style={{ ...smallBtn, fontWeight: 700, color: '#d92d20' }}>Delete album</button>
                    <button type="button" onClick={() => setAlbumConfirmDelete(false)} style={smallBtn}>Keep</button>
                  </span>
                ) : (
                  <span style={{ display: 'flex', gap: 12 }}>
                    <button type="button" onClick={() => setAlbumRename(true)} style={smallBtn}>Rename</button>
                    <button type="button" onClick={() => setAlbumConfirmDelete(true)} style={smallBtn}>Delete album</button>
                  </span>
                )
              )}
            </div>
            {clips.length > 0 && (
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clips" aria-label="Search clips" style={{ fontSize: 13, padding: '8px 14px', borderRadius: 20, border: '1px solid rgba(128,128,128,0.3)', background: 'var(--card-bg)', color: 'var(--ink)', width: 200, maxWidth: '100%' }} />
            )}
          </div>

          {sel.length > 0 && (
            <div role="toolbar" aria-label="Selected clips" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'rgba(255,106,77,0.1)', border: '1px solid rgba(255,106,77,0.35)', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{sel.length} selected</span>
              <button type="button" onClick={() => setSelected(shown.map((c) => c.id))} style={smallBtn}>Select all</button>
              <PickMenu label="Move to…" onPick={(v) => void moveMany(sel, v === '__all' ? null : v)} options={[{ value: '__all', label: 'All clips only' }, ...albums.map((a) => ({ value: a.id, label: a.name }))]} />
              {bulkConfirm ? (
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Delete {sel.length} {sel.length === 1 ? 'clip' : 'clips'} for good?</span>
                  <button type="button" onClick={() => void deleteMany(sel)} style={{ ...smallBtn, fontWeight: 700, color: '#d92d20' }}>Delete</button>
                  <button type="button" onClick={() => setBulkConfirm(false)} style={smallBtn}>Keep</button>
                </span>
              ) : (
                <button type="button" onClick={() => setBulkConfirm(true)} style={{ ...smallBtn, color: '#d92d20', fontWeight: 600 }}>Delete</button>
              )}
              <button type="button" onClick={clearSel} style={{ ...smallBtn, marginLeft: 'auto' }}>Clear</button>
            </div>
          )}
          {!loading && shown.length > 0 && sel.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>Tick clips to move or delete them, or drag a clip onto an album.</p>}

          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading your clips…</p>
          ) : shown.length === 0 ? (
            <div style={{ border: '2px dashed rgba(128,128,128,0.3)', borderRadius: 16, padding: '56px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px' }}>{search ? 'No clips match that search' : clips.length === 0 ? 'Your library is empty' : 'Nothing in here yet'}</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>{search ? 'Try a different name.' : <>Drag videos here, or press &quot;Save to library&quot; on a clip in the editor.</>}</p>
              {!search && <button type="button" onClick={() => inputRef.current?.click()} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 24, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{currentAlbum ? `+ Upload to ${currentAlbum.name}` : '+ Upload clips'}</button>}
            </div>
          ) : (
            <div className="lib-grid">
              {shown.map((c) => (
                <div key={c.id} draggable
                  onDragStart={(e) => { dragIds.current = sel.includes(c.id) ? sel : [c.id]; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'reelly-clips') }}
                  onDragEnd={() => { dragIds.current = []; setDropTarget(null) }}
                  style={{ position: 'relative', background: 'var(--card-bg)', borderRadius: 14, overflow: 'hidden', border: sel.includes(c.id) ? '2px solid var(--coral)' : '1px solid rgba(128,128,128,0.15)', boxShadow: sel.includes(c.id) ? '0 0 0 3px rgba(255,106,77,0.25)' : 'none', display: 'flex', flexDirection: 'column' }}>
                  <button type="button" role="checkbox" aria-checked={sel.includes(c.id)} aria-label={`Select ${c.name}`} onClick={() => toggleSel(c.id)} style={{ position: 'absolute', top: 10, left: 10, zIndex: 2, width: 18, height: 18, borderRadius: 5, border: sel.includes(c.id) ? '1.5px solid var(--coral)' : '1.5px solid rgba(255,255,255,0.9)', background: sel.includes(c.id) ? 'var(--coral)' : 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', transition: 'background 0.15s ease, border-color 0.15s ease' }}>{sel.includes(c.id) && <svg width="9" height="8" viewBox="0 0 12 10" aria-hidden="true"><path d="M1.5 5.2l3 3 6-6.4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}</button>
                  <button type="button" onClick={() => setPlaying(c)} aria-label={`Play ${c.name}`} style={{ position: 'relative', display: 'block', width: '100%', aspectRatio: '3 / 4', padding: 0, border: 'none', background: '#17151f', cursor: 'pointer', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0 }}><Thumb url={urls[c.path]} /></div>
                    <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 }}>▶</span>
                    {c.duration ? <span style={{ position: 'absolute', right: 8, bottom: 8, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 10, padding: '2px 8px' }}>{fmtDuration(c.duration)}</span> : null}
                  </button>
                  <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      {renaming === c.id ? (
                        <input autoFocus value={renameText} onChange={(e) => setRenameText(e.target.value)} onBlur={() => finishRename(c)} onKeyDown={(e) => { if (e.key === 'Enter') void finishRename(c); if (e.key === 'Escape') setRenaming(null) }} style={{ fontSize: 13, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--coral)', background: 'var(--card-bg)', color: 'var(--ink)', width: '100%', boxSizing: 'border-box' }} />
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.name}>{c.name}</p>
                      )}
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{formatBytes(c.size_bytes)}</p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button type="button" onClick={() => { setRenaming(c.id); setRenameText(c.name) }} style={smallBtn}>Rename</button>
                      {confirmDelete === c.id ? (
                        <span style={{ display: 'flex', gap: 8 }}>
                          <button type="button" onClick={() => remove(c)} style={{ ...smallBtn, fontWeight: 700, color: '#d92d20' }}>Delete</button>
                          <button type="button" onClick={() => setConfirmDelete(null)} style={smallBtn}>Keep</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirmDelete(c.id)} style={smallBtn}>Delete</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {playing && typeof document !== 'undefined' && createPortal(
        <div role="dialog" aria-label={playing.name} onClick={() => setPlaying(null)} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: 'min(92vw, 420px)', width: '100%' }}>
            <video src={urls[playing.path]} controls autoPlay playsInline style={{ width: '100%', maxHeight: '82vh', borderRadius: 14, background: '#000', display: 'block' }} />
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: '10px 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playing.name}</p>
            <button type="button" onClick={() => setPlaying(null)} aria-label="Close" style={{ position: 'absolute', top: -14, right: -14, width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#fff', color: '#111', fontSize: 20, lineHeight: 1, cursor: 'pointer' }}>×</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// The picker opened from the editors: choose clips from the library to add to the video
export function LibraryPicker({ userId, onClose, onAdd, single, title }: { userId: string | null; onClose: () => void; onAdd: (files: File[]) => void; single?: boolean; title?: string }) {
  const { clips, albums, urls, loading } = useLibrary(userId)
  const [view, setView] = useState<View>('all')
  const [picked, setPicked] = useState<string[]>([])
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id: string) => setPicked((p) => (single ? (p.includes(id) ? [] : [id]) : p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

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
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title || 'Add from library'}</p>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
          {clips.length > 0 && albums.length > 0 && (
            <div style={{ marginBottom: 14 }}><AlbumBar clips={clips} albums={albums} view={view} setView={setView} /></div>
          )}
          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading your clips…</p>
          ) : clips.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Your library is empty. Add clips in the Library tab, or press &quot;Save to library&quot; on a clip.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {clips.filter((c) => inView(c, view)).sort(byDate).map((c) => {
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
            {working ? 'Adding…' : picked.length === 0 ? (single ? 'Choose a clip' : 'Choose clips') : single ? 'Use this clip' : `Add ${picked.length} ${picked.length === 1 ? 'clip' : 'clips'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// A small "Save to library" button for a clip in the editors
export function SaveToLibraryButton({ userId, plan, getFile, dark }: { userId: string | null; plan: LibraryPlan; getFile: () => File | null; dark?: boolean }) {
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
      <button type="button" onClick={save} disabled={state === 'saving' || state === 'saved'} style={dark ? { fontSize: 13, fontWeight: 600, color: state === 'saved' ? '#34c759' : '#fff', background: 'transparent', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 50, padding: '13px 18px', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', cursor: state === 'saving' || state === 'saved' ? 'default' : 'pointer' } : { fontSize: 11, color: state === 'saved' ? '#1a9d4a' : 'var(--text-muted)', background: 'none', border: '1px solid rgba(128,128,128,0.25)', borderRadius: 6, padding: '3px 8px', cursor: state === 'saving' || state === 'saved' ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved to library ✓' : 'Save to library'}
      </button>
      {state === 'error' && <span role="alert" style={{ fontSize: 11, color: dark ? '#ff8a80' : '#d92d20' }}>{msg}</span>}
    </span>
  )
}
