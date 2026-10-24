'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import { trackRenders } from '@/lib/renderTracker'

export type MultiFilmIdea = {
  key: string
  title: string
  ideaId: string | null
  source: 'idea' | 'script'
  caption: string | null
  tags: unknown
  lines: string[]
  actions: string[]
  texts: string[][]
}

type Settings = {
  captions: boolean
  preset: string
  fontFamily: string
  fontSize: number
  color: string
  position: 'bottom' | 'top' | 'center'
  borderColor: string
  resolution: 'high' | '4k'
  cutDeadSpace: boolean
}

type Clip = {
  id: string
  blob: Blob
  url: string
  ext: string
  type: string
  duration: number
  path: string | null
  status: 'uploading' | 'done' | 'error'
}

type Video = { idea: MultiFilmIdea; clips: Clip[] }
type RenderInfo = { id: string; status: 'queued' | 'done' | 'failed'; outputUrl?: string | null }
type Pending = { blob: Blob; ext: string; type: string; url: string }

type Props = {
  userId: string
  ideas: MultiFilmIdea[]
  isFreeTier: boolean
  userPlan: 'basic' | 'mid' | 'top'
  captionDefaults: Omit<Settings, 'captions' | 'resolution' | 'cutDeadSpace'>
  captionPresets: { id: string; label: string; desc: string }[]
  fontOptions: string[]
  renderBlocked: boolean
  gateRender: (action: () => void) => void
  onCleared: (data: { clearedIdeaId?: string | null; clearedScriptTitle?: string | null }) => void
  onBusy?: (busy: boolean) => void
}

const clipCountOf = (idea: MultiFilmIdea) => Math.max(idea.lines.length, idea.actions.length)
const isComplete = (v: Video) => v.clips.length >= clipCountOf(v.idea)

const blobDuration = (blob: Blob): Promise<number> =>
  new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(blob)
    video.preload = 'metadata'
    const finish = (d: number) => { URL.revokeObjectURL(url); resolve(d) }
    video.onloadedmetadata = () => {
      if (!isFinite(video.duration)) {
        // Browser-recorded video reports no duration until seeked to the end
        video.currentTime = 1e101
        video.ontimeupdate = () => {
          video.ontimeupdate = null
          finish(isFinite(video.duration) && video.duration > 0 ? video.duration : 5)
        }
      } else {
        finish(video.duration || 5)
      }
    }
    video.onerror = () => finish(5)
    video.src = url
  })

const label11: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }
const pill = (active: boolean): React.CSSProperties => ({ padding: '9px 14px', borderRadius: 20, border: active ? '1px solid var(--coral)' : '1px solid rgba(128,128,128,0.3)', background: active ? 'rgba(255,106,77,0.1)' : 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer' })
const primaryBtn = (disabled = false): React.CSSProperties => ({ padding: '14px 20px', borderRadius: 50, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, boxShadow: disabled ? 'none' : '0 4px 18px rgba(255,106,77,0.4)', fontFamily: 'Inter, sans-serif' })
const ghostBtn: React.CSSProperties = { padding: '12px 18px', borderRadius: 50, border: '1px solid rgba(128,128,128,0.35)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 12, fontFamily: 'Inter, sans-serif' }

function SettingsFields({ value, onChange, props }: { value: Settings; onChange: (patch: Partial<Settings>) => void; props: Pick<Props, 'captionPresets' | 'fontOptions' | 'userPlan'> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={value.captions} onChange={(e) => onChange({ captions: e.target.checked })} style={{ accentColor: '#FF6A4D' }} />
          Add captions
        </label>
        {value.captions && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
              {props.captionPresets.map((p) => (
                <button key={p.id} type="button" onClick={() => onChange({ preset: p.id })} style={{ textAlign: 'left', padding: '9px 11px', borderRadius: 10, border: value.preset === p.id ? '2px solid var(--coral)' : '1px solid rgba(128,128,128,0.2)', background: value.preset === p.id ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', cursor: 'pointer' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 2px', color: value.preset === p.id ? 'var(--coral)' : 'var(--ink)' }}>{p.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, margin: 0 }}>{p.desc}</p>
                </button>
              ))}
            </div>
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>Font, size, colour and position</summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginTop: 8 }}>
                <div><p style={{ ...label11, textTransform: 'none', marginBottom: 4 }}>Font</p><select value={value.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })} style={field}>{props.fontOptions.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
                <div><p style={{ ...label11, textTransform: 'none', marginBottom: 4 }}>Size</p><input type="text" inputMode="numeric" value={value.fontSize || ''} onFocus={(e) => e.target.select()} onChange={(e) => onChange({ fontSize: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })} onBlur={() => { if (value.fontSize < 10) onChange({ fontSize: 36 }) }} style={field} /></div>
                <div><p style={{ ...label11, textTransform: 'none', marginBottom: 4 }}>Colour</p><input type="color" value={value.color} onChange={(e) => onChange({ color: e.target.value })} style={{ ...field, padding: 3, height: 34 }} /></div>
                <div><p style={{ ...label11, textTransform: 'none', marginBottom: 4 }}>Position</p><select value={value.position} onChange={(e) => onChange({ position: e.target.value as Settings['position'] })} style={field}><option value="bottom">Bottom</option><option value="center">Center</option><option value="top">Top</option></select></div>
              </div>
            </details>
          </div>
        )}
      </div>
      <div>
        <p style={{ ...label11, marginBottom: 8 }}>Video quality</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {([['high', '1080p', 'Great for everyday Reels.'], ['4k', '4K', 'Pro plan only, takes longer.']] as const).map(([val, name, desc]) => (
            <button key={val} type="button" onClick={() => { if (val === '4k' && props.userPlan !== 'top') { window.location.href = '/plans'; return } onChange({ resolution: val }) }} style={{ flex: 1, padding: '9px 11px', borderRadius: 8, border: value.resolution === val ? '2px solid var(--coral)' : '1px solid rgba(128,128,128,0.2)', background: value.resolution === val ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', textAlign: 'left', cursor: 'pointer' }}>
              <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 2px', color: value.resolution === val ? 'var(--coral)' : 'var(--ink)' }}>{name}{val === '4k' && props.userPlan !== 'top' ? <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--coral)' }}>Pro</span> : null}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.3 }}>{desc}</p>
            </button>
          ))}
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: value.cutDeadSpace ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', border: value.cutDeadSpace ? '1px solid var(--coral)' : '1px solid rgba(128,128,128,0.2)', borderRadius: 10, padding: '10px 14px' }}>
        <input type="checkbox" checked={value.cutDeadSpace} onChange={(e) => onChange({ cutDeadSpace: e.target.checked })} style={{ accentColor: '#FF6A4D' }} />
        <span>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>Smart Trim</span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>Remove long silences</span>
        </span>
      </label>
    </div>
  )
}

export default function MultiFilm(p: Props) {
  const { userId, ideas, isFreeTier } = p
  const router = useRouter()

  const [stage, setStage] = useState<'pick' | 'filming' | 'review' | 'submitted'>('pick')
  const [selected, setSelected] = useState<string[]>([])
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [videos, setVideos] = useState<Video[]>([])
  const [vi, setVi] = useState(0)
  const [ci, setCi] = useState(0)
  const [between, setBetween] = useState(false)
  const [refilming, setRefilming] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const [globalSettings, setGlobalSettings] = useState<Settings>({ captions: true, ...p.captionDefaults, resolution: 'high', cutDeadSpace: false })
  const [overrides, setOverrides] = useState<Record<string, Partial<Settings>>>({})
  const [openCustom, setOpenCustom] = useState<string | null>(null)
  const [playIdx, setPlayIdx] = useState<Record<string, number>>({})

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [renders, setRenders] = useState<Record<string, RenderInfo>>({})

  // Camera + recorder
  const streamRef = useRef<MediaStream | null>(null)
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const wantedRef = useRef(false)
  const facingRef = useRef<'user' | 'environment'>('user')
  const deviceIdRef = useRef<string | null>(null)
  const orientationRef = useRef<'portrait' | 'landscape'>('portrait')
  const teleRef = useRef<HTMLParagraphElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const stopRef = useRef<() => void>(() => {})
  const seqRef = useRef(0)
  const stampRef = useRef(0)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [mirrored, setMirrored] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [scrollSpeed, setScrollSpeed] = useState(3)

  const video = videos[vi]
  const idea = video?.idea
  const clipTotal = idea ? clipCountOf(idea) : 0
  const line = idea?.lines[ci] || ''
  const action = idea?.actions[ci] || ''
  const cameraWanted = stage === 'filming' && !between && !!idea

  const selectedIdeas = ideas.filter((i) => selected.includes(i.key))
  const totalClips = selectedIdeas.reduce((n, i) => n + clipCountOf(i), 0)
  const uploadingCount = videos.reduce((n, v) => n + v.clips.filter((c) => c.status === 'uploading').length, 0)
  const errorCount = videos.reduce((n, v) => n + v.clips.filter((c) => c.status === 'error').length, 0)
  const allUploaded = videos.length > 0 && videos.every((v) => isComplete(v) && v.clips.every((c) => c.status === 'done'))

  const effective = (key: string): Settings => ({ ...globalSettings, ...(overrides[key] || {}) })

  const startCamera = () => {
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser does not support camera access. Try Chrome or Safari.')
      return
    }
    const land = orientationRef.current === 'landscape'
    const size = { width: { ideal: land ? 1920 : 1080 }, height: { ideal: land ? 1080 : 1920 } }
    const cam = deviceIdRef.current ? { deviceId: { exact: deviceIdRef.current } } : { facingMode: facingRef.current }
    navigator.mediaDevices.getUserMedia({ video: { ...cam, ...size }, audio: true })
      .then((stream) => {
        if (!wantedRef.current) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        const vt = stream.getVideoTracks()[0]
        if (vt) {
          vt.onended = () => setCameraActive(false)
          const facing = vt.getSettings?.().facingMode
          setMirrored(facing ? facing === 'user' : !/back|rear|environment/i.test(vt.label || ''))
        }
        if (videoElRef.current) videoElRef.current.srcObject = stream
        setCameraActive(true)
      })
      .catch((err) => {
        if (deviceIdRef.current && err && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
          deviceIdRef.current = null
          startCamera()
          return
        }
        setCameraActive(false)
        const name = err && err.name
        setCameraError(
          name === 'NotAllowedError' ? 'Camera or microphone is blocked. Allow access in your browser settings, then press Enable camera again.'
          : name === 'NotFoundError' ? 'No camera or microphone was found.'
          : name === 'NotReadableError' ? 'Your camera is being used by another tab or app. Close it, then press Enable camera again.'
          : 'Could not start the camera. Please try again.'
        )
      })
  }

  useEffect(() => {
    wantedRef.current = cameraWanted
    let t: ReturnType<typeof setTimeout>
    if (cameraWanted) {
      t = setTimeout(startCamera, 0)
    } else {
      streamRef.current?.getTracks().forEach((tr) => tr.stop())
      streamRef.current = null
      if (videoElRef.current) videoElRef.current.srcObject = null
      t = setTimeout(() => { setCameraActive(false); setCameraError('') }, 0)
    }
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraWanted])

  // Release the camera if the person leaves the page
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()) }, [])

  // Footage that has not been sent for rendering yet would be lost if the page closed
  const hasWork = (stage === 'filming' || stage === 'review') && videos.some((v) => v.clips.length > 0)
  useEffect(() => {
    if (!hasWork) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasWork])

  const { onBusy } = p
  useEffect(() => {
    onBusy?.(hasWork)
    return () => onBusy?.(false)
  }, [hasWork, onBusy])

  const flipCamera = async () => {
    if (isRecording) return
    const currentId = streamRef.current?.getVideoTracks()[0]?.getSettings?.().deviceId
    let cams: MediaDeviceInfo[] = []
    try { cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput') } catch {}
    if (cams.length < 2) { setCameraError('Only one camera was found on this device.'); return }
    const next = facingRef.current === 'user' ? 'environment' : 'user'
    const wanted = next === 'environment' ? /back|rear|environment/i : /front|user|facetime/i
    const byName = cams.find((d) => d.deviceId !== currentId && wanted.test(d.label))
    const idx = cams.findIndex((d) => d.deviceId === currentId)
    const pick = byName || cams[(idx + 1) % cams.length]
    facingRef.current = next
    deviceIdRef.current = pick.deviceId
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraActive(false)
    startCamera()
  }

  const startRecording = async () => {
    if (!streamRef.current || clipTotal === 0) return
    for (const n of [3, 2, 1]) {
      setCountdown(n)
      await new Promise((r) => setTimeout(r, 1000))
    }
    setCountdown(null)
    if (!streamRef.current) return
    try {
      const candidates = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) || ''
      // Record exactly 9:16 or 16:9. If the camera gives another shape, crop the centre of every frame.
      let recordStream: MediaStream = streamRef.current
      let stopCanvas: (() => void) | null = null
      const vid = videoElRef.current
      const target = orientationRef.current === 'landscape' ? 16 / 9 : 9 / 16
      if (vid && vid.videoWidth > 0 && vid.videoHeight > 0 && Math.abs(vid.videoWidth / vid.videoHeight - target) / target > 0.03) {
        const vw = vid.videoWidth
        const vh = vid.videoHeight
        let sw = vw
        let sh = vh
        if (vw / vh > target) sw = vh * target
        else sh = vw / target
        const sx = (vw - sw) / 2
        const sy = (vh - sh) / 2
        const scale = Math.min(1, 1920 / Math.max(sw, sh))
        const outW = Math.max(2, Math.round((sw * scale) / 2) * 2)
        const outH = Math.max(2, Math.round((sh * scale) / 2) * 2)
        const canvas = document.createElement('canvas')
        canvas.width = outW
        canvas.height = outH
        const ctx = canvas.getContext('2d')
        if (ctx) {
          let raf = 0
          const draw = () => {
            ctx.drawImage(vid, sx, sy, sw, sh, 0, 0, outW, outH)
            raf = requestAnimationFrame(draw)
          }
          draw()
          const cs = canvas.captureStream(30)
          streamRef.current.getAudioTracks().forEach((t) => cs.addTrack(t))
          recordStream = cs
          stopCanvas = () => { cancelAnimationFrame(raf); cs.getVideoTracks().forEach((t) => t.stop()) }
        }
      }
      const recorder = mimeType ? new MediaRecorder(recordStream, { mimeType }) : new MediaRecorder(recordStream)
      const baseType = (recorder.mimeType || mimeType || 'video/webm').split(';')[0]
      const ext = baseType.includes('mp4') ? 'mp4' : 'webm'
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => {
        if (stopCanvas) stopCanvas()
        const blob = new Blob(chunks, { type: baseType })
        if (blob.size === 0) { setCameraError('Nothing was recorded. Please try again.'); return }
        setPending({ blob, ext, type: baseType, url: URL.createObjectURL(blob) })
      }
      recorder.start(1000)
      recorderRef.current = recorder
      setIsRecording(true)
    } catch {
      setCameraError('Could not start recording on this browser.')
    }
  }

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    setIsRecording(false)
  }
  useEffect(() => { stopRef.current = stopRecording })

  // Teleprompter: the line scrolls across and recording stops shortly after it ends
  useEffect(() => {
    const el = teleRef.current
    if (!isRecording || !el) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      if (el) el.style.transform = 'translateX(0)'
      return
    }
    const words = line.split(/\s+/).filter(Boolean).length
    const secs = Math.max(2, words / (2.3 * (scrollSpeed / 3)))
    const distance = el.scrollWidth
    const startTime = performance.now()
    let stopTimer: ReturnType<typeof setTimeout> | null = null
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / (secs * 1000), 1)
      el.style.transform = `translateX(-${distance * progress}px)`
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
      else stopTimer = setTimeout(() => stopRef.current(), 1500)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      if (stopTimer) clearTimeout(stopTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, scrollSpeed])

  const patchClip = (key: string, clipId: string, patch: Partial<Clip>) =>
    setVideos((vs) => vs.map((v) => (v.idea.key === key ? { ...v, clips: v.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)) } : v)))

  // Each clip is sent to storage the moment it is saved, so nothing waits until the end
  const uploadClip = async (key: string, clip: Clip) => {
    const path = `${userId}/film/multi-${stampRef.current}-${seqRef.current++}.${clip.ext}`
    patchClip(key, clip.id, { status: 'uploading' })
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase.storage.from('video-uploads').upload(path, clip.blob, { contentType: clip.type, upsert: true })
      if (!error && data) { patchClip(key, clip.id, { status: 'done', path: data.path }); return }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
    }
    patchClip(key, clip.id, { status: 'error' })
  }

  const retryUploads = () => {
    videos.forEach((v) => v.clips.filter((c) => c.status === 'error').forEach((c) => { void uploadClip(v.idea.key, c) }))
  }

  const discardPending = () => {
    if (pending) URL.revokeObjectURL(pending.url)
    setPending(null)
  }

  const saveClip = async () => {
    if (!pending || !idea) return
    const dur = await blobDuration(pending.blob)
    const clip: Clip = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, blob: pending.blob, url: pending.url, ext: pending.ext, type: pending.type, duration: dur, path: null, status: 'uploading' }
    setPending(null)
    const key = idea.key
    setVideos((vs) => vs.map((v) => (v.idea.key === key ? { ...v, clips: [...v.clips, clip] } : v)))
    void uploadClip(key, clip)
    if (ci + 1 < clipTotal) { setCi(ci + 1); return }
    // That was the last clip of this video
    if (refilming) { setRefilming(false); setStage('review'); return }
    if (vi + 1 < videos.length) { setVi(vi + 1); setCi(0); setBetween(true); return }
    setStage('review')
  }

  const startFilming = () => {
    if (selectedIdeas.length === 0) return
    orientationRef.current = orientation
    stampRef.current = Date.now()
    seqRef.current = 0
    setVideos(selectedIdeas.map((i) => ({ idea: i, clips: [] })))
    setVi(0)
    setCi(0)
    setBetween(false)
    setRefilming(false)
    setSubmitError('')
    setOverrides({})
    setRenders({})
    setStage('filming')
  }

  const leaveFilming = () => {
    discardPending()
    setConfirmLeave(false)
    setBetween(false)
    setRefilming(false)
    const keep = videos.filter(isComplete)
    videos.filter((v) => !isComplete(v)).forEach((v) => v.clips.forEach((c) => URL.revokeObjectURL(c.url)))
    setVideos(keep)
    setStage(keep.length > 0 ? 'review' : 'pick')
  }

  const closeFilming = () => {
    if (isRecording || countdown !== null) return
    if (videos.every((v) => v.clips.length === 0) && !pending) { leaveFilming(); return }
    setConfirmLeave(true)
  }

  const refilm = (index: number) => {
    const v = videos[index]
    if (!v) return
    v.clips.forEach((c) => URL.revokeObjectURL(c.url))
    setVideos((vs) => vs.map((x, i) => (i === index ? { ...x, clips: [] } : x)))
    setVi(index)
    setCi(0)
    setBetween(false)
    setRefilming(true)
    setStage('filming')
  }

  const removeVideo = (index: number) => {
    videos[index]?.clips.forEach((c) => URL.revokeObjectURL(c.url))
    const next = videos.filter((_, i) => i !== index)
    setVideos(next)
    if (next.length === 0) setStage('pick')
  }

  const resetAll = () => {
    videos.forEach((v) => v.clips.forEach((c) => URL.revokeObjectURL(c.url)))
    setVideos([])
    setSelected([])
    setRenders({})
    setOverrides({})
    setOpenCustom(null)
    setSubmitError('')
    setStage('pick')
  }

  const setGlobal = (patch: Partial<Settings>) => {
    setGlobalSettings((s) => ({ ...s, ...patch }))
    // Changing a setting for every video replaces any different choice made for a single video
    setOverrides((o) => {
      const next: Record<string, Partial<Settings>> = {}
      for (const [k, v] of Object.entries(o)) {
        const copy = { ...v } as Record<string, unknown>
        Object.keys(patch).forEach((f) => { delete copy[f] })
        next[k] = copy as Partial<Settings>
      }
      return next
    })
  }
  const setOverride = (key: string, patch: Partial<Settings>) => setOverrides((o) => ({ ...o, [key]: { ...(o[key] || {}), ...patch } }))

  const submitAll = async () => {
    if (!allUploaded || submitting) return
    setSubmitting(true)
    setSubmitError('')
    const done: Record<string, RenderInfo> = { ...renders }
    for (const v of videos) {
      const key = v.idea.key
      if (done[key]) continue
      const s = effective(key)
      const land = orientationRef.current === 'landscape'
      const clipTrims = v.clips.map((c) => (c.duration > 1.5 && c.duration !== 5 ? { duration: c.duration, trimStart: 0.3, trimLength: c.duration - 0.6 } : { duration: c.duration }))
      const captionStyle = s.captions ? { preset: s.preset, custom: { font: { family: s.fontFamily, size: s.fontSize || 36, color: s.color }, position: s.position, borderColor: s.borderColor } } : null
      try {
        const res = await authFetch('/api/render-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            clipPaths: v.clips.map((c) => c.path),
            captionStyle,
            musicPath: null,
            voiceovers: [],
            clipTrims,
            clipSettings: v.clips.map(() => (land ? { letterbox: true } : {})),
            clipTexts: v.clips.map((_, i) => v.idea.texts[i] || []),
            outputOrientation: land ? 'landscape' : undefined,
            resolution: s.resolution,
            cutDeadSpace: s.cutDeadSpace,
            ideaId: v.idea.ideaId,
            ideaSource: v.idea.source,
            ideaTitle: v.idea.title,
            ideaCaption: v.idea.caption,
            ideaTags: v.idea.tags ?? null,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.renderId) {
          setSubmitError(`${v.idea.title}: ${data.error || 'could not start rendering.'}`)
          break
        }
        done[key] = { id: data.renderId, status: 'queued' }
        trackRenders([{ id: data.renderId, title: v.idea.title }])
        setRenders({ ...done })
      } catch {
        setSubmitError('Lost connection while sending. Check your internet and press Render again. Videos already sent are not repeated.')
        break
      }
    }
    setSubmitting(false)
    if (videos.every((v) => done[v.idea.key])) setStage('submitted')
  }

  // Follow the renders until they finish
  const rendersRef = useRef(renders)
  useEffect(() => { rendersRef.current = renders }, [renders])
  useEffect(() => {
    if (stage !== 'submitted') return
    const poll = async () => {
      const open = Object.entries(rendersRef.current).filter(([, r]) => r.status === 'queued')
      await Promise.all(open.map(async ([key, r]) => {
        try {
          const res = await authFetch('/api/render-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ renderId: r.id }) })
          if (!res.ok) return
          const d = await res.json()
          if (d.status === 'done') {
            setRenders((cur) => ({ ...cur, [key]: { id: r.id, status: 'done', outputUrl: d.outputUrl || null } }))
            p.onCleared(d)
          } else if (d.status === 'failed') {
            setRenders((cur) => ({ ...cur, [key]: { id: r.id, status: 'failed' } }))
          }
        } catch {}
      }))
    }
    const first = setTimeout(poll, 0)
    const timer = setInterval(poll, 6000)
    return () => { clearTimeout(first); clearInterval(timer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // ───────────────────────── Pick videos ─────────────────────────
  if (stage === 'pick') {
    const toggle = (key: string) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--sand)', borderRadius: 16, padding: 16 }}>
          <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Choose the videos to film today</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>You film every video in one go, then set them up and render them together.</p>
          {ideas.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Generate filming instructions or a script for an idea first.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ideas.map((i) => {
              const count = clipCountOf(i)
              const disabled = count === 0
              const on = selected.includes(i.key)
              return (
                <label key={i.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8, background: on ? 'rgba(255,106,77,0.08)' : 'rgba(128,128,128,0.08)', border: on ? '1px solid var(--coral)' : '1px solid rgba(128,128,128,0.2)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
                  <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(i.key)} style={{ marginTop: 2, accentColor: '#FF6A4D', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, lineHeight: 1.4 }}>{i.title}</span>
                    <span style={{ display: 'block', fontSize: 11, color: disabled ? 'var(--coral)' : 'var(--text-muted)', marginTop: 2 }}>
                      {disabled ? 'Needs a script or filming instructions first' : `${count} ${count === 1 ? 'clip' : 'clips'}`}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['portrait', 'landscape'] as const).map((o) => (
            <button key={o} type="button" onClick={() => setOrientation(o)} style={{ ...pill(orientation === o), flex: 1 }}>{o === 'portrait' ? '▯ Portrait' : '▭ Landscape'}</button>
          ))}
        </div>
        <button type="button" disabled={selectedIdeas.length === 0} onClick={startFilming} style={primaryBtn(selectedIdeas.length === 0)}>
          {selectedIdeas.length === 0 ? 'Choose at least one video' : `Start filming ${selectedIdeas.length} ${selectedIdeas.length === 1 ? 'video' : 'videos'} · ${totalClips} clips`}
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>Each clip uploads as soon as you move to the next one.</p>
      </div>
    )
  }

  // ───────────────────────── Filming ─────────────────────────
  if (stage === 'filming' && idea && typeof document !== 'undefined') {
    const portrait = orientation === 'portrait'
    const frameW = portrait ? 'min(100vw, calc((100dvh - 84px) * 9 / 16))' : 'min(100vw, calc((100dvh - 84px) * 16 / 9))'
    const nextIdea = videos[vi]?.idea
    return createPortal(
      <div role="dialog" aria-label="Film your videos" style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#0b0a10', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {between ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ maxWidth: 380, width: '100%', textAlign: 'center', color: '#fff' }}>
              <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(52,199,89,0.18)', color: '#34c759', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px' }}>✓</div>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Video {vi} of {videos.length} filmed</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 20px' }}>{uploadingCount > 0 ? `Uploading ${uploadingCount} ${uploadingCount === 1 ? 'clip' : 'clips'} in the background.` : 'Everything so far is uploaded.'}</p>
              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 16px', textAlign: 'left', marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px' }}>Up next</p>
                <p style={{ fontSize: 15, fontWeight: 600, margin: 0, lineHeight: 1.35 }}>{nextIdea?.title}</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: '4px 0 0' }}>{clipTotal} {clipTotal === 1 ? 'clip' : 'clips'}</p>
              </div>
              <button type="button" onClick={() => setBetween(false)} style={{ ...primaryBtn(), width: '100%', marginBottom: 10 }}>Start next video</button>
              <button type="button" onClick={leaveFilming} style={{ ...ghostBtn, width: '100%', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>Stop here and review</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', background: '#17151f', overflow: 'hidden', aspectRatio: portrait ? '9 / 16' : '16 / 9', width: frameW }}>
                <button type="button" onClick={closeFilming} disabled={isRecording || countdown !== null} aria-label="Close recorder" style={{ position: 'absolute', top: 10, right: 10, zIndex: 7, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 20, lineHeight: 1, cursor: isRecording || countdown !== null ? 'not-allowed' : 'pointer', opacity: isRecording || countdown !== null ? 0.4 : 1 }}>✕</button>
                {isFreeTier && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><span style={{ transform: 'rotate(-28deg)', fontFamily: "'Poppins', sans-serif", fontSize: 44, fontWeight: 800, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', textShadow: '0 2px 8px rgba(0,0,0,0.35)', userSelect: 'none' }}>reelezy</span></div>}
                <video ref={(el) => { videoElRef.current = el; if (el && streamRef.current) el.srcObject = streamRef.current }} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: mirrored ? 'scaleX(-1)' : 'none', display: 'block' }} />
                <button type="button" onClick={flipCamera} disabled={isRecording} aria-label="Flip camera" style={{ position: 'absolute', right: 12, top: '45%', width: 46, height: 46, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 22, cursor: isRecording ? 'not-allowed' : 'pointer', opacity: isRecording ? 0.4 : 1 }}>⟲</button>
                <div style={{ position: 'absolute', bottom: 88, right: 14, background: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: '5px 11px', color: '#fff', fontSize: 11, fontWeight: 700, zIndex: 3 }}>
                  Video {vi + 1} of {videos.length} · Clip {Math.min(ci + 1, clipTotal)} of {clipTotal}
                </div>
                {line && !pending && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, background: 'rgba(8,6,24,0.62)', padding: portrait ? '46px 60px 14px 18px' : '12px 60px 12px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {idea.lines[ci - 1] && <p style={{ color: 'rgba(241,239,232,0.45)', fontSize: 14, lineHeight: 1.35, margin: 0 }}>{idea.lines[ci - 1]}</p>}
                    {isRecording ? (
                      <div style={{ overflow: 'hidden' }}>
                        <p ref={teleRef} style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0, whiteSpace: 'nowrap', textShadow: '0 1px 8px rgba(0,0,0,0.7)', willChange: 'transform', display: 'inline-block', paddingLeft: '100%' }}>{line}</p>
                      </div>
                    ) : (
                      <p style={{ color: '#fff', fontSize: 17, fontWeight: 700, lineHeight: 1.35, margin: 0 }}>{line}</p>
                    )}
                    {idea.lines[ci + 1] && <p style={{ color: 'rgba(241,239,232,0.45)', fontSize: 14, lineHeight: 1.35, margin: 0 }}>{idea.lines[ci + 1]}</p>}
                  </div>
                )}
                {action && !pending && (
                  <div style={{ position: 'absolute', left: 14, right: 14, bottom: 124, zIndex: 2, background: 'rgba(8,6,24,0.62)', borderRadius: 14, padding: '9px 14px', maxHeight: '38%', overflowY: 'auto' }}>
                    <p style={{ color: 'rgba(241,239,232,0.6)', fontSize: 11, fontWeight: 600, margin: '0 0 2px' }}>Action</p>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, lineHeight: 1.3, margin: 0, textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>{action}</p>
                  </div>
                )}
                {countdown !== null && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
                    <span style={{ fontSize: 100, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{countdown}</span>
                  </div>
                )}
                {!cameraActive && !isRecording && countdown === null && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'rgba(0,0,0,0.5)' }}>
                    <button type="button" onClick={startCamera} style={{ padding: '12px 28px', borderRadius: 50, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Enable camera</button>
                    <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, margin: 0, padding: '0 24px', textAlign: 'center', lineHeight: 1.5 }}>{cameraError || 'Allow camera and microphone to start'}</p>
                  </div>
                )}
                {isRecording && (
                  <div style={{ position: 'absolute', bottom: 88, left: 14, display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: '5px 11px', zIndex: 3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3b30', display: 'inline-block' }} />
                    <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>REC</span>
                  </div>
                )}
                {!pending && (cameraActive || isRecording) && (
                  <button type="button" onClick={isRecording ? stopRecording : startRecording} disabled={countdown !== null || clipTotal === 0} aria-label={isRecording ? 'Stop recording' : 'Start recording'} style={{ position: 'absolute', left: '50%', bottom: 18, marginLeft: -29, width: 58, height: 58, borderRadius: '50%', border: '3px solid #fff', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 3, cursor: countdown !== null ? 'not-allowed' : 'pointer', opacity: countdown !== null ? 0.5 : 1 }}>
                    <span style={{ width: isRecording ? 22 : 40, height: isRecording ? 22 : 40, borderRadius: isRecording ? 6 : '50%', background: '#ff3b30', transition: 'all 0.15s ease' }} />
                  </button>
                )}
                {pending && <video key={pending.url} src={pending.url} controls autoPlay playsInline controlsList="nodownload noremoteplayback" disablePictureInPicture onContextMenu={(e) => { if (isFreeTier) e.preventDefault() }} style={{ position: 'absolute', inset: 0, zIndex: 3, width: '100%', height: '100%', objectFit: 'cover', background: '#000' }} />}
              </div>
            </div>
            <div style={{ height: 84, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', background: '#0b0a10', color: '#fff' }}>
              {pending ? (
                <>
                  <p style={{ flex: 1, fontSize: 13, fontWeight: 600, margin: 0 }}>Video {vi + 1} · Clip {ci + 1} of {clipTotal}</p>
                  <button type="button" onClick={discardPending} style={{ padding: '13px 20px', borderRadius: 50, border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>↺ Redo</button>
                  <button type="button" onClick={saveClip} style={{ padding: '13px 20px', borderRadius: 50, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    {ci + 1 < clipTotal ? '✓ Save & next' : refilming || vi + 1 >= videos.length ? '✓ Finish' : '✓ Finish video'}
                  </button>
                </>
              ) : (
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Scroll speed {scrollSpeed}x</span>
                    <span style={{ fontSize: 11, color: uploadingCount > 0 ? '#ffd166' : 'rgba(255,255,255,0.45)' }}>{uploadingCount > 0 ? `Uploading ${uploadingCount}…` : videos.some((v) => v.clips.length > 0) ? 'Saved ✓' : ''}</span>
                  </div>
                  <input type="range" min={1} max={10} value={scrollSpeed} onChange={(e) => setScrollSpeed(Number(e.target.value))} aria-label="Teleprompter scroll speed" style={{ width: '100%', accentColor: 'var(--coral)' }} />
                </div>
              )}
            </div>
          </>
        )}
        {confirmLeave && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: '#1c1a24', borderRadius: 18, padding: 22, maxWidth: 340, width: '100%', color: '#fff' }}>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>Leave filming?</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, margin: '0 0 18px' }}>Videos you have fully filmed are kept. The video you are in the middle of will be removed.</p>
              <button type="button" onClick={() => setConfirmLeave(false)} style={{ ...primaryBtn(), width: '100%', marginBottom: 8 }}>Keep filming</button>
              <button type="button" onClick={leaveFilming} style={{ ...ghostBtn, width: '100%', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>Leave</button>
            </div>
          </div>
        )}
      </div>,
      document.body
    )
  }

  // ───────────────────────── Review + settings ─────────────────────────
  if (stage === 'review') {
    const settingsProps = { captionPresets: p.captionPresets, fontOptions: p.fontOptions, userPlan: p.userPlan }
    const summary = (s: Settings) => `${s.captions ? 'Captions on' : 'No captions'} · ${s.resolution === '4k' ? '4K' : '1080p'}${s.cutDeadSpace ? ' · Smart Trim' : ''}`
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 17, fontWeight: 700, margin: 0 }}>Set up your {videos.length === 1 ? 'video' : `${videos.length} videos`}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>Everything is filmed. Choose the settings for all videos, change any single video if you need to, then render.</p>
        </div>

        <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '16px 18px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: '0 0 14px' }}>Settings for every video</p>
          <SettingsFields value={globalSettings} onChange={setGlobal} props={settingsProps} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {videos.map((v, index) => {
            const key = v.idea.key
            const s = effective(key)
            const custom = Object.keys(overrides[key] || {}).length > 0
            const open = openCustom === key
            const pi = Math.min(playIdx[key] || 0, v.clips.length - 1)
            const up = v.clips.filter((c) => c.status === 'uploading').length
            const bad = v.clips.filter((c) => c.status === 'error').length
            return (
              <div key={key} style={{ background: 'var(--card-bg)', borderRadius: 14, padding: 12, border: custom ? '1px solid var(--coral)' : '1px solid rgba(128,128,128,0.15)' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 78, aspectRatio: orientation === 'portrait' ? '9 / 16' : '16 / 9', flexShrink: 0, borderRadius: 10, overflow: 'hidden', background: '#0b0a10', position: 'relative' }}>
                    {v.clips[pi] && <video key={v.clips[pi].url} src={v.clips[pi].url} controls playsInline preload="metadata" controlsList="nodownload noremoteplayback" onEnded={() => { if (pi + 1 < v.clips.length) setPlayIdx((m) => ({ ...m, [key]: pi + 1 })) }} onContextMenu={(e) => { if (isFreeTier) e.preventDefault() }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.35 }}>{v.idea.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '3px 0 0' }}>{v.clips.length} {v.clips.length === 1 ? 'clip' : 'clips'} · {bad > 0 ? <span style={{ color: 'var(--coral)' }}>{bad} failed to upload</span> : up > 0 ? `Uploading ${up}…` : 'Uploaded ✓'}</p>
                    <p style={{ fontSize: 11, color: custom ? 'var(--coral)' : 'var(--text-muted)', margin: '3px 0 0' }}>{custom ? 'Custom: ' : ''}{summary(s)}</p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => setOpenCustom(open ? null : key)} style={{ ...pill(open), padding: '6px 12px', fontSize: 12 }}>{open ? 'Done' : 'Customise'}</button>
                      <button type="button" onClick={() => refilm(index)} style={{ ...pill(false), padding: '6px 12px', fontSize: 12 }}>↺ Re-film</button>
                      {videos.length > 1 && <button type="button" onClick={() => removeVideo(index)} style={{ ...pill(false), padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Remove</button>}
                    </div>
                  </div>
                </div>
                {open && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(128,128,128,0.2)' }}>
                    <SettingsFields value={s} onChange={(patch) => setOverride(key, patch)} props={settingsProps} />
                    {custom && <button type="button" onClick={() => setOverrides((o) => ({ ...o, [key]: {} }))} style={{ marginTop: 12, background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--coral)', fontWeight: 600, cursor: 'pointer' }}>Use the settings for every video</button>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {errorCount > 0 && (
          <div style={{ background: 'rgba(255,106,77,0.1)', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ fontSize: 13, color: 'var(--ink)', margin: '0 0 8px' }}>{errorCount} {errorCount === 1 ? 'clip' : 'clips'} did not upload. Check your connection and try again.</p>
            <button type="button" onClick={retryUploads} style={{ ...pill(true), padding: '7px 14px', fontSize: 12 }}>Retry upload</button>
          </div>
        )}
        {submitError && <p role="alert" style={{ fontSize: 13, color: 'var(--coral)', margin: 0 }}>{submitError}</p>}

        <button
          type="button"
          disabled={!p.renderBlocked && (!allUploaded || submitting)}
          onClick={() => { if (p.renderBlocked) { window.location.href = '/plans'; return } p.gateRender(() => { void submitAll() }) }}
          style={primaryBtn(!p.renderBlocked && (!allUploaded || submitting))}
        >
          {p.renderBlocked ? 'Upgrade to render' : submitting ? 'Sending to render…' : !allUploaded ? 'Finishing uploads…' : `Render ${videos.length} ${videos.length === 1 ? 'video' : 'videos'}`}
        </button>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Once you press Render you can close the app. Your videos keep rendering and we email you as each one finishes.</p>
        <button type="button" onClick={resetAll} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>Start over</button>
      </div>
    )
  }

  // ───────────────────────── Submitted ─────────────────────────
  const doneCount = videos.filter((v) => renders[v.idea.key]?.status === 'done').length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--sand)', borderRadius: 16, padding: 20, textAlign: 'center' }}>
        <div aria-hidden="true" style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(52,199,89,0.15)', color: '#34c759', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 12px' }}>✓</div>
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>{doneCount === videos.length ? 'All your videos are ready' : 'Your videos are rendering'}</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
          {doneCount === videos.length ? 'They are waiting on the Publish page.' : 'You can close the app or lock your phone. Rendering carries on without you, and we will email you as each video finishes.'}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {videos.map((v) => {
          const r = renders[v.idea.key]
          return (
            <div key={v.idea.key} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card-bg)', borderRadius: 12, padding: '12px 14px' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.35 }}>{v.idea.title}</span>
              <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, color: r?.status === 'done' ? '#2f9e4f' : r?.status === 'failed' ? 'var(--coral)' : 'var(--text-muted)' }}>
                {r?.status === 'done' ? 'Ready' : r?.status === 'failed' ? 'Failed' : 'Rendering…'}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => router.push('/dashboard/scheduler')} style={{ ...primaryBtn(), flex: 1, minWidth: 150 }}>Go to Publish</button>
        <button type="button" onClick={resetAll} style={{ ...ghostBtn, flex: 1, minWidth: 150 }}>Film more</button>
      </div>
    </div>
  )
}
