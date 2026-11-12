'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/components/Icon'
import {
  type LibraryClip, type LibraryPlan,
  deleteFromLibrary, formatBytes, isAudioFile, libraryClipToFileDetailed, listAudioLibrary, saveAudioToLibrary, signedUrls,
} from '@/lib/clipLibrary'

// Sent when a sound is added to or removed from the library, so open lists update straight away
export const AUDIO_LIBRARY_CHANGED = 'reelly-audio-library-changed'
export const announceAudioLibraryChanged = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUDIO_LIBRARY_CHANGED)) }

const fmtLength = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '')

function useAudioList(userId: string | null) {
  const [items, setItems] = useState<LibraryClip[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    if (!userId) return
    const list = await listAudioLibrary()
    setItems(list)
    setUrls(await signedUrls(list.map((c) => c.path)))
    setLoading(false)
  }, [userId])
  useEffect(() => {
    const t = setTimeout(() => { void refresh() }, 0)
    const on = () => { void refresh() }
    window.addEventListener(AUDIO_LIBRARY_CHANGED, on)
    return () => { clearTimeout(t); window.removeEventListener(AUDIO_LIBRARY_CHANGED, on) }
  }, [refresh])
  return { items, urls, loading, refresh }
}

const smallBtn = { fontSize: 12, fontWeight: 600, color: 'var(--ink)', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' } as const

// The sound files in the Library tab
export function AudioLibrary({ userId, plan }: { userId: string | null; plan: LibraryPlan }) {
  const { items, urls, loading, refresh } = useAudioList(userId)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const add = async (files: File[]) => {
    if (!userId) return
    const sounds = files.filter((f) => isAudioFile(f))
    if (sounds.length === 0) { setMessage('Choose an audio file, like an mp3, m4a or wav.'); return }
    setBusy(true)
    setMessage('')
    let why = ''
    for (const f of sounds) {
      const r = await saveAudioToLibrary(userId, f, plan)
      if (r.error) why = r.error
    }
    setBusy(false)
    setMessage(why)
    announceAudioLibraryChanged()
    void refresh()
  }

  const remove = async (c: LibraryClip) => {
    setConfirm(null)
    if (await deleteFromLibrary(c)) { announceAudioLibraryChanged(); void refresh() }
    else setMessage('Could not delete that sound. Please try again.')
  }

  return (
    <section aria-label="Audio in your library" style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Audio</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Voiceovers and recordings you have uploaded. Pick them from the Voiceover section when you edit.</p>
        </div>
        <input ref={inputRef} type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; void add(f) }} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} style={{ ...smallBtn, opacity: busy ? 0.6 : 1 }}>{busy ? 'Adding…' : '+ Add audio'}</button>
      </div>
      {message && <p role="alert" style={{ fontSize: 12, color: '#d92d20', margin: '0 0 10px' }}>{message}</p>}
      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>No audio yet. Add a file here, or upload a recording in the Voiceover section and it will be saved for you.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 4, padding: '10px 14px' }}>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{[formatBytes(c.size_bytes), fmtLength(c.duration)].filter(Boolean).join(' · ')}</p>
              </div>
              {urls[c.path] && <audio controls preload="none" src={urls[c.path]} style={{ height: 34, maxWidth: '100%' }} />}
              {confirm === c.id ? (
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <button type="button" onClick={() => void remove(c)} style={{ ...smallBtn, color: '#fff', background: '#d92d20', border: '1px solid #d92d20' }}>Delete</button>
                  <button type="button" onClick={() => setConfirm(null)} style={smallBtn}>Keep</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirm(c.id)} aria-label={`Delete ${c.name}`} style={smallBtn}>Delete</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// The picker for saved sounds. The Voiceover section uses it to pick a voiceover; the Audio section uses it for music,
// and also offers a file from the device and the sound from a video.
export function AudioPicker({ userId, onClose, onPick, title = 'Pick audio from your library', onPickFile, onExtract }: {
  userId: string | null
  onClose: () => void
  onPick: (file: File, clip: LibraryClip) => void
  title?: string
  onPickFile?: (file: File) => void
  onExtract?: (video: File) => void
}) {
  const { items, urls, loading } = useAudioList(userId)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  const use = async (c: LibraryClip) => {
    setWorking(c.id)
    setError('')
    const r = await libraryClipToFileDetailed(c)
    setWorking(null)
    if (!r.file) { setError(`Could not load that audio. Please try again.${r.error ? ` (${r.error})` : ''}`); return }
    onPick(r.file, c)
    onClose()
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div role="dialog" aria-label={title} onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg, #fff)', color: 'var(--ink)', borderRadius: 4, width: '100%', maxWidth: 560, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}><Icon n="close" /></button>
        </div>
        {(onPickFile || onExtract) && (
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {onPickFile && (
              <>
                <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { onPickFile(f); onClose() } }} />
                <button type="button" onClick={() => fileRef.current?.click()} style={{ ...smallBtn, padding: '9px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon n="upload" />Pick from files</button>
              </>
            )}
            {onExtract && (
              <>
                <input ref={videoRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { onExtract(f); onClose() } }} />
                <button type="button" onClick={() => videoRef.current?.click()} style={{ ...smallBtn, padding: '9px 14px', fontSize: 13 }}>Extract audio from video</button>
              </>
            )}
            <p style={{ flexBasis: '100%', margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {onExtract ? 'Extract audio takes the sound from a video on your device and uses it as your music. ' : ''}Or pick a saved sound below.
            </p>
          </div>
        )}
        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Loading your audio…</p>
          ) : items.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>You have no saved audio yet. Upload a recording and it is saved here for next time, or add files in the Library tab.</p>
          ) : items.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', border: '1px solid var(--line)', borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{[formatBytes(c.size_bytes), fmtLength(c.duration)].filter(Boolean).join(' · ')}</p>
              </div>
              {urls[c.path] && <audio controls preload="none" src={urls[c.path]} style={{ height: 32, maxWidth: '100%' }} />}
              <button type="button" onClick={() => void use(c)} disabled={working !== null} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: working ? 'not-allowed' : 'pointer', opacity: working && working !== c.id ? 0.5 : 1 }}>{working === c.id ? 'Adding…' : 'Use this'}</button>
            </div>
          ))}
          {error && <p role="alert" style={{ fontSize: 12, color: '#d92d20', margin: '4px 0 0' }}>{error}</p>}
        </div>
      </div>
    </div>,
    document.body
  )
}
