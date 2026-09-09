'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

type ClipItem = {
  id: string
  file?: File
  path?: string
  name: string
  trimStart: number
  trimLength: number
  duration: number
  previewUrl: string | null
  muted: boolean
  volume: number
  fit: 'crop' | 'cover' | 'contain'
  position: string
  speed: number
  filter: 'none' | 'boost' | 'contrast' | 'darken' | 'greyscale' | 'lighten' | 'muted' | 'negative'
  rotate: number
  flipH: boolean
  flipV: boolean
  letterbox: boolean
}

const FONT_OPTIONS = ['Montserrat ExtraBold', 'Inter', 'Roboto', 'Poppins', 'Oswald']
const CAPTION_PRESETS = [
  { id: 'word_by_word', label: 'Word by Word', desc: 'One word pops as it is spoken (karaoke)' },
  { id: 'bold_center', label: 'Bold Pop', desc: 'Large, punchy, scales on each word' },
  { id: 'coral_pop', label: 'Coral Bounce', desc: 'On-brand coral, bouncy' },
  { id: 'minimal_bottom', label: 'Minimal', desc: 'Subtle fade-in, out of the way' },
  { id: 'typewriter', label: 'Typewriter', desc: 'Words build up in sequence' },
]

const PIXELS_PER_SECOND = 30

const CSS_FILTER_MAP: Record<string, string> = {
  none: 'none',
  boost: 'contrast(1.2) saturate(1.4)',
  contrast: 'contrast(1.4)',
  darken: 'brightness(0.7)',
  lighten: 'brightness(1.3)',
  greyscale: 'grayscale(1)',
  muted: 'saturate(0.4) contrast(0.9)',
  negative: 'invert(1)',
}
export default function EditorPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const musicInputRef = useRef<HTMLInputElement>(null)
  const videoRefA = useRef<HTMLVideoElement>(null)
  const videoRefB = useRef<HTMLVideoElement>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [clips, setClips] = useState<ClipItem[]>([])
  const [playingIndex, setPlayingIndex] = useState(0)
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A')
  const [speechClipIndices, setSpeechClipIndices] = useState<Set<number>>(new Set([0]))
  const [captionPreset, setCaptionPreset] = useState('bold_center')
  const [captionsOpen, setCaptionsOpen] = useState(true)
  const [showAdvancedCaptions, setShowAdvancedCaptions] = useState(false)
  const [captionFontFamily, setCaptionFontFamily] = useState('Montserrat ExtraBold')
  const [captionFontSize, setCaptionFontSize] = useState(36)
  const [captionColor, setCaptionColor] = useState('#FFFFFF')
  const [captionPosition, setCaptionPosition] = useState<'bottom' | 'top' | 'center'>('bottom')
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [musicPath, setMusicPath] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isTrimming, setIsTrimming] = useState(false)
  const [editingClipId, setEditingClipId] = useState<string | null>(null)

  const [rendering, setRendering] = useState(false)
  const [renderId, setRenderId] = useState<string | null>(null)
  const [renderStatus, setRenderStatus] = useState<string | null>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  const dragState = useRef<{ clipId: string; edge: 'start' | 'end'; startX: number; origTrimStart: number; origTrimLength: number } | null>(null)

  useEffect(() => {
    const resetInteracting = () => setIsTrimming(false)
    window.addEventListener('mouseup', resetInteracting)
    return () => window.removeEventListener('mouseup', resetInteracting)
  }, [])
  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getUser()
      const user = sessionData.user
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      const seeded = localStorage.getItem('reelly-editor-seed')
      if (seeded) {
        try {
          const parsed = JSON.parse(seeded)
          if (parsed.clipPaths) {
            const seededClips: ClipItem[] = await Promise.all(
              parsed.clipPaths.map(async (path: string, i: number) => {
                const { data } = await supabase.storage.from('video-uploads').createSignedUrl(path, 3600)
                return {
                  id: `${i}-${path}`,
                  path,
                  name: path.split('/').pop() || `Clip ${i + 1}`,
                  trimStart: 0,
                  trimLength: 0,
                  muted: false,
                  volume: 1,
                  fit: 'crop',
                  position: 'center',
                  speed: 1,
                  filter: 'none',
                  rotate: 0,
                  flipH: false,
                  flipV: false,
                  letterbox: false,
                  duration: 0,
                  previewUrl: data?.signedUrl || null,
                }
              })
            )
            setClips(seededClips)
          }
          if (Array.isArray(parsed.speechClipIndices)) setSpeechClipIndices(new Set(parsed.speechClipIndices))
          else if (typeof parsed.speechClipIndex === 'number') setSpeechClipIndices(new Set([parsed.speechClipIndex]))
          if (parsed.captionStyle) {
            const preset = typeof parsed.captionStyle === 'string' ? parsed.captionStyle : parsed.captionStyle.preset
            if (preset) setCaptionPreset(preset)
          }
          if (parsed.musicPath) setMusicPath(parsed.musicPath)
        } catch {
          // ignore malformed seed
        }
        localStorage.removeItem('reelly-editor-seed')
      }

      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    if (!renderId || renderStatus === 'done' || renderStatus === 'failed') return
    const interval = setInterval(async () => {
      const res = await fetch('/api/render-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renderId }),
      })
      const data = await res.json()
      setRenderStatus(data.status)
      if (data.outputUrl) setOutputUrl(data.outputUrl)
    }, 4000)
    return () => clearInterval(interval)
  }, [renderId, renderStatus])

  // Double-buffered playback: the active video element plays the current clip.
  // The inactive one silently preloads the next clip so switching is instant, with no reload pause.
  useEffect(() => {
    if (clips.length === 0) return

    const activeEl = activeSlot === 'A' ? videoRefA.current : videoRefB.current
    const inactiveEl = activeSlot === 'A' ? videoRefB.current : videoRefA.current
    if (!activeEl) return

    const clip = clips[playingIndex]
    if (!clip?.previewUrl) return

    if (activeEl.src !== clip.previewUrl) {
      activeEl.src = clip.previewUrl
    }
    activeEl.currentTime = clip.trimStart || 0
    activeEl.play().catch(() => {})

    // Apply live preview of mute/volume/speed/rotate/flip/filter for this clip
    activeEl.muted = clip.muted
    activeEl.volume = clip.volume
    activeEl.playbackRate = clip.speed
    const flipX = clip.flipH ? -1 : 1
    const flipY = clip.flipV ? -1 : 1
    activeEl.style.transform = `rotate(${clip.rotate}deg) scaleX(${flipX}) scaleY(${flipY})`
    activeEl.style.filter = CSS_FILTER_MAP[clip.filter] || 'none'
    // Preload the next clip into the inactive element, ready to swap instantly
    const nextIndex = (playingIndex + 1) % clips.length
    const nextClip = clips[nextIndex]
    if (inactiveEl && nextClip?.previewUrl) {
      if (inactiveEl.src !== nextClip.previewUrl) {
        inactiveEl.src = nextClip.previewUrl
        inactiveEl.load()
      }
      inactiveEl.currentTime = nextClip.trimStart || 0
    }

    const advance = () => {
      setPlayingIndex((prev) => (prev + 1) % clips.length)
      setActiveSlot((prev) => (prev === 'A' ? 'B' : 'A'))
    }
    const handleTimeUpdate = () => {
      const endTime = clip.trimLength > 0 ? (clip.trimStart || 0) + clip.trimLength : null
      if (endTime && activeEl.currentTime >= endTime) advance()
    }
    const handleEnded = () => advance()

    activeEl.addEventListener('timeupdate', handleTimeUpdate)
    activeEl.addEventListener('ended', handleEnded)
    return () => {
      activeEl.removeEventListener('timeupdate', handleTimeUpdate)
      activeEl.removeEventListener('ended', handleEnded)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingIndex, activeSlot, clips])

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const newClips: ClipItem[] = Array.from(e.target.files).map((file, i) => ({
      id: `${Date.now()}-${i}`,
      file,
      name: file.name,
      trimStart: 0,
      trimLength: 0,
      muted: false,
      volume: 1,
      fit: "crop",
      position: "center",
      speed: 1,
      filter: "none",
      rotate: 0,
      flipH: false,
      flipV: false,
      letterbox: false,
      duration: 0,
      previewUrl: URL.createObjectURL(file),
    }))
    setClips((prev) => [...prev, ...newClips])
    setPanelOpen(true)
  }
  const handleLoadedMetadata = (clipId: string, e: React.SyntheticEvent<HTMLVideoElement>) => {
    const dur = e.currentTarget.duration
    setClips((prev) => prev.map((c) => (c.id === clipId ? { ...c, duration: dur } : c)))
  }

  const reorderClips = (fromIndex: number, toIndex: number) => {
    setClips((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  const updateClipSetting = <K extends keyof ClipItem>(clipId: string, field: K, value: ClipItem[K]) => {
    setClips((prev) => prev.map((c) => (c.id === clipId ? { ...c, [field]: value } : c)))
  }
  const moveClip = (index: number, direction: -1 | 1) => {
    setClips((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const removeClip = (index: number) => {
    setClips((prev) => {
      const removed = prev[index]
      if (removed?.previewUrl && removed.file) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
    setSpeechClipIndices((prev) => { const next = new Set(prev); next.delete(index); return next })
    setPlayingIndex(0)
    setActiveSlot('A')
  }

  const handleDragStart = (clipId: string, edge: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation()
    setIsTrimming(true)
    const clip = clips.find((c) => c.id === clipId)
    if (!clip) return
    dragState.current = {
      clipId,
      edge,
      startX: e.clientX,
      origTrimStart: clip.trimStart,
      origTrimLength: clip.trimLength > 0 ? clip.trimLength : clip.duration,
    }
    window.addEventListener('mousemove', handleDragMove)
    window.addEventListener('mouseup', handleDragEnd)
  }

  const handleDragMove = useCallback((e: MouseEvent) => {
    const drag = dragState.current
    if (!drag) return
    const deltaSeconds = (e.clientX - drag.startX) / PIXELS_PER_SECOND

    setClips((prev) =>
      prev.map((c) => {
        if (c.id !== drag.clipId) return c
        if (drag.edge === 'start') {
          const origEnd = drag.origTrimStart + drag.origTrimLength
          const newStart = Math.max(0, Math.min(drag.origTrimStart + deltaSeconds, origEnd - 0.1))
          const newLength = origEnd - newStart
          return { ...c, trimStart: newStart, trimLength: newLength }
        } else {
          const newLength = Math.max(0.1, Math.min(drag.origTrimLength + deltaSeconds, c.duration - c.trimStart))
          return { ...c, trimLength: newLength }
        }
      })
    )
  }, [])

  const handleDragEnd = useCallback(() => {
    setIsTrimming(false)
    dragState.current = null
    window.removeEventListener('mousemove', handleDragMove)
    window.removeEventListener('mouseup', handleDragEnd)
  }, [handleDragMove])

  const handleRender = async () => {
    if (!userId || clips.length === 0) return
    setRendering(true)
    setError('')
    setRenderId(null)
    setRenderStatus(null)
    setOutputUrl(null)

    try {
      const clipPaths: string[] = []

      for (const clip of clips) {
        if (clip.path) {
          clipPaths.push(clip.path)
        } else if (clip.file) {
          const path = `${userId}/${Date.now()}-${clip.file.name}`
          const { error: uploadError } = await supabase.storage.from('video-uploads').upload(path, clip.file)
          if (uploadError) throw new Error(uploadError.message)
          clipPaths.push(path)
        }
      }

      let finalMusicPath = musicPath
      if (musicFile) {
        const mPath = `${userId}/music-${Date.now()}-${musicFile.name}`
        const { error: musicError } = await supabase.storage.from('video-uploads').upload(mPath, musicFile)
        if (!musicError) finalMusicPath = mPath
      }

      const clipTrims = clips.map((c) => ({ trimStart: c.trimStart, trimLength: c.trimLength, duration: c.duration }))
      const clipSettings = clips.map((c) => ({ muted: c.muted, volume: c.volume, fit: c.fit, position: c.position, speed: c.speed, filter: c.filter, rotate: c.rotate, flipH: c.flipH, flipV: c.flipV, letterbox: c.letterbox }))
      const captionStyle = showAdvancedCaptions
        ? {
            preset: captionPreset,
            custom: {
              font: { family: captionFontFamily, size: captionFontSize, color: captionColor },
              position: captionPosition,
            },
          }
        : captionPreset
      const res = await fetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          clipPaths,
          captionStyle,
          musicPath: finalMusicPath,
          speechClipIndices: Array.from(speechClipIndices),
          clipTrims,
          clipSettings,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Render failed to start')

      setRenderId(data.renderId)
      setRenderStatus('queued')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setRendering(false)
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }} />
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)', display: 'flex', height: '100vh' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <nav className="dashboard-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 32px', borderBottom: '1px solid rgba(128,128,128,0.15)' }}>
            <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, textDecoration: "none", color: "var(--ink)" }}>
              ← Dashboard
            </a>
            <button
              onClick={() => setPanelOpen(!panelOpen)}
              style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 8, padding: '7px 14px', fontSize: 12, color: 'var(--ink)', cursor: 'pointer' }}
            >
              {panelOpen ? 'Hide panel →' : '← Show panel'}
            </button>
          </nav>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: 0, maxWidth: 1400, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            <div className="editor-preview-box" style={{ background: '#000', borderRadius: 16, overflow: 'hidden', width: '100%', maxWidth: 380, aspectRatio: '9 / 16', height: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {clips.length > 0 ? (
                <>
                  <video
                    ref={videoRefA}
                    controls
                    style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', inset: 0, opacity: activeSlot === 'A' ? 1 : 0, zIndex: activeSlot === 'A' ? 1 : 0 }}
                  />
                  <video
                    ref={videoRefB}
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', inset: 0, opacity: activeSlot === 'B' ? 1 : 0, zIndex: activeSlot === 'B' ? 1 : 0 }}
                  />
                </>
              ) : (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Add clips to preview</p>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(128,128,128,0.15)', padding: '16px 32px', background: 'var(--card-bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600 }}>Timeline</h3>
              <input ref={fileInputRef} type="file" accept="video/*" multiple onChange={handleAddFiles} style={{ display: 'none' }} />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                + Add clips
              </button>
            </div>

            {clips.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No clips yet. Add some to get started.</p>
            )}

            {clips.map((clip) => (
              clip.duration === 0 && clip.previewUrl ? (
                <video key={`meta-${clip.id}`} src={clip.previewUrl} style={{ display: 'none' }} onLoadedMetadata={(e) => handleLoadedMetadata(clip.id, e)} />
              ) : null
            ))}

            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
              {clips.map((clip, i) => {
                const dur = clip.duration || 5
                const effectiveLength = clip.trimLength > 0 ? clip.trimLength : dur
                const barWidth = Math.max(70, effectiveLength * PIXELS_PER_SECOND)

                return (
                  <div
                    key={clip.id}
                    draggable={!isTrimming}
                    onDragStart={() => setDraggedIndex(i)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i) }}
                    onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null) }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (draggedIndex !== null && draggedIndex !== i) reorderClips(draggedIndex, i)
                      setDraggedIndex(null)
                      setDragOverIndex(null)
                    }}
                    style={{ flexShrink: 0, background: 'var(--sand)', borderRadius: 10, padding: '8px', width: barWidth + 16, cursor: 'grab', opacity: draggedIndex === i ? 0.4 : 1, outline: dragOverIndex === i && draggedIndex !== i ? '2px dashed var(--coral)' : 'none' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: barWidth - 50 }}>{i + 1}. {clip.name}</p>
                      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                        <button onClick={() => moveClip(i, -1)} disabled={i === 0} style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 5, padding: '2px 5px', cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.4 : 1, fontSize: 9 }}>←</button>
                        <button onClick={() => moveClip(i, 1)} disabled={i === clips.length - 1} style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 5, padding: '2px 5px', cursor: i === clips.length - 1 ? 'not-allowed' : 'pointer', opacity: i === clips.length - 1 ? 0.4 : 1, fontSize: 9 }}>→</button>
                        <button onClick={() => setEditingClipId(editingClipId === clip.id ? null : clip.id)} style={{ background: editingClipId === clip.id ? 'var(--coral)' : 'none', border: '1px solid var(--coral)', borderRadius: 5, padding: '2px 5px', cursor: 'pointer', fontSize: 9, color: editingClipId === clip.id ? '#fff' : 'var(--coral)' }}>⚙</button>
                        <button onClick={() => removeClip(i)} style={{ background: 'none', border: '1px solid rgba(216,90,48,0.4)', borderRadius: 5, padding: '2px 5px', cursor: 'pointer', fontSize: 9, color: 'var(--coral)' }}>✕</button>
                      </div>
                    </div>

                    {editingClipId === clip.id && (
                      <div draggable={false} onMouseDown={(e) => { e.stopPropagation(); setIsTrimming(true) }} style={{ background: "var(--card-bg)", borderRadius: 8, padding: "10px", marginBottom: 8, width: 220, display: "flex", flexDirection: "column", gap: 8 }}>
                        <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 6 }}>
                          <input type="checkbox" checked={clip.muted} onChange={(e) => updateClipSetting(clip.id, "muted", e.target.checked)} />
                          Mute audio
                        </label>
                        {!clip.muted && (
                          <div>
                            <label style={{ fontSize: 9, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>Volume {(clip.volume * 100).toFixed(0)}%</label>
                            <input type="range" min={0} max={1} step={0.05} value={clip.volume} onChange={(e) => updateClipSetting(clip.id, "volume", Number(e.target.value))} style={{ width: "100%" }} />
                          </div>
                        )}
                        <div>
                          <label style={{ fontSize: 9, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>Crop / fit</label>
                          <select value={clip.fit} onChange={(e) => updateClipSetting(clip.id, "fit", e.target.value as ClipItem["fit"])} style={{ width: "100%", fontSize: 10, padding: "3px" }}>
                            <option value="crop">Crop (fill frame)</option>
                            <option value="cover">Cover</option>
                            <option value="contain">Contain (fit whole clip)</option>
                          </select>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input type="checkbox" checked={clip.letterbox} onChange={(e) => updateClipSetting(clip.id, "letterbox", e.target.checked)} />
                          <label style={{ fontSize: 9, color: "var(--text-secondary)" }}>Landscape clip  -  add blurred bars</label>
                        </div>
                        <div>
                          <label style={{ fontSize: 9, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>Speed {clip.speed.toFixed(2)}x</label>
                          <input type="range" min={0.1} max={4} step={0.05} value={clip.speed} onChange={(e) => updateClipSetting(clip.id, "speed", Number(e.target.value))} style={{ width: "100%" }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 9, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>Filter</label>
                          <select value={clip.filter} onChange={(e) => updateClipSetting(clip.id, "filter", e.target.value as ClipItem["filter"])} style={{ width: "100%", fontSize: 10, padding: "3px" }}>
                            <option value="none">None</option>
                            <option value="boost">Boost</option>
                            <option value="contrast">Contrast</option>
                            <option value="darken">Darken</option>
                            <option value="lighten">Lighten</option>
                            <option value="greyscale">Greyscale</option>
                            <option value="muted">Muted tone</option>
                            <option value="negative">Negative</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 9, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>Rotate {clip.rotate}°</label>
                          <input type="range" min={-180} max={180} step={5} value={clip.rotate} onChange={(e) => updateClipSetting(clip.id, "rotate", Number(e.target.value))} style={{ width: "100%" }} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="checkbox" checked={clip.flipH} onChange={(e) => updateClipSetting(clip.id, "flipH", e.target.checked)} />
                            Flip H
                          </label>
                          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="checkbox" checked={clip.flipV} onChange={(e) => updateClipSetting(clip.id, "flipV", e.target.checked)} />
                            Flip V
                          </label>
                        </div>
                      </div>
                    )}
                    <div style={{ position: 'relative', width: barWidth, height: 40, background: 'var(--card-bg)', borderRadius: 6 }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          width: barWidth,
                          top: 0,
                          bottom: 0,
                          background: 'rgba(216,90,48,0.35)',
                          border: '1px solid var(--coral)',
                          borderRadius: 4,
                        }}
                      />
                      <div
                        onMouseDown={(e) => handleDragStart(clip.id, 'start', e)}
                        draggable={false}
                        style={{ position: 'absolute', left: -4, top: 0, bottom: 0, width: 8, background: 'var(--coral)', borderRadius: 3, cursor: 'ew-resize' }}
                      />
                      <div
                        onMouseDown={(e) => handleDragStart(clip.id, 'end', e)}
                        draggable={false}
                        style={{ position: 'absolute', left: barWidth - 4, top: 0, bottom: 0, width: 8, background: 'var(--coral)', borderRadius: 3, cursor: 'ew-resize' }}
                      />
                    </div>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
                      {clip.trimStart.toFixed(1)}s – {(clip.trimStart + effectiveLength).toFixed(1)}s
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {panelOpen && (
          <div className="editor-panel" style={{ width: 320, borderLeft: '1px solid rgba(128,128,128,0.15)', padding: 24, overflowY: 'auto', flexShrink: 0 }}>
            <button
              className="editor-panel-close"
              onClick={() => setPanelOpen(false)}
              style={{ display: "none", background: "var(--sand)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--ink)", cursor: "pointer", marginBottom: 16 }}
            >
              ✕ Close panel
            </button>
            {clips.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Add a clip first to access editing options.</p>
            )}
            {clips.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <button
                  onClick={() => setCaptionsOpen(!captionsOpen)}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", marginBottom: captionsOpen ? 12 : 0 }}
                >
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600 }}>Captions</h3>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{captionsOpen ? "−" : "+"}</span>
                </button>

                {captionsOpen && (
                  <div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Select all clips that contain speech to caption.</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                      {clips.map((clip, i) => {
                        const isSelected = speechClipIndices.has(i)
                        return (
                          <button
                            key={clip.id}
                            onClick={() => {
                              setSpeechClipIndices((prev) => {
                                const next = new Set(prev)
                                if (next.has(i)) next.delete(i)
                                else next.add(i)
                                return next
                              })
                            }}
                            style={{ padding: "6px 10px", borderRadius: 7, border: isSelected ? "2px solid var(--coral)" : "1px solid rgba(128,128,128,0.25)", background: isSelected ? "rgba(216,90,48,0.1)" : "var(--sand)", fontSize: 11, color: "var(--ink)", cursor: "pointer" }}
                          >
                            {isSelected ? "✓ " : ""}{clip.name.length > 14 ? clip.name.slice(0, 14) + "..." : clip.name}
                          </button>
                        )
                      })}
                    </div>

                    {speechClipIndices.size > 0 && (
                      <div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                          {CAPTION_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => setCaptionPreset(preset.id)}
                              style={{ textAlign: "left", padding: "10px", borderRadius: 8, border: captionPreset === preset.id ? "2px solid var(--coral)" : "1px solid rgba(128,128,128,0.25)", background: "var(--sand)", cursor: "pointer" }}
                            >
                              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{preset.label}</p>
                              <p style={{ fontSize: 10, color: "var(--text-secondary)" }}>{preset.desc}</p>
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowAdvancedCaptions(!showAdvancedCaptions)}
                          style={{ background: "none", border: "1px solid rgba(128,128,128,0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 11, color: "var(--ink)", cursor: "pointer", marginBottom: 12 }}
                        >
                          {showAdvancedCaptions ? "− Hide advanced options" : "+ Advanced caption options"}
                        </button>

                        {showAdvancedCaptions && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--sand)", padding: 12, borderRadius: 8 }}>
                            <div>
                              <label style={{ fontSize: 10, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Font</label>
                              <select value={captionFontFamily} onChange={(e) => setCaptionFontFamily(e.target.value)} style={{ width: "100%", fontSize: 11, padding: "5px" }}>
                                {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Font size</label>
                              <input type="number" value={captionFontSize} onChange={(e) => setCaptionFontSize(Number(e.target.value))} style={{ width: "100%", fontSize: 11, padding: "5px" }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Text color</label>
                              <input type="color" value={captionColor} onChange={(e) => setCaptionColor(e.target.value)} style={{ width: "100%", height: 30 }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Position</label>
                              <select value={captionPosition} onChange={(e) => setCaptionPosition(e.target.value as "bottom" | "top" | "center")} style={{ width: "100%", fontSize: 11, padding: "5px" }}>
                                <option value="bottom">Bottom</option>
                                <option value="center">Center</option>
                                <option value="top">Top</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {clips.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Music</h3>
                <input ref={musicInputRef} type="file" accept="audio/*" onChange={(e) => setMusicFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                <button
                  onClick={() => musicInputRef.current?.click()}
                  style={{ width: '100%', textAlign: 'left', background: 'var(--sand)', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--ink)', cursor: 'pointer' }}
                >
                  {musicFile ? `♪ ${musicFile.name}` : musicPath ? '♪ Using existing music' : '+ Add background music'}
                </button>
              </div>
            )}

            {clips.length > 0 && (
              <button
                onClick={handleRender}
                disabled={rendering}
                style={{ width: '100%', backgroundColor: 'var(--coral)', color: '#fff', padding: '14px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: rendering ? 'not-allowed' : 'pointer', opacity: rendering ? 0.7 : 1 }}
              >
                {rendering ? 'Starting render...' : 'Render video'}
              </button>
            )}

            {error && <p style={{ fontSize: 13, color: 'var(--coral)', marginTop: 16 }}>{error}</p>}

            {renderId && (
              <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '18px', marginTop: 20 }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Render</h3>
                {renderStatus !== 'done' && renderStatus !== 'failed' && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Status: {renderStatus || 'starting'}...</p>
                )}
                {renderStatus === 'failed' && (
                  <p style={{ fontSize: 12, color: 'var(--coral)' }}>Something went wrong rendering your video.</p>
                )}
                {renderStatus === 'done' && outputUrl && (
                  <>
                    <video controls src={outputUrl} style={{ width: '100%', borderRadius: 12, marginTop: 8 }} />
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(outputUrl)
                          const blob = await res.blob()
                          const blobUrl = URL.createObjectURL(blob)
                          const a = document.createElement("a")
                          a.href = blobUrl
                          a.download = "reelly-video.mp4"
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                          URL.revokeObjectURL(blobUrl)
                        } catch (err) {
                          console.error("Download failed", err)
                        }
                      }}
                      title="Download video"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 8,
                        backgroundColor: "var(--coral)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        width: 38,
                        height: 38,
                        fontSize: 16,
                        cursor: "pointer",
                      }}
                    >
                      ⬇
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
