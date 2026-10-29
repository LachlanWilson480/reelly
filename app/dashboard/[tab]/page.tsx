'use client'

import React from 'react'
import { ReelezyLogo } from '@/components/ReelezyLogo'
import { authFetch } from '@/lib/authFetch'
import { parseComfort } from '@/lib/filmingComfort'
import { PLAN_LIMITS } from '@/lib/planLimits'
import { type CaptionLayers, DEFAULT_CAPTION_LAYERS, resolveCaptionLayers, layerPoint } from '@/lib/captionLayers'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useParams } from 'next/navigation'
import JSZip from 'jszip'
import { getMonthStartISO } from '@/lib/billingMonth'
import SchedulerTab from '@/components/SchedulerTab'
import Tooltip from '@/components/Tooltip'
import CameraControls from '@/components/CameraControls'
import ClipLibrary, { LibraryPicker, SaveToLibraryButton } from '@/components/ClipLibrary'
import { useCameraControls } from '@/lib/useCameraControls'
import MultiFilm, { type MultiFilmIdea } from '@/components/MultiFilm'
import { pickRecorderMime, streamIsLive, beginRecorder, finishRecorder } from '@/lib/recorderSupport'
type Profile = {
  business_name: string
  industry: string
  suburb: string
  country: string | null
  tone: string | null
  target_audience: string | null
  core_services: string | null
  custom_guidance: string | null
  location_type: string | null
  local_seasonal_context: string | null
  brand_personality: string | null
  words_to_avoid: string | null
  signature_service: string | null
  common_objections: string | null
  current_promotions: string | null
  customer_problem: string | null
  key_selling_point: string | null
  on_camera_people: string | null
  video_people_count: number | null
  years_in_business: string | null
  team_size: string | null
  upcoming_launches: string | null
  past_content: string | null
  worst_content: string | null
  preferred_formats: string | null
  competitor_content: string | null
  equipment: string | null
  community_ties: string | null
  notes: string | null
  price_positioning: string | null
  customer_source: string | null
  filming_comfort: string | null}

type Tab = 'overview' | 'ideas' | 'myideas' | 'filming' | 'film' | 'script' | 'uploads' | 'aiuploads' | 'carousel' | 'scheduler' | 'library' | 'library'

type Idea = {
  id: string
  title: string
  hook: string
  description: string
  tags: string
  notes?: string
  day_of_week?: number
  source?: string
}

type FilmingItem = Idea & { checklist: string[]; prep?: string[]; caption?: string; script?: string; directions?: string[] }

const FONT_OPTIONS = ['Montserrat ExtraBold', 'Impact', 'Anton', 'Bebas Neue', 'Oswald', 'Roboto Bold', 'Open Sans Bold', 'Lato Bold']

const CAPTION_PRESETS = [
  { id: 'word_by_word', label: 'Word by Word', desc: 'One big word at a time, in the middle of the screen' },
  { id: 'bold_center', label: 'Bold Pop', desc: '3 words at a time, big bold capitals near the bottom' },
  { id: 'minimal_bottom', label: 'Minimal', desc: 'Up to 5 small words at a time, on a dark strip' },
  { id: 'typewriter', label: 'Typewriter', desc: '4 plain words at a time, on a dark strip' },
]

type ClipTrimRange = { start: number; end: number; total: number; file: File }

const fmtTrimTime = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec.toFixed(1).padStart(4, '0')}`
}


type VoiceoverSegment = { file: File; start: number; end: number | null; caption?: string; captionLayer?: 'onScreen' | 'speech' }
// How the preview draws the user's own captions (same colours and places as the final video)
// Optional per-caption text settings: anything left out uses the shared Caption look
type CustomCaption = { id: string; text: string; start: number; end: number; x: number; y: number; font?: string; size?: number; color?: string; bg?: string | null }
const CAPTION_TEXT_FONTS: { name: string; css: string; weight: number }[] = [
  { name: 'Sans', css: 'Arial, Helvetica, sans-serif', weight: 400 },
  { name: 'Sans Bold', css: "Arial Black, Arial, sans-serif", weight: 900 },
  { name: 'Serif', css: "Georgia, 'Times New Roman', serif", weight: 400 },
  { name: 'Serif Bold', css: "Georgia, 'Times New Roman', serif", weight: 800 },
  { name: 'Mono Bold', css: "'Courier New', monospace", weight: 800 },
  { name: 'Narrow Bold', css: "'Arial Narrow', Arial, sans-serif", weight: 800 },
]
// An image or video the person lays over their video. x and y are the centre as a share of the frame,
// size is its width as a share of the frame, start and end are seconds on the timeline (end null = to the end).
type OverlayItem = { file: File; kind: 'image' | 'video'; url: string; x: number; y: number; size: number; start: number; end: number | null }

type PreviewCaptionStyle = { color: string; border: string; background: string | null; size: number; onScreen: { x: number; y: number }; speech: { x: number; y: number } }

const voiceoverExt = (b: Blob) => {
  const t = (b.type || '').toLowerCase()
  if (t.includes('webm')) return 'webm'
  if (t.includes('mp4') || t.includes('m4a') || t.includes('aac')) return 'm4a'
  if (t.includes('ogg')) return 'ogg'
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3'
  if (t.includes('wav')) return 'wav'
  return 'webm'
}

type VoiceTake = { id: string; blob: Blob; url: string; start: number; duration: number; volume: number }

// Every voiceover part gets its own colour so it is easy to tell them apart on the timeline and in the list
const TAKE_COLORS = ['#FF6A4D', '#2E86AB', '#7B5EA7', '#3A9D6E', '#C99A1B', '#C2456F']
const takeColor = (i: number) => TAKE_COLORS[i % TAKE_COLORS.length]
const CLIP_SHADES = ['rgba(70,110,160,0.6)', 'rgba(70,140,140,0.6)', 'rgba(110,100,170,0.6)', 'rgba(150,120,80,0.6)']
const clipShade = (i: number) => CLIP_SHADES[i % CLIP_SHADES.length]

const newTakeId = () => Math.random().toString(36).slice(2, 9)

const previewDurations = new Map<string, number>()
const previewUrls = new Map<string, string>()
const previewFileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`
const previewUrlFor = (f: File) => {
  const k = previewFileKey(f)
  let u = previewUrls.get(k)
  if (!u) { u = URL.createObjectURL(f); previewUrls.set(k, u) }
  return u
}
const swapItems = <T,>(list: T[], i: number, j: number): T[] => {
  if (i < 0 || j < 0 || i >= list.length || j >= list.length) return list
  const n = list.slice()
  n[i] = list[j]
  n[j] = list[i]
  return n
}
const splitScriptLines = (s: string) => s.split(/\n+/).map((x) => x.trim()).filter(Boolean)
// Pulls the quoted on-screen text out of a filming step, e.g. "On-screen text: 'Bring your colour samples'" gives ["Bring your colour samples"]
const extractOnScreenText = (step: string): string[] => {
  const found: string[] = []
  // "On-screen text: 'Hello'", "On-screen captions: 'Hello'", "text appears 'Hello'", "title reads \"Hello\""
  const re = /(?:text|captions?|titles?)(?:\s+(?:appears|shows|reads|says|overlay))?\s*:?\s*['"\u2018\u201c](.+?)['"\u2019\u201d](?=\s*(?:$|[.,;!?]|\bthen\b|\band\b|\bwith\b|\bover\b))/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(step)) !== null) {
    const t = m[1].trim()
    if (t) found.push(t)
  }
  if (found.length === 0) {
    // Same label but the words are not in quotes: "On-screen text: Bring your colour samples"
    const plain = /on[\s-]?screen\s+(?:text|captions?|titles?)\s*:\s*([^\n]+?)\s*$/i.exec(step)
    if (plain && plain[1].trim()) found.push(plain[1].trim().replace(/^['"\u2018\u201c]|['"\u2019\u201d]$/g, '').trim())
  }
  return found
}
// A silent film has no spoken words: every filming step carries its own on-screen text. Returns one caption per step, or null when the idea is not a silent one.
const silentCaptions = (item: { checklist?: string[] }): string[] | null => {
  const steps = item.checklist || []
  if (steps.length === 0 || steps.some((st) => /\bsay\s*:/i.test(st))) return null
  const caps = steps.map((st) => extractOnScreenText(st).join(' ').trim())
  return caps.every(Boolean) ? caps : null
}
const fmtClock = (s: number) => {
  const t = Math.max(0, Math.floor(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

function VolumeRow({ label, hint, value, onChange, color }: { label: string; hint?: string; value: number; onChange: (v: number) => void; color: string }) {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: 'minmax(96px, 150px) 1fr 44px', alignItems: 'center', columnGap: 10 }}>
      <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.25 }}>
        {label}
        {hint && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
      </span>
      <input type="range" min={0} max={100} step={5} value={value} aria-label={`${label} volume`}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', minWidth: 0, accentColor: color, cursor: 'pointer' }} />
      <span style={{ fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: value === 0 ? 'var(--text-muted)' : 'var(--ink)' }}>{value === 0 ? 'Off' : `${value}%`}</span>
    </label>
  )
}

// Audio section: the original sound of the clips, then voiceover, then music, each with its own
// volume. Recording itself happens under the preview so it can start wherever the preview was paused.
function AudioPanel({ takes, onAddFile, onRemoveTake, onTakeVolume, statuses, onRetry, originalVol, onOriginalVol, hasMusic, musicVol, onMusicVol, scriptLabel, onOpenRecord, musicPicker }: {
  takes: VoiceTake[]
  onAddFile: (file: File) => void
  onRemoveTake: (id: string) => void
  onTakeVolume: (id: string, v: number) => void
  statuses: Record<string, ClipUploadState>
  onRetry: (id: string) => void
  originalVol: number
  onOriginalVol: (v: number) => void
  hasMusic: boolean
  musicVol: number
  onMusicVol: (v: number) => void
  scriptLabel?: string
  onOpenRecord: () => void
  musicPicker: React.ReactNode
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const card = { border: '1px solid rgba(128,128,128,0.22)', borderRadius: 4, padding: 14, background: 'rgba(128,128,128,0.06)' } as const
  const heading = (title: string, hint: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>{title}</p>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>
    </div>
  )
  const divider = { borderTop: '1px solid rgba(128,128,128,0.15)', paddingTop: 18 } as const
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Audio</p>

      {/* 1. Original audio */}
      <div>
        {heading('Original audio', 'The sound recorded in your clips.')}
        <VolumeRow label="Volume" value={originalVol} onChange={onOriginalVol} color="#4a6fa5" />
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
          {takes.length > 0 ? 'Turned down under your voiceover.' : 'Drag to Off to mute your clips.'}
        </p>
      </div>

      {/* 2. Voiceover */}
      <div style={divider}>
        {heading('Voiceover', 'Talk over your clips.')}
        <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onAddFile(f); e.target.value = '' }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={{ ...choiceBtn(), display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={onOpenRecord}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#d92d20', display: 'inline-block' }} />
            Record voiceover
          </button>
          <button type="button" style={choiceBtn()} onClick={() => fileRef.current?.click()}>Upload a recording</button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
          {scriptLabel
            ? <>Opens your script, <strong style={{ color: 'var(--ink)' }}>{scriptLabel}</strong>, on the preview. Pause where you want to start, then press Record voiceover there. You get a 2 second countdown.</>
            : 'Opens the preview. Pause where you want to start, then press Record voiceover there. You get a 2 second countdown.'}
        </p>

        {takes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {takes.map((t, i) => (
              <div key={t.id} style={{ ...card, position: 'relative', paddingLeft: 18 }}>
                <span aria-hidden style={{ position: 'absolute', left: 6, top: 14, bottom: 14, width: 4, borderRadius: 2, background: takeColor(i) }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: takeColor(i), color: '#fff', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', margin: 0 }}>Voiceover {i + 1}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      {t.duration > 0 ? `${fmtClock(t.start)} to ${fmtClock(t.start + t.duration)} (${Math.max(1, Math.round(t.duration))}s)` : `Starts at ${fmtClock(t.start)}`}
                    </p>
                  </div>
                  <span style={{ flex: 1 }} />
                  <ClipUploadBadge status={statuses[`v:${t.id}`]} onRetry={() => onRetry(t.id)} />
                  <button type="button" onClick={() => onRemoveTake(t.id)}
                    style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: '1px solid rgba(128,128,128,0.35)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>Remove</button>
                </div>
                <div style={{ marginTop: 10 }}>
                  <VolumeRow label="Volume" value={t.volume} onChange={(v) => onTakeVolume(t.id, v)} color={takeColor(i)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Music */}
      <div style={divider}>
        {musicPicker}
        {hasMusic && (
          <div style={{ marginTop: 12 }}>
            <VolumeRow label="Music volume" value={musicVol} onChange={onMusicVol} color="#3A9D6E" />
          </div>
        )}
      </div>
    </div>
  )
}

// Plays the user's clips back to back (respecting trims), shows a timeline with the voiceover
// parts, and records new voiceover starting wherever the preview was paused.
function EditorPreviewInner({ segments, takes, originalVol, musicUrl, musicVol, scriptLines, captionStyle, onAddTake, onRemoveTake, onMoveTake, onReorderClip, onDropFiles, captions, onCaptions, onTrimClip, overlay, onOverlayMove, showScript, selCap, onSelCap, onPlayhead }: {
  segments: VoiceoverSegment[]
  takes: VoiceTake[]
  originalVol: number
  musicUrl: string | null
  musicVol: number
  scriptLines: string[]
  showScript?: boolean
  selCap?: string | null
  onSelCap?: (id: string | null) => void
  onPlayhead?: (t: number, total: number) => void
  onAddTake: (blob: Blob, start: number, duration: number) => void
  onRemoveTake: (id: string) => void
  onMoveTake: (id: string, start: number) => void
  captionStyle?: PreviewCaptionStyle
  onReorderClip?: (from: number, to: number) => void
  onDropFiles?: (files: File[]) => void
  captions?: CustomCaption[]
  onCaptions?: (c: CustomCaption[]) => void
  onTrimClip?: (index: number, start: number, end: number, total: number) => void
  overlay?: OverlayItem | null
  onOverlayMove?: (x: number, y: number) => void
}) {
  const [durations, setDurations] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    segments.forEach((s) => { const d = previewDurations.get(previewFileKey(s.file)); if (d) init[previewFileKey(s.file)] = d })
    return init
  })
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [localTime, setLocalTime] = useState(0)
  const [recording, setRecording] = useState(false)
  const [recFrom, setRecFrom] = useState(0)
  const [micError, setMicError] = useState('')
  // 1x is a normal talking pace (about 2.3 words a second); the script scrolls at this many times that pace
  const [scriptSpeed, setScriptSpeed] = useState(1)
  const ovDragRef = useRef(false)
  const ovVideoRef = useRef<HTMLVideoElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioEls = useRef<Record<string, HTMLAudioElement | null>>({})
  const trackRef = useRef<HTMLDivElement | null>(null)
  const scriptBoxRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)
  const dragTakeRef = useRef<{ id: string; grab: number; sx: number; sy: number; moved: boolean } | null>(null)
  const binRef = useRef<HTMLDivElement | null>(null)
  // A voiceover block being dragged: the bin shows at the bottom of the screen while it moves
  const [takeDrag, setTakeDrag] = useState<{ id: string; over: boolean } | null>(null)
  const clipPressRef = useRef<{ from: number; to: number; startX: number; dragging: boolean } | null>(null)
  const [clipDrag, setClipDrag] = useState<{ from: number; to: number } | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recStartRef = useRef(0)
  const recWallRef = useRef(0)
  const pickRef = useRef<HTMLInputElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const setSelCap = (id: string | null) => onSelCap?.(id)
  const [countdown, setCountdown] = useState<number | null>(null)
  const capDragRef = useRef<{ id: string; mode: 'move' | 'l' | 'r'; startX: number; start: number; end: number } | null>(null)
  const capPosRef = useRef<{ id: string } | null>(null)
  const trimDragRef = useRef<{ i: number; side: 'l' | 'r'; startX: number; scale: number; start: number; end: number; dur: number } | null>(null)
  // While a clip end is being dragged the timeline keeps its scale, so the end follows the finger exactly
  const [trimView, setTrimView] = useState<{ i: number; side: 'l' | 'r'; shift: number; total: number; start: number; end: number } | null>(null)
  // Playback bookkeeping that must not wait for a re-render (this is what kept the voiceover from glitching)
  const indexRef = useRef(0)
  const switchingRef = useRef(false)
  const advancingRef = useRef(false)
  const lastSyncRef = useRef<Record<string, number>>({})

  // Read each clip's length once so the timeline knows the total
  useEffect(() => {
    segments.forEach((s) => {
      const k = previewFileKey(s.file)
      if (previewDurations.has(k)) return
      const probe = document.createElement('video')
      probe.preload = 'metadata'
      probe.onloadedmetadata = () => {
        if (Number.isFinite(probe.duration)) {
          previewDurations.set(k, probe.duration)
          setDurations((prev) => ({ ...prev, [k]: probe.duration }))
        }
      }
      probe.src = previewUrlFor(s.file)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Show the first frame straight away
  useEffect(() => {
    const v = videoRef.current
    const first = segments[0]
    if (!v || !first) return
    const src = previewUrlFor(first.file)
    v.setAttribute('data-src', src)
    v.src = src
    v.onloadedmetadata = () => { v.onloadedmetadata = null; v.currentTime = first.start }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lengths = segments.map((s) => {
    const d = durations[previewFileKey(s.file)] || 0
    const end = s.end != null ? Math.min(s.end, d || s.end) : d
    return Math.max(0, end - s.start)
  })
  const total = lengths.reduce((a, b) => a + b, 0)
  const before = lengths.slice(0, index).reduce((a, b) => a + b, 0)
  const globalTime = Math.min(total, before + localTime)

  const load = (i: number, offset: number, autoplay: boolean) => {
    const v = videoRef.current
    const seg = segments[i]
    if (!v || !seg) return
    indexRef.current = i
    setIndex(i)
    const src = previewUrlFor(seg.file)
    const go = () => {
      v.currentTime = seg.start + offset
      setLocalTime(offset)
      switchingRef.current = false
      advancingRef.current = false
      if (autoplay) void v.play().catch(() => {})
    }
    if (v.getAttribute('data-src') !== src) {
      switchingRef.current = true
      window.setTimeout(() => { switchingRef.current = false }, 2500)
      v.setAttribute('data-src', src)
      v.src = src
      v.onloadedmetadata = () => { v.onloadedmetadata = null; go() }
    } else go()
  }

  const seekGlobal = (t: number, autoplay: boolean) => {
    if (segments.length === 0) return
    let acc = 0
    for (let i = 0; i < segments.length; i++) {
      if (t <= acc + lengths[i] || i === segments.length - 1) {
        load(i, Math.max(0, t - acc), autoplay)
        return
      }
      acc += lengths[i]
    }
  }

  const pauseTakes = () => { Object.values(audioEls.current).forEach((a) => a?.pause()) }

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const stopRecording = () => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
    else stopTracks()
    videoRef.current?.pause()
    pauseTakes()
    setPlaying(false)
    setRecording(false)
  }

  const advance = () => {
    // Both the clip ending and the animation loop can ask for the next clip, so only the first one counts
    if (advancingRef.current) return
    const i = indexRef.current
    if (i + 1 >= segments.length) {
      videoRef.current?.pause()
      pauseTakes()
      setPlaying(false)
      setLocalTime(lengths[i] || 0)
      if (recording) stopRecording()
    } else {
      advancingRef.current = true
      load(i + 1, 0, true)
    }
  }

  // The animation loop below runs from a stale closure, so it reads the latest values from here
  const latest = useRef({ segments, lengths, index, takes, recording, playing, before, advance, musicVol })
  useEffect(() => { latest.current = { segments, lengths, index, takes, recording, playing, before, advance, musicVol } })

  // Keep the playhead moving smoothly, end clips on their trim point and keep voiceover in step
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      const v = videoRef.current
      const L = latest.current
      const idx = indexRef.current
      const seg = L.segments[idx]
      if (v && seg && !switchingRef.current) {
        setLocalTime(Math.max(0, v.currentTime - seg.start))
        if (seg.end != null && v.currentTime >= seg.end - 0.03) {
          L.advance()
          raf = requestAnimationFrame(tick)
          return
        }
        const g = L.lengths.slice(0, idx).reduce((a, b) => a + b, 0) + Math.max(0, v.currentTime - seg.start)
        const now = performance.now()
        const last = lastSyncRef.current
        // Start a sound where it belongs, then only correct it when it has really drifted. Jumping an
        // audio element every frame is what made voiceovers crackle and stutter.
        const sync = (el: HTMLAudioElement, key: string, want: number) => {
          if (el.paused) {
            if (now - (last[key] ?? 0) < 250) return
            last[key] = now
            try { el.currentTime = want } catch {}
            void el.play().catch(() => {})
          } else if (Math.abs(el.currentTime - want) > 0.5 && now - (last[key] ?? 0) > 1500) {
            last[key] = now
            try { el.currentTime = want } catch {}
          }
        }
        L.takes.forEach((t, i) => {
          const el = audioEls.current[t.id]
          if (!el) return
          const end = t.duration > 0 ? t.start + t.duration : Infinity
          const level = Math.min(1, Math.max(0, t.volume / 100))
          if (el.volume !== level) el.volume = level
          const hidden = L.takes.slice(i + 1).some((o) => g >= o.start && g < (o.duration > 0 ? o.start + o.duration : Infinity))
          if (el.muted !== hidden) el.muted = hidden
          if (L.recording || g < t.start || g >= end) { if (!el.paused) el.pause(); return }
          sync(el, t.id, g - t.start)
        })
        // Music is the third layer: it plays from the start of the video, under everything else
        const mus = audioEls.current['music']
        if (mus) {
          const level = Math.min(1, Math.max(0, L.musicVol / 100))
          if (mus.volume !== level) mus.volume = level
          if (L.recording) { if (!mus.paused) mus.pause() }
          else sync(mus, 'music', g)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const vol = recording ? 0 : originalVol / 100
  useEffect(() => { if (videoRef.current) videoRef.current.volume = vol }, [vol, index])

  // Stop the microphone if the preview goes away mid recording
  useEffect(() => () => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') { rec.onstop = null; rec.stop() }
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const toggle = () => {
    const v = videoRef.current
    if (!v || segments.length === 0 || recording) return
    if (playing) {
      v.pause(); pauseTakes(); setPlaying(false)
      return
    }
    if (total > 0 && globalTime >= total - 0.1) seekGlobal(0, true)
    else void v.play().catch(() => {})
    setPlaying(true)
  }

  const startRecording = async () => {
    setMicError('')
    if (segments.length === 0 || recording || countdown !== null) return
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMicError('Recording is not supported in this browser. Use Upload a recording instead.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      streamRef.current = stream
      // Two second countdown so they can get ready before the clips start playing
      setCountdown(2)
      await new Promise((r) => window.setTimeout(r, 1000))
      setCountdown(1)
      await new Promise((r) => window.setTimeout(r, 1000))
      setCountdown(null)
      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      const mimeType = preferred.find((m) => MediaRecorder.isTypeSupported(m))
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      // Recording starts where the preview was paused (or at the start if it was at the very end)
      const startAt = total > 0 && globalTime >= total - 0.2 ? 0 : globalTime
      recStartRef.current = startAt
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        stopTracks()
        const out = new Blob(chunksRef.current, { type: rec.mimeType || mimeType || 'audio/webm' })
        const secs = Math.max(0.3, (uploadStamp() - recWallRef.current) / 1000)
        if (out.size > 0) onAddTake(out, recStartRef.current, secs)
      }
      recorderRef.current = rec
      pauseTakes()
      setRecFrom(startAt)
      setRecording(true)
      setPlaying(true)
      // Start the microphone at the moment the video actually starts moving so they line up
      const v = videoRef.current
      let began = false
      const begin = () => {
        if (began || rec.state !== 'inactive' || !stream.active) return
        began = true
        recWallRef.current = uploadStamp()
        rec.start()
      }
      v?.addEventListener('playing', begin, { once: true })
      window.setTimeout(begin, 1500)
      seekGlobal(startAt, true)
    } catch (e) {
      stopTracks()
      setCountdown(null)
      const name = (e as { name?: string })?.name
      setMicError(name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Microphone access was blocked. Allow the microphone for this site in your browser settings, then try again.'
        : name === 'NotFoundError'
          ? 'No microphone found. Plug one in or use Upload a recording instead.'
          : 'Could not start recording. Try again or use Upload a recording instead.')
    }
  }

  const scaleTotal = trimView ? trimView.total : total
  const pct = (t: number) => `${scaleTotal > 0 ? Math.min(100, Math.max(0, (t / scaleTotal) * 100)) : 0}%`
  const timeAt = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect()
    if (!r || total <= 0 || r.width <= 0) return 0
    return Math.min(total, Math.max(0, ((clientX - r.left) / r.width) * total))
  }

  const clipIndexAt = (clientX: number) => {
    const t = timeAt(clientX)
    let acc = 0
    for (let i = 0; i < lengths.length; i++) {
      acc += lengths[i]
      if (t <= acc) return i
    }
    return Math.max(0, lengths.length - 1)
  }

  const hasClips = segments.length > 0
  useEffect(() => { onPlayhead?.(globalTime, total) }, [onPlayhead, globalTime, total])

  // ---- Captions: each one is a block on the timeline. Blocks that overlap in time sit on their own row (layer).
  const caps = captions || []
  const capRows: Record<string, number> = {}
  const rowEnds: number[] = []
  ;[...caps].sort((a, b) => a.start - b.start).forEach((c) => {
    let r = rowEnds.findIndex((e) => e <= c.start + 0.001)
    if (r === -1) { r = rowEnds.length; rowEnds.push(0) }
    rowEnds[r] = c.end
    capRows[c.id] = r
  })
  const capTop = musicUrl ? 94 : 64
  const trackHeight = caps.length > 0 ? capTop + rowEnds.length * 26 : (musicUrl ? 92 : 62)
  const updateCap = (id: string, patch: Partial<CustomCaption>) => onCaptions?.(caps.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const moveCap = (e: React.PointerEvent) => {
    const d = capDragRef.current
    if (!d || total <= 0) return
    const w = trackRef.current?.getBoundingClientRect().width || 1
    const delta = (e.clientX - d.startX) * (total / w)
    if (d.mode === 'move') {
      const len = d.end - d.start
      const st = Math.min(Math.max(0, total - len), Math.max(0, d.start + delta))
      updateCap(d.id, { start: st, end: st + len })
    } else if (d.mode === 'l') updateCap(d.id, { start: Math.min(d.end - 0.3, Math.max(0, d.start + delta)) })
    else updateCap(d.id, { end: Math.max(d.start + 0.3, Math.min(total, d.end + delta)) })
  }
  const startCapDrag = (e: React.PointerEvent, c: CustomCaption, mode: 'move' | 'l' | 'r') => {
    if (recording) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setSelCap(c.id)
    capDragRef.current = { id: c.id, mode, startX: e.clientX, start: c.start, end: c.end }
  }

  // ---- Trim: the white ends of a clip block on the timeline
  const startTrim = (e: React.PointerEvent, i: number, side: 'l' | 'r') => {
    const seg = segments[i]
    if (recording || !onTrimClip || !seg) return
    const dur = durations[previewFileKey(seg.file)] || 0
    if (dur <= 0) return
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    videoRef.current?.pause()
    pauseTakes()
    setPlaying(false)
    const w = trackRef.current?.getBoundingClientRect().width || 1
    const end0 = seg.end != null ? Math.min(seg.end, dur) : dur
    trimDragRef.current = { i, side, startX: e.clientX, scale: total / w, start: seg.start, end: end0, dur }
    // Show the clip being trimmed in the preview right away
    load(i, 0, false)
    setTrimView({ i, side, shift: 0, total, start: seg.start, end: end0 })
  }
  const moveTrim = (e: React.PointerEvent) => {
    const d = trimDragRef.current
    if (!d || !onTrimClip) return
    const delta = (e.clientX - d.startX) * d.scale
    let ns = d.start
    let ne = d.end
    if (d.side === 'r') ne = Math.min(d.dur, Math.max(d.start + 0.3, d.end + delta))
    else ns = Math.max(0, Math.min(d.end - 0.3, d.start + delta))
    onTrimClip(d.i, ns, ne, d.dur)
    setTrimView((prev) => (prev ? { ...prev, shift: ns - d.start, start: ns, end: ne } : prev))
    // The preview shows the exact frame under the end being dragged
    const v = videoRef.current
    const seg = segments[d.i]
    if (v && seg && v.getAttribute('data-src') === previewUrlFor(seg.file)) {
      try { v.currentTime = d.side === 'l' ? ns : Math.max(ns, ne - 0.05) } catch {}
    }
  }
  const endTrim = () => {
    const d = trimDragRef.current
    trimDragRef.current = null
    setTrimView(null)
    if (d) load(d.i, 0, false)
  }

  // A video overlay plays while the preview plays
  useEffect(() => {
    const v = ovVideoRef.current
    if (!v) return
    if (playing || recording) { v.play().catch(() => {}) } else { v.pause() }
  }, [playing, recording, overlay])

  // While a voiceover is being recorded the script shows one line at a time, with the next line smaller and faded.
  // 1x moves at a normal talking pace (about 2.3 words a second).
  const scriptStarts = (() => {
    let t = 0
    return scriptLines.map((l) => { const st = t; t += Math.max(1.2, l.split(/\s+/).filter(Boolean).length / 2.3); return st })
  })()
  const spokenSecs = Math.max(0, globalTime - recFrom) * scriptSpeed
  let scriptIdx = 0
  scriptStarts.forEach((st, i) => { if (spokenSecs >= st) scriptIdx = i })

  return (
    <div>
      <div ref={stageRef} style={{ width: 'min(100%, calc((100vh - 330px) * 0.5625))', minWidth: 180, aspectRatio: '9 / 16', margin: '0 auto', background: '#000', borderRadius: 4, overflow: 'hidden', position: 'relative', containerType: 'inline-size' }}>
        <video ref={videoRef} playsInline onEnded={advance} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        {captionStyle && caps.filter((c) => globalTime >= c.start && globalTime < c.end).map((c) => {
          const unit = ((c.size ?? captionStyle.size) / 1080) * 100
          const sel = selCap === c.id
          const cFont = CAPTION_TEXT_FONTS.find((f) => f.name === c.font)
          const cBg = c.bg !== undefined ? c.bg : captionStyle.background
          return (
            <div key={c.id} aria-label={`Caption: ${c.text}`}
              onPointerDown={(e) => { if (recording || !onCaptions) return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setSelCap(c.id); capPosRef.current = { id: c.id } }}
              onPointerMove={(e) => {
                const p = capPosRef.current
                const box = stageRef.current?.getBoundingClientRect()
                if (!p || !box) return
                updateCap(p.id, { x: Math.min(0.95, Math.max(0.05, (e.clientX - box.left) / box.width)), y: Math.min(0.95, Math.max(0.05, (e.clientY - box.top) / box.height)) })
              }}
              onPointerUp={() => { capPosRef.current = null }}
              onPointerCancel={() => { capPosRef.current = null }}
              style={{ position: 'absolute', left: `${c.x * 100}%`, top: `${c.y * 100}%`, transform: 'translate(-50%, -50%)', width: '88%', textAlign: 'center', zIndex: 3, cursor: onCaptions ? 'grab' : 'default', touchAction: 'none', outline: sel ? '1.5px dashed rgba(255,255,255,0.85)' : 'none', outlineOffset: 4, fontFamily: cFont ? cFont.css : "Arial Black, 'Poppins', sans-serif", fontWeight: cFont ? cFont.weight : 900, lineHeight: 1.15, fontSize: `${unit}cqw`, color: c.color ?? captionStyle.color, WebkitTextStroke: `${Math.max(0.25, unit * 0.12)}cqw ${captionStyle.border}`, paintOrder: 'stroke fill', textShadow: '0 2px 8px rgba(0,0,0,0.35)', overflowWrap: 'anywhere', ...(cBg ? { background: cBg, padding: '0.25em 0.5em', borderRadius: 4, width: 'auto', maxWidth: '88%', boxDecorationBreak: 'clone' as const, WebkitBoxDecorationBreak: 'clone' as const } : {}) }}>
              {c.text}
            </div>
          )
        })}
        {overlay && globalTime >= overlay.start && (overlay.end === null || globalTime < overlay.end) && (
          <div aria-label="Overlay"
            onPointerDown={(e) => { if (recording || !onOverlayMove) return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); ovDragRef.current = true }}
            onPointerMove={(e) => {
              if (!ovDragRef.current || !onOverlayMove) return
              const box = stageRef.current?.getBoundingClientRect()
              if (!box) return
              onOverlayMove(Math.min(0.95, Math.max(0.05, (e.clientX - box.left) / box.width)), Math.min(0.95, Math.max(0.05, (e.clientY - box.top) / box.height)))
            }}
            onPointerUp={() => { ovDragRef.current = false }}
            onPointerCancel={() => { ovDragRef.current = false }}
            style={{ position: 'absolute', left: `${overlay.x * 100}%`, top: `${overlay.y * 100}%`, width: `${overlay.size * 100}%`, transform: 'translate(-50%, -50%)', zIndex: 2, cursor: onOverlayMove ? 'grab' : 'default', touchAction: 'none' }}>
            {overlay.kind === 'image'
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={overlay.url} alt="" draggable={false} style={{ width: '100%', display: 'block', pointerEvents: 'none' }} />
              : <video ref={ovVideoRef} src={overlay.url} muted loop playsInline style={{ width: '100%', display: 'block', pointerEvents: 'none' }} />}
          </div>
        )}
        {scriptLines.length > 0 && (recording || countdown !== null || showScript) && (() => {
          // A real teleprompter: the text glides up at reading pace and the line being read sits on a fixed reading line.
          const SLOT = 84
          const dur = (i: number) => (scriptStarts[i + 1] ?? scriptStarts[i] + Math.max(1.2, scriptLines[i].split(/\s+/).filter(Boolean).length / 2.3)) - scriptStarts[i]
          const live = recording ? spokenSecs : 0
          const f = Math.min(scriptLines.length - 0.001, scriptIdx + Math.min(1, Math.max(0, (live - scriptStarts[scriptIdx]) / dur(scriptIdx))))
          return (
            <div aria-label="Your script" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '46%', zIndex: 2, pointerEvents: 'none', overflow: 'hidden', background: 'linear-gradient(rgba(8,6,24,0.86) 62%, rgba(8,6,24,0))', WebkitMaskImage: 'linear-gradient(#000 78%, transparent)', maskImage: 'linear-gradient(#000 78%, transparent)' }}>
              <span aria-hidden style={{ position: 'absolute', left: 8, top: 44 + 14, width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '9px solid var(--coral)' }} />
              <div style={{ position: 'absolute', left: 26, right: 16, top: 44, transform: `translateY(${-f * SLOT}px)`, transition: recording ? 'transform 0.4s linear' : 'transform 0.3s ease' }}>
                {scriptLines.map((l, i) => {
                  const d = Math.abs(i - f)
                  const near = Math.max(0, 1 - d)
                  return (
                    <p key={i} style={{ height: SLOT, margin: 0, overflow: 'hidden', fontSize: 19, fontWeight: near > 0.5 ? 700 : 500, lineHeight: 1.3, color: '#fff', opacity: Math.max(0.12, 1 - d * 0.55), transform: `scale(${1 + 0.12 * near})`, transformOrigin: 'left top', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>{l}</p>
                  )
                })}
              </div>
            </div>
          )
        })()}
        {countdown !== null && (
          <div aria-live="assertive" style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }}>
            <span key={countdown} className="scr-cur" style={{ fontSize: 96, fontWeight: 700, color: '#fff', fontFamily: 'var(--serif)' }}>{countdown}</span>
          </div>
        )}
        {!playing && !recording && countdown === null && hasClips && (
          <button type="button" onClick={toggle} aria-label="Play preview"
            style={{ position: 'absolute', inset: 0, margin: 'auto', width: 56, height: 56, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 22, cursor: 'pointer', paddingLeft: 4 }}>▶</button>
        )}
        {recording && (
          <span style={{ position: 'absolute', top: 10, left: 10, zIndex: 3, background: 'rgba(217,45,32,0.9)', color: '#fff', fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '3px 10px' }}>● Recording</span>
        )}
        {!hasClips && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '0 24px', textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5 }}>
            <p style={{ margin: 0 }}>Add a clip to see your video here.</p>
            {onDropFiles && (
              <>
                <input ref={pickRef} type="file" accept="video/*" multiple style={{ display: 'none' }}
                  onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) onDropFiles(files); e.target.value = '' }} />
                <button type="button" onClick={() => pickRef.current?.click()}
                  style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Choose clip</button>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>or drag and drop a video onto this phone</p>
              </>
            )}
          </div>
        )}
      </div>
      {takes.map((t) => (
        <audio key={t.id} ref={(el) => { audioEls.current[t.id] = el }} src={t.url} preload="auto" />
      ))}
      {musicUrl && <audio ref={(el) => { audioEls.current['music'] = el }} src={musicUrl} preload="auto" />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={toggle} disabled={!hasClips || recording || countdown !== null}
          style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 12, cursor: !hasClips || recording ? 'default' : 'pointer', opacity: !hasClips || recording ? 0.4 : 1, flexShrink: 0 }}>
          {playing ? '❚❚' : '▶'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmtClock(globalTime)} / {fmtClock(total)}</span>
        <span style={{ flex: 1 }} />
        {scriptLines.length > 0 && showScript && !recording && countdown === null && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <span title="1x is a normal talking speed">Script speed while you record</span>
            <input type="range" min={1} max={5} step={0.5} value={scriptSpeed} onChange={(e) => setScriptSpeed(Number(e.target.value))} aria-label="Script scroll speed" style={{ width: 90, accentColor: 'var(--coral)' }} />
            <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 28 }}>{scriptSpeed}x</span>
          </label>
        )}
        {!recording ? (showScript || countdown !== null ? (
          <button type="button" onClick={startRecording} disabled={!hasClips || countdown !== null}
            style={{ ...choiceBtn(false, !hasClips || countdown !== null), display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#d92d20', display: 'inline-block' }} />
            {countdown !== null ? 'Get ready' : 'Record voiceover'}
          </button>
        ) : null) : (
          <button type="button" onClick={stopRecording}
            style={{ ...choiceBtn(), background: '#d92d20', border: '1px solid #d92d20', color: '#fff' }}>Stop recording</button>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Video timeline"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(globalTime)}
          onPointerDown={(e) => {
            if (recording || total <= 0) return
            const top = e.currentTarget.getBoundingClientRect().top
            if (onReorderClip && segments.length > 1 && e.clientY - top <= 24) {
              // A press on a clip block: drag it to a new place, or tap to jump there
              const at = clipIndexAt(e.clientX)
              clipPressRef.current = { from: at, to: at, startX: e.clientX, dragging: false }
              e.currentTarget.setPointerCapture(e.pointerId)
              return
            }
            draggingRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); seekGlobal(timeAt(e.clientX), playing)
          }}
          onPointerMove={(e) => {
            const press = clipPressRef.current
            if (press) {
              if (!press.dragging && Math.abs(e.clientX - press.startX) < 8) return
              press.dragging = true
              press.to = clipIndexAt(e.clientX)
              setClipDrag({ from: press.from, to: press.to })
              return
            }
            if (draggingRef.current) seekGlobal(timeAt(e.clientX), playing)
          }}
          onPointerUp={(e) => {
            const press = clipPressRef.current
            clipPressRef.current = null
            draggingRef.current = false
            if (!press) return
            setClipDrag(null)
            if (press.dragging) { if (press.from !== press.to) onReorderClip?.(press.from, press.to) }
            else seekGlobal(timeAt(e.clientX), playing)
          }}
          onPointerCancel={() => { draggingRef.current = false; clipPressRef.current = null; setClipDrag(null) }}
          onKeyDown={(e) => {
            if (recording || total <= 0) return
            if (e.key === 'ArrowRight') { e.preventDefault(); seekGlobal(Math.min(total, globalTime + 1), playing) }
            if (e.key === 'ArrowLeft') { e.preventDefault(); seekGlobal(Math.max(0, globalTime - 1), playing) }
          }}
          style={{ position: 'relative', height: trackHeight, touchAction: 'none', cursor: recording ? 'default' : 'pointer', userSelect: 'none', outlineOffset: 3 }}
        >
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 24, display: 'flex', borderRadius: 4, overflow: 'hidden', background: 'rgba(128,128,128,0.15)' }}>
            {/* eslint-disable-next-line react-hooks/refs -- the handlers only touch refs when the user drags */}
            {lengths.map((len, i) => {
              const moving = clipDrag?.from === i
              const landing = !!clipDrag && clipDrag.to === i && clipDrag.from !== i
              const edge = landing && clipDrag ? (clipDrag.to > clipDrag.from ? 'inset -3px 0 0 #fff' : 'inset 3px 0 0 #fff') : 'none'
              return (
                <div key={i} style={{ position: 'relative', flex: len > 0 ? '0 0 auto' : 1, width: len > 0 ? `${scaleTotal > 0 ? (len / scaleTotal) * 100 : 0}%` : undefined, marginLeft: trimView && trimView.i === i && trimView.side === 'l' && scaleTotal > 0 ? `${(trimView.shift / scaleTotal) * 100}%` : undefined, marginRight: trimView && trimView.i === i && trimView.side === 'l' && scaleTotal > 0 ? `${-(trimView.shift / scaleTotal) * 100}%` : undefined, minWidth: onTrimClip ? 28 : undefined, background: clipShade(i), borderRight: '1px solid rgba(0,0,0,0.25)', fontSize: 10, color: '#fff', display: 'flex', alignItems: 'center', paddingLeft: onTrimClip ? 18 : 6, overflow: 'hidden', opacity: moving ? 0.45 : 1, boxShadow: edge, cursor: onReorderClip && segments.length > 1 && !recording ? 'grab' : 'pointer' }}>
                  {i + 1}
                  {onTrimClip && !recording && (['l', 'r'] as const).map((side) => (
                    <span key={side} role="separator" aria-label={side === 'l' ? `Trim the start of clip ${i + 1}` : `Trim the end of clip ${i + 1}`}
                      onPointerDown={(e) => startTrim(e, i, side)} onPointerMove={(e) => moveTrim(e)} onPointerUp={() => endTrim()} onPointerCancel={() => endTrim()}
                      style={{ position: 'absolute', top: 0, bottom: 0, [side === 'l' ? 'left' : 'right']: 0, width: 14, maxWidth: '40%', background: '#fff', cursor: 'ew-resize', touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: side === 'l' ? '6px 0 0 6px' : '0 6px 6px 0' }}>
                      <span style={{ width: 2, height: 12, background: 'rgba(0,0,0,0.45)', borderRadius: 1, pointerEvents: 'none' }} />
                    </span>
                  ))}
                </div>
              )
            })}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 32, height: 26, borderRadius: 4, background: 'rgba(128,128,128,0.08)', overflow: 'hidden' }}>
            {takes.map((t, ti) => (
              <div key={t.id} title={`Voiceover ${ti + 1} from ${fmtClock(t.start)}. Drag to move it, or drag it down to the bin to delete it.`}
                onPointerDown={(e) => { if (recording || total <= 0) return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); dragTakeRef.current = { id: t.id, grab: timeAt(e.clientX) - t.start, sx: e.clientX, sy: e.clientY, moved: false } }}
                onPointerMove={(e) => {
                  const d = dragTakeRef.current
                  if (!d || d.id !== t.id) return
                  if (!d.moved && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 6) return
                  d.moved = true
                  const r = binRef.current?.getBoundingClientRect()
                  const over = !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
                  setTakeDrag((prev) => (prev && prev.id === t.id && prev.over === over ? prev : { id: t.id, over }))
                  if (over) return
                  const room = Math.max(0, total - (t.duration > 0 ? t.duration : 0))
                  onMoveTake(t.id, Math.min(room, Math.max(0, timeAt(e.clientX) - d.grab)))
                }}
                onPointerUp={() => {
                  const dropped = takeDrag?.over && takeDrag.id === t.id
                  dragTakeRef.current = null
                  setTakeDrag(null)
                  if (dropped) onRemoveTake(t.id)
                }}
                onPointerCancel={() => { dragTakeRef.current = null; setTakeDrag(null) }}
                style={{ position: 'absolute', top: 0, bottom: 0, left: pct(t.start), width: t.duration > 0 ? pct(Math.min(t.duration, Math.max(0, total - t.start))) : `calc(100% - ${pct(t.start)})`, background: `${takeColor(ti)}B3`, border: `1.5px solid ${takeColor(ti)}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box', overflow: 'hidden', cursor: recording ? 'default' : 'grab', touchAction: 'none' }}>
                <span style={{ color: '#fff', pointerEvents: 'none', fontSize: 11, fontWeight: 600, paddingLeft: 7 }}>{ti + 1}</span>
                <button type="button" aria-label="Remove this voiceover part"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onRemoveTake(t.id) }}
                  style={{ background: 'none', border: 'none', color: '#fff', fontSize: 14, lineHeight: 1, cursor: 'pointer', padding: '0 6px' }}>×</button>
              </div>
            ))}
            {recording && (
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: pct(recFrom), width: pct(Math.max(0, globalTime - recFrom)), background: 'rgba(217,45,32,0.9)', borderRadius: 4 }} />
            )}
          </div>
          {musicUrl && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 64, height: 22, borderRadius: 4, background: 'rgba(58,157,110,0.55)', border: '1px solid #3A9D6E', boxSizing: 'border-box', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>Music</div>
          )}
          {/* eslint-disable-next-line react-hooks/refs -- the handlers only touch refs when the user drags */}
          {caps.map((c) => {
            const sel = selCap === c.id
            const grip = (side: 'l' | 'r') => (
              <span key={side} aria-label={side === 'l' ? 'Change when the caption starts' : 'Change when the caption ends'}
                onPointerDown={(e) => startCapDrag(e, c, side)} onPointerMove={(e) => moveCap(e)} onPointerUp={() => { capDragRef.current = null }} onPointerCancel={() => { capDragRef.current = null }}
                style={{ position: 'absolute', top: 0, bottom: 0, [side === 'l' ? 'left' : 'right']: 0, width: 8, background: '#fff', cursor: 'ew-resize', touchAction: 'none', borderRadius: side === 'l' ? '4px 0 0 4px' : '0 4px 4px 0' }} />
            )
            return (
              <div key={c.id} title={`Caption: ${c.text}. Drag to move it, drag the white ends to change how long it shows.`}
                onPointerDown={(e) => startCapDrag(e, c, 'move')} onPointerMove={(e) => moveCap(e)} onPointerUp={() => { capDragRef.current = null }} onPointerCancel={() => { capDragRef.current = null }}
                style={{ position: 'absolute', top: capTop + (capRows[c.id] ?? 0) * 26, height: 22, left: pct(c.start), width: pct(Math.max(0, c.end - c.start)), minWidth: 22, boxSizing: 'border-box', borderRadius: 4, background: sel ? 'var(--coral)' : 'rgba(255,106,77,0.55)', border: `1.5px solid ${sel ? '#fff' : 'var(--coral)'}`, color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', padding: '0 12px', overflow: 'hidden', whiteSpace: 'nowrap', cursor: recording ? 'default' : 'grab', touchAction: 'none' }}>
                <span style={{ pointerEvents: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.text}</span>
                {!recording && grip('l')}
                {!recording && grip('r')}
              </div>
            )
          })}
          <div style={{ position: 'absolute', top: -3, bottom: -3, left: pct(globalTime), width: 2, marginLeft: -1, background: 'var(--ink)', borderRadius: 1, pointerEvents: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span>Clips{onTrimClip ? ' (drag the white ends to trim)' : ''}</span>
          <span>Voiceover</span>
          {musicUrl && <span>Music</span>}
          {caps.length > 0 && <span>Your captions</span>}
        </div>
      {takeDrag && (
        <div ref={binRef} aria-label="Bin: drop a voiceover here to delete it"
          style={{ position: 'fixed', left: '50%', bottom: 24, transform: `translateX(-50%) scale(${takeDrag.over ? 1.08 : 1})`, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 26px', borderRadius: 4, background: takeDrag.over ? '#d92d20' : 'rgba(30,30,34,0.92)', border: `1.5px dashed ${takeDrag.over ? '#fff' : 'rgba(255,255,255,0.5)'}`, color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: 'none', transition: 'background 0.12s, transform 0.12s', pointerEvents: 'none' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>
          {takeDrag.over ? 'Release to delete' : 'Drop here to delete'}
        </div>
      )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
        {recording
          ? 'Recording. Your clips play silently while you talk. Press Stop recording when you are done.'
          : !showScript
            ? 'To talk over your clips, press Record voiceover in the Audio section. Music, captions and transitions are added when you create the video.'
          : takes.length === 0
            ? 'Drag the timeline or press play, pause where you want to start talking, then press Record voiceover. Music, captions and transitions are added when you create the video.'
            : 'Pause where you want the next part to start and press Record voiceover again. A new recording replaces the old one where they overlap.'}
      </p>
      {micError && <p style={{ fontSize: 11, color: 'var(--coral)', margin: '6px 0 0' }}>{micError}</p>}
    </div>
  )
}

function EditorPreview({ segments, takes, originalVol, musicUrl, musicVol, scriptLines, captionStyle, onAddTake, onRemoveTake, onMoveTake, onReorderClip, onDropFiles, captions, onCaptions, onTrimClip, overlay, onOverlayMove, showScript, selCap, onSelCap, onPlayhead }: {
  segments: VoiceoverSegment[]
  takes: VoiceTake[]
  originalVol: number
  musicUrl: string | null
  musicVol: number
  scriptLines: string[]
  showScript?: boolean
  selCap?: string | null
  onSelCap?: (id: string | null) => void
  onPlayhead?: (t: number, total: number) => void
  onAddTake: (blob: Blob, start: number, duration: number) => void
  onRemoveTake: (id: string) => void
  onMoveTake: (id: string, start: number) => void
  onReorderClip?: (from: number, to: number) => void
  captionStyle?: PreviewCaptionStyle
  onDropFiles?: (files: File[]) => void
  captions?: CustomCaption[]
  onCaptions?: (c: CustomCaption[]) => void
  onTrimClip?: (index: number, start: number, end: number, total: number) => void
  overlay?: OverlayItem | null
  onOverlayMove?: (x: number, y: number) => void
}) {
  const [fileOver, setFileOver] = useState(false)
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files')
  // Start fresh when the clips or trims change (voiceover changes keep the playhead where it is)
  const key = segments.map((s) => previewFileKey(s.file)).join('|')
  return (
    <div
      className="ed-preview"
      onDragOver={onDropFiles ? (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (!fileOver) setFileOver(true) } : undefined}
      onDragLeave={onDropFiles ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileOver(false) } : undefined}
      onDrop={onDropFiles ? (e) => { if (!hasFiles(e)) return; e.preventDefault(); setFileOver(false); onDropFiles(Array.from(e.dataTransfer.files)) } : undefined}
      style={{ background: 'var(--sand)', borderRadius: 4, padding: 20, position: 'relative', outline: fileOver ? '2px dashed var(--coral)' : 'none', outlineOffset: -2 }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 12px' }}>Preview</p>
      {fileOver && (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 5, borderRadius: 4, background: 'rgba(255,106,77,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: 'var(--coral)', fontSize: 15, fontWeight: 700 }}>Drop a video to add it as a clip</div>
      )}
      <EditorPreviewInner key={key} onDropFiles={onDropFiles} captions={captions} onCaptions={onCaptions} onTrimClip={onTrimClip} showScript={showScript} selCap={selCap} onSelCap={onSelCap} onPlayhead={onPlayhead} overlay={overlay} onOverlayMove={onOverlayMove} captionStyle={captionStyle} segments={segments} takes={takes} originalVol={originalVol} musicUrl={musicUrl} musicVol={musicVol} scriptLines={scriptLines} onAddTake={onAddTake} onRemoveTake={onRemoveTake} onMoveTake={onMoveTake} onReorderClip={onReorderClip} />
    </div>
  )
}

type ClipUploadState = 'uploading' | 'done' | 'error' | 'toolarge'

// In-flight clip uploads, kept outside React so a re-render never loses track of one
const clipUploadPromises = new Map<string, Promise<string | null>>()

function ClipUploadBadge({ status, onRetry }: { status: ClipUploadState | undefined; onRetry: () => void }) {
  if (!status) return null
  if (status === 'uploading') {
    return <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}><span className="rly-spinner rly-spinner-coral" style={{ marginRight: 5 }} />Uploading</span>
  }
  if (status === 'done') return <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>Ready</span>
  if (status === 'toolarge') return <span style={{ fontSize: 11, color: 'var(--coral)', whiteSpace: 'nowrap', flexShrink: 0 }}>Over 500MB, pick a smaller clip</span>
  return (
    <button type="button" onClick={onRetry} style={{ fontSize: 11, color: 'var(--coral)', background: 'none', border: '1px solid var(--coral)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Upload failed. Retry</button>
  )
}

const uploadStamp = () => Date.now()

// One look for every choice button in the Music and Voiceover sections
const choiceBtn = (active = false, disabled = false) => ({
  background: active ? 'rgba(255,106,77,0.1)' : 'var(--card-bg)',
  border: active ? '1px solid var(--coral)' : '1px solid rgba(128,128,128,0.2)',
  borderRadius: 4,
  padding: '9px 14px',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--ink)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
}) as const

function MusicPicker({ libraryName, musicFile, extractedPath, extracting, extractError, uploadStatus, onOpenLibrary, onPickFile, onExtract, onClear, onRetry }: {
  libraryName: string | null
  musicFile: File | null
  extractedPath: string | null
  extracting: boolean
  extractError: string
  uploadStatus: ClipUploadState | undefined
  onOpenLibrary: () => void
  onPickFile: (f: File | null) => void
  onExtract: (f: File) => void
  onClear: () => void
  onRetry: () => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLInputElement | null>(null)
  const chosen = libraryName ? `${libraryName} (from the library)` : musicFile ? musicFile.name : extractedPath ? 'Sound taken from your video' : null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>Music</p>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Optional.</span>
      </div>
      <input ref={fileRef} type="file" accept="audio/*" onChange={(e) => { onPickFile(e.target.files?.[0] || null); e.target.value = '' }} style={{ display: 'none' }} />
      <input ref={videoRef} type="file" accept="video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onExtract(f); e.target.value = '' }} style={{ display: 'none' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onOpenLibrary} style={choiceBtn(!!libraryName)}>Browse the library</button>
        <button type="button" onClick={() => fileRef.current?.click()} style={choiceBtn(!!musicFile && !libraryName)}>Upload a song</button>
        <button type="button" onClick={() => videoRef.current?.click()} disabled={extracting} style={choiceBtn(!!extractedPath && !libraryName && !musicFile, extracting)}>
          {extracting ? 'Getting the sound...' : 'Use sound from a video'}
        </button>
      </div>
      {chosen ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>Using: {chosen}</span>
          {musicFile && !libraryName && <ClipUploadBadge status={uploadStatus} onRetry={onRetry} />}
          <button type="button" onClick={onClear} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Remove</button>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
          Skip this to keep your clips&apos; own sound.
        </p>
      )}
      {extractError && <p style={{ fontSize: 11, color: 'var(--coral)', marginTop: 6 }}>{extractError}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const carouselInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [libraryPicker, setLibraryPicker] = useState<null | 'any' | 'ai' | 'film'>(null)
  const [deletionScheduledAt, setDeletionScheduledAt] = useState<string | null>(null)
  const [keyEvents, setKeyEvents] = useState<{ id: string; event_text: string; created_at: string }[]>([])
  const [showKeyEventsPanel, setShowKeyEventsPanel] = useState(false)
  const [weeklyObjectives, setWeeklyObjectives] = useState('')
  const [batchGuidance, setBatchGuidance] = useState('')
  const [showProfileNudge, setShowProfileNudge] = useState(false)
  const [seasonalMode, setSeasonalMode] = useState<'seasonal' | 'evergreen' | 'mix'>('mix')
  const [toneOverride, setToneOverride] = useState<string | null>(null)
  const [scriptTopic, setScriptTopic] = useState('')
  const [scriptLength, setScriptLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [scriptStyle, setScriptStyle] = useState('')
  const [generatedScript, setGeneratedScript] = useState<string | null>(null)
  const [savedScripts, setSavedScripts] = useState<{ id: string; topic: string; script: string; length: string | null; style: string | null; created_at: string }[]>([])
  const [dismissedScriptIds, setDismissedScriptIds] = useState<Set<string>>(new Set())
  const [generatingScript, setGeneratingScript] = useState(false)
  const [scriptGenError, setScriptGenError] = useState<string | null>(null)
  const [newKeyEvent, setNewKeyEvent] = useState('')
  const [savingKeyEvent, setSavingKeyEvent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTabState] = useState<Tab>('overview')
  const [editorMode, setEditorMode] = useState<'ai' | 'any'>('ai')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const editBtnRef = useRef<HTMLDivElement>(null)
  const createBtnRef = useRef<HTMLDivElement>(null)
  const params = useParams()
  const setTab = (t: Tab) => {
    setTabState(t)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/dashboard/${t}`)
    }
  }
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [editingScriptItemId, setEditingScriptItemId] = useState<string | null>(null)
  const [editingScriptText, setEditingScriptText] = useState<string>('')
  const [filmingItems, setFilmingItems] = useState<FilmingItem[]>([])
  const [selectedFilmingId, setSelectedFilmingId] = useState<string | null>(null)
  const [stepUploads, setStepUploads] = useState<Record<number, File>>({})
  const [aiUploading, setAiUploading] = useState(false)
  const [aiEditorError, setAiEditorError] = useState('')
  const [aiRenderId, setAiRenderId] = useState<string | null>(null)
  const [aiRenderProgress, setAiRenderProgress] = useState<number>(0)
  const [aiRenderStatus, setAiRenderStatus] = useState<string | null>(null)
  const [aiOutputUrl, setAiOutputUrl] = useState<string | null>(null)
  const [aiCaptionPreset, setAiCaptionPreset] = useState('word_by_word')
  const [aiAddCaptions, setAiAddCaptions] = useState(true)
  const [aiSpeechSteps, setAiSpeechSteps] = useState<Set<number>>(new Set())
  const [aiLandscapeSteps, setAiLandscapeSteps] = useState<Set<number>>(new Set())
  const [showSpeechWarning, setShowSpeechWarning] = useState(false)
  const [aiLandscapeHandling, setAiLandscapeHandling] = useState<'crop' | 'blur' | 'landscape'>('blur')
  const [aiResolution, setAiResolution] = useState<'high' | 'low' | '4k'>('high')
  const [uploadResolution, setUploadResolution] = useState<'high' | 'low' | '4k'>('high')
  const [showMusicLibrary, setShowMusicLibrary] = useState<null | 'ai' | 'upload'>(null)
  const [libraryMusicUrl, setLibraryMusicUrl] = useState<string | null>(null)
  const [libraryMusicName, setLibraryMusicName] = useState<string | null>(null)
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  const MUSIC_LIBRARY_TRACKS = [
    { id: 'track-2', name: 'Chill Lo-fi', mood: 'Relaxed', url: 'https://rhnbpkkghdwegnkystdf.supabase.co/storage/v1/object/public/music-library/chill-lofi.mp3' },
    { id: 'track-3', name: 'Cinematic Build', mood: 'Dramatic', url: 'https://rhnbpkkghdwegnkystdf.supabase.co/storage/v1/object/public/music-library/cinematic.mp3' },
    { id: 'track-4', name: 'Trending Pop', mood: 'Fun', url: 'https://rhnbpkkghdwegnkystdf.supabase.co/storage/v1/object/public/music-library/trending-pop.mp3' },
    { id: 'track-1', name: 'Upbeat Piano', mood: 'Energetic', url: 'https://rhnbpkkghdwegnkystdf.supabase.co/storage/v1/object/public/music-library/upbeat-corporate.mp3' },
  ]
  const [carouselFiles, setCarouselFiles] = useState<File[]>([])
  const [carouselCaption, setCarouselCaption] = useState('')
  const [savingCarousel, setSavingCarousel] = useState(false)
  const [carouselError, setCarouselError] = useState('')
  const [savedCarousels, setSavedCarousels] = useState<{ id: string; image_paths: string[]; caption: string | null; created_at: string }[]>([])
  const [filmScript, setFilmScript] = useState('')
  const [filmScrollSpeed, setFilmScrollSpeed] = useState(3)
  const filmScrollSpeedRef = useRef(3)
  const changeFilmSpeed = (v: number) => { filmScrollSpeedRef.current = v; setFilmScrollSpeed(v) }
  const [filmIsRecording, setFilmIsRecording] = useState(false)
  const [filmCountdown, setFilmCountdown] = useState<number | null>(null)
  const [filmUploading, setFilmUploading] = useState(false)
  const filmVideoRef = useRef<HTMLVideoElement>(null)
  const filmStreamRef = useRef<MediaStream | null>(null)
  const filmMediaRecorderRef = useRef<MediaRecorder | null>(null)
  const [filmSelectedId, setFilmSelectedId] = useState<string | null>(null)
  const filmTeleprompterInnerRef = useRef<HTMLParagraphElement>(null)
  const filmScrollPosRef = useRef(0)
  const filmRafRef = useRef<number | null>(null)
  const [filmCameraActive, setFilmCameraActive] = useState(false)
  const [filmAutoRender, setFilmAutoRender] = useState(false)
  // Start on the back camera (the main one that faces away from you), like the iPhone Camera app
  const [filmFacing, setFilmFacing] = useState<'user' | 'environment'>('environment')
  const filmFacingRef = useRef<'user' | 'environment'>('environment')
  const filmDeviceIdRef = useRef<string | null>(null)
  const [filmMirrored, setFilmMirrored] = useState(false)
  // Camera controls shared with the several videos recorder: grid, timer, quality, torch, zoom and lenses
  const cam = useCameraControls(() => filmStreamRef.current)
  const [filmDeviceLandscape, setFilmDeviceLandscape] = useState(false)
  const [filmReview, setFilmReview] = useState(false)
  const [filmRecorderOpen, setFilmRecorderOpen] = useState(false)
  const [filmRedoIdx, setFilmRedoIdx] = useState<number | null>(null)
  const [filmPlayIdx, setFilmPlayIdx] = useState(0)
  const [filmOrientation, setFilmOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [filmMulti, setFilmMulti] = useState(false)
  const [filmRecordError, setFilmRecordError] = useState('')
  const filmBadMimeRef = useRef<Set<string>>(new Set())
  const [filmMultiBusy, setFilmMultiBusy] = useState(false)
  const filmOrientationRef = useRef<'portrait' | 'landscape'>('portrait')
  const filmOutputOrientationRef = useRef<'portrait' | 'landscape' | null>(null)
  const filmRenderContextRef = useRef<{ ideaId: string | null; source: string; title: string | null; caption: string | null; tags: string | null } | null>(null)
  const [navAtEnd, setNavAtEnd] = useState(true)
  const navScrollRef = useRef<HTMLDivElement | null>(null)
  const checkNavEnd = () => {
    const el = navScrollRef.current
    if (!el) return
    setNavAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
  }
  useEffect(() => {
    window.addEventListener('resize', checkNavEnd)
    return () => window.removeEventListener('resize', checkNavEnd)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [filmLineIdx, setFilmLineIdx] = useState(0)
  const [filmActionsText, setFilmActionsText] = useState('')
  const [filmDurations, setFilmDurations] = useState<(number | null)[]>([])
  const [filmClips, setFilmClips] = useState<{ blob: Blob; ext: string; type: string; url: string }[]>([])
  const [filmPending, setFilmPending] = useState<{ blob: Blob; ext: string; type: string; url: string } | null>(null)
  const [carouselThumbnails, setCarouselThumbnails] = useState<Record<string, string>>({})
  const [uploadSlots, setUploadSlots] = useState<number[]>([0])
  const [uploadSlotFiles, setUploadSlotFiles] = useState<Record<number, File>>({})
  const [uploadTrims, setUploadTrims] = useState<Record<number, ClipTrimRange>>({})
  const [aiTrims, setAiTrims] = useState<Record<number, ClipTrimRange>>({})
  const [uploadSlotPaths, setUploadSlotPaths] = useState<Record<number, string>>({})
  const [uploadSlotTexts, setUploadSlotTexts] = useState<Record<number, string[]>>({})
  const [uploadCaptionOwn, setUploadCaptionOwn] = useState(false)
  const [uploadOwnTexts, setUploadOwnTexts] = useState<Record<number, string>>({})
  const [aiCaptionOwn, setAiCaptionOwn] = useState(false)
  const [aiOwnTexts, setAiOwnTexts] = useState<Record<number, string>>({})
  const [uploadCaps, setUploadCaps] = useState<CustomCaption[]>([])
  const [aiCaps, setAiCaps] = useState<CustomCaption[]>([])
  const [stepUploadPaths, setStepUploadPaths] = useState<Record<number, string>>({})
  const [stepUploadNames, setStepUploadNames] = useState<Record<number, string>>({})
  const [filmingMode, setFilmingMode] = useState<'default' | 'multi' | 'single' | 'quick'>('default')
  const [videoLength, setVideoLength] = useState<number>(30)
  // An image or video laid over the finished video
  const overlayInputRef = useRef<HTMLInputElement | null>(null)
  const [overlay, setOverlay] = useState<OverlayItem | null>(null)
  const [overlayError, setOverlayError] = useState('')
  const overlayUploadRef = useRef<{ file: File; path: string } | null>(null)
  // How many scenes the filming instructions should have. null means let the AI decide.
  const [sceneCount, setSceneCount] = useState<number | null>(null)
  const [aiSingleClipMode, setAiSingleClipMode] = useState(false)
  const [uploadSpeechSlots, setUploadSpeechSlots] = useState<Set<number>>(new Set())
  const [uploadLandscapeSlots, setUploadLandscapeSlots] = useState<Set<number>>(new Set())
  const [uploadAddCaptions, setUploadAddCaptions] = useState(true)
  const [cutDeadSpace, setCutDeadSpace] = useState(false)
  const [showUploadSpeechWarning, setShowUploadSpeechWarning] = useState(false)
  const [extractingAudio, setExtractingAudio] = useState(false)
  const [extractAudioError, setExtractAudioError] = useState('')
  const [generatingFilming, setGeneratingFilming] = useState(false)
  const [selectedIdeaIdsForFilming, setSelectedIdeaIdsForFilming] = useState<string[]>([])
  const [filmingError, setFilmingError] = useState<string | null>(null)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [dbSavedIdeas, setDbSavedIdeas] = useState<Idea[]>([])
  const [totalIdeasGenerated, setTotalIdeasGenerated] = useState(0)
  const [totalFilmingGenerated, setTotalFilmingGenerated] = useState(0)
  const [ideasThisWeek, setIdeasThisWeek] = useState(0)
  const [filmingThisWeek, setFilmingThisWeek] = useState(0)
  const [totalRenders, setTotalRenders] = useState(0)
  const [postsThisWeek, setPostsThisWeek] = useState(0)
  const [scriptsThisWeek, setScriptsThisWeek] = useState(0)
  const [totalRenderSeconds, setTotalRenderSeconds] = useState(0)
  const [lifetimeRenderSeconds, setLifetimeRenderSeconds] = useState(0)
  const [totalLifetimeRenders, setTotalLifetimeRenders] = useState(0)
  const [showOverageModal, setShowOverageModal] = useState(false)
  const [pendingRenderAction, setPendingRenderAction] = useState<(() => void) | null>(null)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [weeklyBatches, setWeeklyBatches] = useState<{ batchNumber: number; ideas: Idea[] }[]>([])
  const [batchIndex, setBatchIndex] = useState<number>(-1)
  const [generatingIdeas, setGeneratingIdeas] = useState(false)
  const [ideaError, setIdeaError] = useState('')
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number } | null>(null)
  const [userPlan, setUserPlan] = useState<'basic' | 'mid' | 'top'>('basic')
  const [realSubPlan, setRealSubPlan] = useState<'basic' | 'mid' | 'top' | null>(null)
  const [realSubStatus, setRealSubStatus] = useState<string | null>(null)
  const [subLoaded, setSubLoaded] = useState(false)
  const [refiningId, setRefiningId] = useState<string | null>(null)
  const [refineInstruction, setRefineInstruction] = useState('')
  const [refineLoading, setRefineLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [renderId, setRenderId] = useState<string | null>(null)
  const [renderProgress, setRenderProgress] = useState<number>(0)
  const [renderStatus, setRenderStatus] = useState<string | null>(null)
  const [renderOverQuota, setRenderOverQuota] = useState(false)
  const [aiRenderOverQuota, setAiRenderOverQuota] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')

  const [captionPreset, setCaptionPreset] = useState('word_by_word')
  const [captionBorderColor, setCaptionBorderColor] = useState('#000000')
  const [showAdvancedCaptions, setShowAdvancedCaptions] = useState(true)
  const [captionFontSize, setCaptionFontSize] = useState<number | string>(60)
  const [captionFontFamily, setCaptionFontFamily] = useState('Sans Bold')
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [voiceTakes, setVoiceTakes] = useState<VoiceTake[]>([])
  const [originalVolPick, setOriginalVolPick] = useState<number | null>(null)
  const [musicVol, setMusicVol] = useState(35)
  const [voiceScript, setVoiceScript] = useState<{ id: string; label: string; lines: string[] } | null>(null)
  // Opened from Audio > Record voiceover: shows the script on the preview before recording starts
  const [scriptOpen, setScriptOpen] = useState(false)
  const [selCap, setSelCap] = useState<string | null>(null)
  const [capDraft, setCapDraft] = useState('')
  const [openCapStyle, setOpenCapStyle] = useState<string | null>(null)
  const playheadRef = useRef({ t: 0, total: 0 })
  const handlePlayhead = useCallback((t: number, total: number) => { playheadRef.current = { t, total } }, [])
  // Original sound stays full volume on its own and drops under a voiceover until the user picks a level
  const originalVol = originalVolPick ?? (voiceTakes.length > 0 ? 35 : 100)
  const [assetPaths, setAssetPaths] = useState<Record<string, string>>({})
  const [landscapeHandling, setLandscapeHandling] = useState<'crop' | 'blur' | 'landscape'>('blur')
  const [extractedMusicPath, setExtractedMusicPath] = useState<string | null>(null)
  const [captionColor, setCaptionColor] = useState('#FFFFFF')
  // Optional coloured box behind the captions. null means transparent.
  const [captionBg, setCaptionBg] = useState<string | null>(null)
  const [captionPosition, setCaptionPosition] = useState<'bottom' | 'top' | 'center'>('center')
  const [captionLayers, setCaptionLayers] = useState<CaptionLayers>(DEFAULT_CAPTION_LAYERS)

  const refreshStats = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const { data: ideasRows } = await supabase.from('generated_ideas').select('checklist, created_at').eq('user_id', user.id).gte('created_at', weekStart.toISOString())
    setIdeasThisWeek((ideasRows || []).length)
    setFilmingThisWeek((ideasRows || []).filter((r) => r.checklist).length)
    const { count: renders } = await supabase.from('renders').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    setTotalRenders(renders || 0)
    const { data: renderRows } = await supabase.from('renders').select('duration_seconds, created_at').eq('user_id', user.id).not('duration_seconds', 'is', null)
    const monthStartMs = Date.parse(getMonthStartISO())
    setLifetimeRenderSeconds((renderRows || []).reduce((sum, r) => sum + (r.duration_seconds || 0), 0))
    setTotalRenderSeconds((renderRows || []).filter((r) => Date.parse(r.created_at) >= monthStartMs).reduce((sum, r) => sum + (r.duration_seconds || 0), 0))
    const { count: lifetimeRenderCount } = await supabase.from('renders').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    setTotalLifetimeRenders(lifetimeRenderCount || 0)
  }

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getUser()
      const user = sessionData.user

      if (!user) {
        const hasLoggedInBefore = localStorage.getItem('reelezy-has-logged-in')
        router.push(hasLoggedInBefore ? '/login' : '/signup')
        return
      }

      setUserId(user.id)

      const { data: subRow } = await supabase
        .from('subscriptions')
        .select('deletion_scheduled_at, plan, status')
        .eq('user_id', user.id)
        .maybeSingle()
      if (subRow?.deletion_scheduled_at) setDeletionScheduledAt(subRow.deletion_scheduled_at)
      if (subRow && (subRow.status === 'active' || subRow.status === 'trialing') && subRow.plan) {
        setUserPlan(subRow.plan as 'basic' | 'mid' | 'top')
      } else {
        setUserPlan('basic') // no active subscription -> default to Basic, matches backend getPlan()
      }
      if (subRow?.plan) {
        setRealSubPlan(subRow.plan as 'basic' | 'mid' | 'top')
        setRealSubStatus(subRow.status)
      }
      setSubLoaded(true)

      const { data: eventsData } = await supabase
        .from('key_events')
        .select('id, event_text, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (eventsData) setKeyEvents(eventsData)

      const { data } = await supabase
        .from('business_profiles')
        .select('business_name, industry, suburb, country, tone, target_audience, core_services, custom_guidance, location_type, local_seasonal_context, brand_personality, words_to_avoid, signature_service, common_objections, current_promotions, customer_problem, key_selling_point, on_camera_people, video_people_count, years_in_business, team_size, upcoming_launches, past_content, worst_content, preferred_formats, competitor_content, equipment, community_ties, notes, price_positioning, customer_source, filming_comfort')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!data) {
        router.push('/onboarding')
        return
      }

      const { data: allIdeas } = await supabase
        .from("generated_ideas")
        .select("*")
        .eq("user_id", user.id)
        .order("batch_number", { ascending: false })

      const monthStart = getMonthStartISO()

      const { count: ideaCount } = await supabase
        .from("generated_ideas")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart)
      setTotalIdeasGenerated(ideaCount || 0)

      const { count: filmingCount } = await supabase
        .from("generated_ideas")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("checklist", "is", null)
        .gte("created_at", monthStart)
      setTotalFilmingGenerated(filmingCount || 0)

      const { count: renderCount } = await supabase
        .from("renders")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart)
      setTotalRenders(renderCount || 0)

      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      weekStart.setHours(0, 0, 0, 0)
      const { count: postsCount } = await supabase
        .from("scheduled_posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "posted")
        .gte("posted_at", weekStart.toISOString())
      setPostsThisWeek(postsCount || 0)

      const { data: durationRows } = await supabase
        .from("renders")
        .select("duration_seconds, created_at")
        .eq("user_id", user.id)
        .not("duration_seconds", "is", null)
      const monthStartMs = Date.parse(monthStart)
      setLifetimeRenderSeconds((durationRows || []).reduce((sum, row) => sum + (row.duration_seconds || 0), 0))
      setTotalRenderSeconds((durationRows || []).filter((row) => Date.parse(row.created_at) >= monthStartMs).reduce((sum, row) => sum + (row.duration_seconds || 0), 0))
      if (allIdeas && allIdeas.length > 0) {
        const toIdea = (row: Record<string, unknown>): Idea => ({
          id: row.id as string,
          title: row.title as string,
          hook: row.hook as string,
          description: row.description as string,
          tags: row.tags as string,
          notes: (row.notes as string) || undefined,
          day_of_week: row.day_of_week as number | undefined,
          source: (row.source as string) || undefined,
        })

        const maxBatch = Math.max(...allIdeas.map((r) => r.batch_number as number))
        const savedRows = allIdeas.filter((r) => r.saved)

        // Only ideas generated since the most recent Monday 12am are navigable via the page arrows,
        // matching the same weekly-reset boundary used for the ideas usage cap.
        const now = new Date()
        const dayOfWeek = now.getDay()
        const daysSinceMonday = (dayOfWeek + 6) % 7
        const mostRecentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday, 0, 0, 0, 0)

        const { data: scriptUsageRow } = await supabase
          .from('business_profiles')
          .select('scripts_generated_this_week, usage_reset_at')
          .eq('user_id', user.id)
          .maybeSingle()
        const scriptResetAt = scriptUsageRow?.usage_reset_at ? new Date(scriptUsageRow.usage_reset_at) : null
        const scriptNeedsReset = !scriptResetAt || scriptResetAt.getTime() < mostRecentMonday.getTime()
        setScriptsThisWeek(scriptNeedsReset ? 0 : (scriptUsageRow?.scripts_generated_this_week || 0))

        const thisWeekRows = allIdeas.filter((r) => new Date(r.created_at as string).getTime() >= mostRecentMonday.getTime())
        setIdeasThisWeek(thisWeekRows.length)
        setFilmingThisWeek(thisWeekRows.filter((r) => r.checklist).length)
        const batchNumbersThisWeek = Array.from(new Set(thisWeekRows.map((r) => r.batch_number as number))).sort((a, b) => a - b)
        const groups = batchNumbersThisWeek.map((bn) => ({
          batchNumber: bn,
          ideas: thisWeekRows.filter((r) => r.batch_number === bn).map(toIdea),
        }))

        setWeeklyBatches(groups)
        setBatchIndex(groups.length - 1)
        setIdeas(groups.length > 0 ? groups[groups.length - 1].ideas : [])
        setCurrentBatch(maxBatch)
        setDbSavedIdeas(savedRows.map(toIdea))
        setSavedIds(new Set(savedRows.map((r) => r.id as string)))

        const filmingRows = (allIdeas || []).filter((r) => r.checklist && r.filming_cleared !== true).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        if (filmingRows.length > 0) {
          setFilmingItems(filmingRows.map((r) => { const c = r.checklist as { steps?: string[]; prep?: string[]; caption?: string; script?: string }; return { ...toIdea(r), checklist: c.steps || [], prep: c.prep || [], caption: c.caption || "", script: c.script || "", directions: (c as {directions?: string[]}).directions || [] } }))
        }
      }

      const { data: carouselRows } = await supabase
        .from("carousels")
        .select("id, image_paths, caption, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      if (carouselRows) setSavedCarousels(carouselRows)

      const { data: scriptRows } = await supabase
        .from('generated_scripts')
        .select('id, topic, script, length, style, created_at, dismissed')
        .eq('user_id', user.id)
        .eq('dismissed', false)
        .order('created_at', { ascending: false })
        .limit(20)
      if (scriptRows) setSavedScripts(scriptRows)

      setProfile(data)

      // Load draft clips for both editors
      if (user.id) {
        const draftRes = await authFetch(`/api/draft-clips`)
        const draftData = await draftRes.json()
        const drafts = draftData.drafts || []

        const uploadDrafts = drafts.filter((d: {editor_type: string}) => d.editor_type === 'upload')
        const aiDrafts = drafts.filter((d: {editor_type: string}) => d.editor_type === 'ai')

        if (uploadDrafts.length > 0) {
          const slots = uploadDrafts.map((d: {slot_index: number}) => d.slot_index)
          setUploadSlots(slots)
          const paths: Record<number, string> = {}
          const names: Record<number, string> = {}
          uploadDrafts.forEach((d: {slot_index: number; file_path: string; file_name: string}) => {
            paths[d.slot_index] = d.file_path
            names[d.slot_index] = d.file_name
          })
          setUploadSlotPaths(paths)
        }

        if (aiDrafts.length > 0) {
          const paths: Record<number, string> = {}
          const names: Record<number, string> = {}
          aiDrafts.forEach((d: {slot_index: number; file_path: string; file_name: string}) => {
            paths[d.slot_index] = d.file_path
            names[d.slot_index] = d.file_name
          })
          setStepUploadPaths(paths)
          setStepUploadNames(names)
        }


      // Resume any in-progress render from localStorage
      try {
        const saved = localStorage.getItem('reelezy-render')
        if (saved) {
          const { id, type, ts } = JSON.parse(saved)
          // Only resume if started within last 30 minutes
          if (Date.now() - ts < 30 * 60 * 1000) {
            if (type === 'upload') {
              setRenderId(id)
              setRenderStatus('queued')
              // Don't redirect - resume silently in background
            } else if (type === 'ai') {
              setAiRenderId(id)
              setAiRenderStatus('queued')
              // Don't redirect - resume silently in background
            }
          } else {
            localStorage.removeItem('reelezy-render')
          }
        }
      } catch {}
      }

      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    const urlTab = params.tab as Tab | undefined
    const validTabs: Tab[] = ["overview", "ideas", "myideas", "filming", "film", "script", "uploads", "aiuploads", "carousel", "scheduler", "library"]
    if (urlTab && validTabs.includes(urlTab)) {
      setTabState(urlTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { const target = e.target as HTMLElement; if (!target.closest('[data-dropdown]')) setOpenDropdown(null) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  // A finished video means its idea and filming instructions are done with (the server has already updated the database)
  const applyFilmCleared = (data: { clearedIdeaId?: string | null; clearedScriptTitle?: string | null }) => {
    const id = data.clearedIdeaId
    if (id) {
      setDbSavedIdeas((prev) => prev.filter((i) => i.id !== id))
      setSavedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
      setFilmingItems((prev) => prev.filter((f) => f.id !== id))
      setSelectedIdeaIdsForFilming((prev) => prev.filter((x) => x !== id))
    }
    const topic = data.clearedScriptTitle
    if (topic) {
      setSavedScripts((prev) => prev.filter((sc) => sc.topic !== topic))
      setDbSavedIdeas((prev) => prev.filter((i) => !(i.source === 'script' && i.title === topic)))
      setFilmingItems((prev) => prev.filter((f) => !(f.source === 'script' && f.title === topic)))
    }
  }

  useEffect(() => {
    if (!renderId || renderStatus === 'done' || renderStatus === 'failed') return

    const interval = setInterval(async () => {
      const res = await authFetch('/api/render-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renderId }),
      })
      const data = await res.json()
      setRenderStatus(data.status)
      if (data.status === 'done') { refreshStats(); applyFilmCleared(data) }
      if (data.overQuota) setRenderOverQuota(true)
      if (typeof data.progress === 'number') setRenderProgress(data.progress)
      if (data.error) setRenderError(data.error)
      if (data.outputUrl) setOutputUrl(data.outputUrl)
    }, 4000)

    return () => clearInterval(interval)
  }, [renderId, renderStatus])

  useEffect(() => {
    if (!aiRenderId || aiRenderStatus === "done" || aiRenderStatus === "failed") return

    const interval = setInterval(async () => {
      const res = await authFetch("/api/render-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renderId: aiRenderId }),
      })
      const data = await res.json()
      setAiRenderStatus(data.status)
      if (data.status === 'done') { refreshStats(); applyFilmCleared(data) }
      if (data.overQuota) setAiRenderOverQuota(true)
      if (typeof data.progress === 'number') setAiRenderProgress(data.progress)
      if (data.outputUrl) setAiOutputUrl(data.outputUrl)
    }, 4000)

    return () => clearInterval(interval)
  }, [aiRenderId, aiRenderStatus])

  useEffect(() => {
    const loadThumbnails = async () => {
      const missing = savedCarousels.filter((c) => c.image_paths.length > 0 && !carouselThumbnails[c.id])
      if (missing.length === 0) return
      const updates: Record<string, string> = {}
      for (const c of missing) {
        const { data, error } = await supabase.storage.from('video-uploads').createSignedUrl(c.image_paths[0], 3600)
        if (!error && data) updates[c.id] = data.signedUrl
      }
      if (Object.keys(updates).length > 0) {
        setCarouselThumbnails((prev) => ({ ...prev, ...updates }))
      }
    }
    loadThumbnails()
  }, [savedCarousels])

  const updateIdeaNotes = (id: string, notes: string) => {
    setIdeas((prev) => prev.map((idea) => (idea.id === id ? { ...idea, notes } : idea)))
    supabase.from("generated_ideas").update({ notes }).eq("id", id).then(() => {})
  }

  const refineIdea = async (idea: Idea) => {
    if (!profile || !refineInstruction.trim()) return
    setRefineLoading(true)
    try {
      const res = await authFetch("/api/refine-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, instruction: refineInstruction, profile, userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to refine idea")

      setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, ...data.idea } : i)))
      setRefiningId(null)
      setRefineInstruction("")
    } catch (err) {
      setIdeaError(err instanceof Error ? err.message : "Failed to refine idea")
    } finally {
      setRefineLoading(false)
    }
  }
  const toggleSave = (id: string) => {
    const idea = ideas.find((i) => i.id === id) || dbSavedIdeas.find((i) => i.id === id)
    const willBeSaved = !savedIds.has(id)

    setSavedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

    if (idea) {
      if (willBeSaved) {
        setDbSavedIdeas((prev) => [...prev, idea])
      } else {
        setDbSavedIdeas((prev) => prev.filter((i) => i.id !== id))
      }
    }

    supabase.from("generated_ideas").update({ saved: willBeSaved }).eq("id", id).then(() => {})
  }
  const generateIdeas = async () => {
    if (!profile || !userId) return
    setGeneratingIdeas(true)
    setIdeaError("")

    try {
      const res = await authFetch("/api/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, customization: profile.custom_guidance || null, userId, peopleCountOverride: profile.video_people_count, weeklyObjectives: weeklyObjectives.trim() || null, seasonalMode, toneOverride }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Request failed")

      const nextBatch = currentBatch + 1
      const rowsToInsert = data.ideas.map((idea: Omit<Idea, "id">) => ({
        user_id: userId,
        title: idea.title,
        hook: idea.hook,
        description: idea.description,
        tags: idea.tags,
        batch_number: nextBatch,
        day_of_week: null,
        saved: false,
      }))

      const { data: inserted, error: insertError } = await supabase
        .from("generated_ideas")
        .insert(rowsToInsert)
        .select()

      if (insertError || !inserted) throw new Error("Failed to save generated ideas")

      const newIdeas: Idea[] = inserted.map((row) => ({
        id: row.id,
        title: row.title,
        hook: row.hook,
        description: row.description,
        tags: row.tags,
        day_of_week: row.day_of_week,
      }))

      setWeeklyBatches((prev) => {
        const updated = [...prev, { batchNumber: nextBatch, ideas: newIdeas }]
        setBatchIndex(updated.length - 1)
        return updated
      })

      setIdeas(newIdeas)
      setCurrentBatch(nextBatch)
      setUserPlan(data.plan === 'free' ? 'basic' : (data.plan || "top"))
      if (data.usage) setUsageInfo(data.usage)

      // Show profile nudge only on first ever generation and only if profile is still sparse
      const isFirstGeneration = (data.usage?.used ?? 0) <= (data.usage ? (data.plan === 'top' ? 7 : data.plan === 'mid' ? 5 : 3) : 3)
      const profileIsSparse = profile && !profile.tone && !profile.target_audience && !profile.key_selling_point && !profile.brand_personality && !profile.customer_problem
      if (isFirstGeneration && profileIsSparse) {
        setTimeout(() => setShowProfileNudge(true), 5000)
      }
    } catch (err) {
      setIdeaError(err instanceof Error ? err.message : "Something went wrong generating ideas. Please try again.")
    } finally {
      setGeneratingIdeas(false)
    }
  }

  const addKeyEvent = async () => {
    if (!userId || !newKeyEvent.trim()) return
    setSavingKeyEvent(true)
    const { data, error } = await supabase
      .from('key_events')
      .insert({ user_id: userId, event_text: newKeyEvent.trim() })
      .select()
      .single()
    setSavingKeyEvent(false)
    if (!error && data) {
      setKeyEvents((prev) => [data, ...prev])
      setNewKeyEvent('')
    }
  }

  const deleteKeyEvent = async (id: string) => {
    setKeyEvents((prev) => prev.filter((ev) => ev.id !== id))
    const { error } = await supabase
      .from('key_events')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('Failed to delete key event:', error)
    }
  }

  const handleCarouselFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setCarouselFiles((prev) => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeCarouselFile = (index: number) => {
    setCarouselFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const moveCarouselFile = (index: number, direction: -1 | 1) => {
    setCarouselFiles((prev) => {
      const newIndex = index + direction
      if (newIndex < 0 || newIndex >= prev.length) return prev
      const updated = [...prev]
      const temp = updated[index]
      updated[index] = updated[newIndex]
      updated[newIndex] = temp
      return updated
    })
  }

  const reorderCarouselFiles = (fromIndex: number, toIndex: number) => {
    setCarouselFiles((prev) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) return prev
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)
      return updated
    })
  }

  const saveCarousel = async () => {
    if (!userId || carouselFiles.length === 0) return
    setSavingCarousel(true)
    setCarouselError('')

    try {
      const paths: string[] = []
      for (const file of carouselFiles) {
        const path = `${userId}/carousels/${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from('video-uploads').upload(path, file)
        if (error) throw new Error(error.message)
        paths.push(path)
      }

      const { data, error: insertError } = await supabase
        .from('carousels')
        .insert({ user_id: userId, image_paths: paths, caption: carouselCaption || null })
        .select()
        .single()

      if (insertError || !data) throw new Error('Failed to save carousel')

      setSavedCarousels((prev) => [data, ...prev])
      setCarouselFiles([])
      setCarouselCaption('')
    } catch (err) {
      setCarouselError(err instanceof Error ? err.message : 'Failed to save carousel. Please try again.')
    } finally {
      setSavingCarousel(false)
    }
  }

  const deleteCarousel = async (id: string) => {
    setSavedCarousels((prev) => prev.filter((c) => c.id !== id))
    await supabase.from('carousels').delete().eq('id', id)
  }

  const fetchCarouselImageBlobs = async (imagePaths: string[]): Promise<{ filename: string; blob: Blob }[]> => {
    const results: { filename: string; blob: Blob }[] = []
    for (let i = 0; i < imagePaths.length; i++) {
      const path = imagePaths[i]
      const { data, error } = await supabase.storage.from('video-uploads').createSignedUrl(path, 3600)
      if (error || !data) continue
      const res = await fetch(data.signedUrl)
      const blob = await res.blob()
      const filename = `image-${i + 1}${path.slice(path.lastIndexOf('.'))}`
      results.push({ filename, blob })
    }
    return results
  }

  const downloadZip = async (files: { filename: string; blob: Blob }[], zipName: string) => {
    const zip = new JSZip()
    for (const f of files) {
      zip.file(f.filename, f.blob)
    }
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = zipName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadCarouselImages = async (imagePaths: string[], index?: number) => {
    const files = await fetchCarouselImageBlobs(imagePaths)
    if (files.length === 0) return
    await downloadZip(files, `carousel${typeof index === 'number' ? `-${index + 1}` : ''}.zip`)
  }

  const downloadAllCarousels = async () => {
    const allFiles: { filename: string; blob: Blob }[] = []
    for (let c = 0; c < savedCarousels.length; c++) {
      const files = await fetchCarouselImageBlobs(savedCarousels[c].image_paths)
      files.forEach((f, i) => {
        allFiles.push({ filename: `carousel-${c + 1}/image-${i + 1}${f.filename.slice(f.filename.lastIndexOf('.'))}`, blob: f.blob })
      })
    }
    if (allFiles.length === 0) return
    await downloadZip(allFiles, 'all-carousels.zip')
  }

  const filmWantedRef = useRef(false)
  const [filmCameraError, setFilmCameraError] = useState('')

  const startFilmCamera = () => {
    setFilmCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setFilmCameraError('This browser does not support camera access. Try Chrome or Safari.')
      return
    }
    const filmSize = cam.sizeConstraints(filmOrientationRef.current === 'landscape')
    const filmCamera = filmDeviceIdRef.current ? { deviceId: { exact: filmDeviceIdRef.current } } : { facingMode: filmFacingRef.current }
    navigator.mediaDevices.getUserMedia({ video: { ...filmCamera, ...filmSize }, audio: true })
      .then(stream => {
        if (!filmWantedRef.current) { stream.getTracks().forEach(t => t.stop()); return }
        filmStreamRef.current?.getTracks().forEach(t => t.stop())
        filmStreamRef.current = stream
        const vt = stream.getVideoTracks()[0]
        if (vt) vt.onended = () => setFilmCameraActive(false)
        if (vt) {
          // Only mirror the preview for a front-facing camera (selfie view); never for the back camera
          const facing = vt.getSettings?.().facingMode
          setFilmMirrored(facing ? facing === 'user' : !/back|rear|environment/i.test(vt.label || ''))
        }
        if (filmVideoRef.current && filmVideoRef.current.srcObject !== stream) filmVideoRef.current.srcObject = stream
        setFilmCameraActive(true)
        cam.onStream(stream)
      })
      .catch(err => {
        console.error('Camera error:', err)
        if (filmDeviceIdRef.current && err && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
          // The remembered camera is gone, fall back to the default one
          filmDeviceIdRef.current = null
          startFilmCamera()
          return
        }
        setFilmCameraActive(false)
        const name = err && err.name
        setFilmCameraError(
          name === 'NotAllowedError' ? 'Camera or microphone is blocked. Click the camera icon in your browser address bar, allow access, then press Enable Camera again.'
          : name === 'NotFoundError' ? 'No camera or microphone was found.'
          : name === 'NotReadableError' ? 'Your camera is being used by another tab or app. Close it, then press Enable Camera again.'
          : 'Could not start the camera. Please try again.'
        )
      })
  }

  const flipFilmCamera = async () => {
    if (filmIsRecording) return
    const currentId = filmStreamRef.current?.getVideoTracks()[0]?.getSettings?.().deviceId
    let cams: MediaDeviceInfo[] = []
    try { cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput') } catch {}
    if (cams.length < 2) { alert('Only one camera was found on this device, so there is nothing to switch to.'); return }
    const next = filmFacingRef.current === 'user' ? 'environment' : 'user'
    // Prefer a camera whose name says front/back, otherwise just move to the next camera in the list
    const wanted = next === 'environment' ? /back|rear|environment/i : /front|user|facetime/i
    const byName = cams.find((d) => d.deviceId !== currentId && wanted.test(d.label))
    const idx = cams.findIndex((d) => d.deviceId === currentId)
    const pick = byName || cams[(idx + 1) % cams.length]
    filmFacingRef.current = next
    setFilmFacing(next)
    filmDeviceIdRef.current = pick.deviceId
    filmStreamRef.current?.getTracks().forEach(t => t.stop())
    filmStreamRef.current = null
    setFilmCameraActive(false)
    startFilmCamera()
  }

  const restartFilmCamera = () => {
    if (filmIsRecording) return
    filmStreamRef.current?.getTracks().forEach(t => t.stop())
    filmStreamRef.current = null
    setFilmCameraActive(false)
    startFilmCamera()
  }

  const pickFilmLens = (id: string) => {
    if (filmIsRecording || id === cam.lensId) return
    filmDeviceIdRef.current = id
    restartFilmCamera()
  }

  const changeFilmOrientation = (o: 'portrait' | 'landscape') => {
    if (o === filmOrientationRef.current || filmIsRecording || filmClips.length > 0 || filmPending) return
    filmOrientationRef.current = o
    setFilmOrientation(o)
    if (filmStreamRef.current) {
      filmStreamRef.current.getTracks().forEach(t => t.stop())
      filmStreamRef.current = null
      setFilmCameraActive(false)
      startFilmCamera()
    }
  }

  const changeOrientationRef = useRef(changeFilmOrientation)
  useEffect(() => { changeOrientationRef.current = changeFilmOrientation })

  // On phones and tablets, follow the way the device is held. Listens to every kind of rotation signal so it works on iPhone and Android.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const touch = window.matchMedia('(pointer: coarse)')
    const landscape = window.matchMedia('(orientation: landscape)')
    const isTouch = () => touch.matches || (navigator.maxTouchPoints || 0) > 0 && /iPhone|iPad|Android/i.test(navigator.userAgent)
    const sync = () => {
      if (!isTouch()) return
      const nowLandscape = typeof screen !== 'undefined' && screen.orientation?.type ? screen.orientation.type.startsWith('landscape') : landscape.matches
      setFilmDeviceLandscape(nowLandscape)
      if (tab !== 'film') return
      changeOrientationRef.current(nowLandscape ? 'landscape' : 'portrait')
    }
    sync()
    landscape.addEventListener('change', sync)
    window.addEventListener('orientationchange', sync)
    window.addEventListener('resize', sync)
    if (typeof screen !== 'undefined' && screen.orientation?.addEventListener) screen.orientation.addEventListener('change', sync)
    return () => {
      landscape.removeEventListener('change', sync)
      window.removeEventListener('orientationchange', sync)
      window.removeEventListener('resize', sync)
      if (typeof screen !== 'undefined' && screen.orientation?.removeEventListener) screen.orientation.removeEventListener('change', sync)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    if (filmCameraActive && filmStreamRef.current && filmVideoRef.current) {
      if (filmVideoRef.current.srcObject !== filmStreamRef.current) filmVideoRef.current.srcObject = filmStreamRef.current
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filmCameraActive])

  // The camera and recorder only run while the full-screen recorder is showing
  const filmRecorderVisible = tab === 'film' && filmRecorderOpen && !filmReview

  useEffect(() => {
    filmWantedRef.current = filmRecorderVisible
    if (filmRecorderVisible) {
      startFilmCamera()
    } else {
      filmStreamRef.current?.getTracks().forEach(t => t.stop())
      filmStreamRef.current = null
      if (filmVideoRef.current) filmVideoRef.current.srcObject = null
      setFilmCameraActive(false)
      setFilmCameraError('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filmRecorderVisible])

  // Leaving the Film tab closes the recorder, so coming back starts on the setup page
  useEffect(() => {
    if (tab === 'film') return
    const t = setTimeout(() => setFilmRecorderOpen(false), 0)
    return () => clearTimeout(t)
  }, [tab])

  const filmLines = filmScript.split(/\n+/).map((s) => s.trim()).filter(Boolean)
  const filmActions = splitScriptLines(filmActionsText)
  const filmClipCount = Math.max(filmLines.length, filmActions.length)
  const filmCurrentLine = filmLines[filmLineIdx] || ''
  const filmCurrentAction = filmActions[filmLineIdx] || ''

  useEffect(() => {
    const el = filmTeleprompterInnerRef.current
    if (!filmIsRecording || !el) {
      if (filmRafRef.current) { cancelAnimationFrame(filmRafRef.current); filmRafRef.current = null }
      if (el) el.style.transform = 'translateX(0)'
      return
    }
    if (!filmCurrentLine) return
    const words = filmCurrentLine.split(/\s+/).filter(Boolean).length
    const distance = el.scrollWidth
    let progress = 0
    let last = 0
    let stopTimer: ReturnType<typeof setTimeout> | null = null
    const tick = (now: number) => {
      if (!last) last = now
      // Read the speed every frame so the slider works while the line is moving
      const secs = Math.max(2, words / (2.3 * (filmScrollSpeedRef.current / 3)))
      progress = Math.min(1, progress + (now - last) / (secs * 1000))
      last = now
      el.style.transform = `translateX(-${distance * progress}px)`
      if (progress < 1) {
        filmRafRef.current = requestAnimationFrame(tick)
      } else {
        stopTimer = setTimeout(() => stopFilmRecording(), 1500)
      }
    }
    filmRafRef.current = requestAnimationFrame(tick)
    return () => {
      if (filmRafRef.current) { cancelAnimationFrame(filmRafRef.current); filmRafRef.current = null }
      if (stopTimer) clearTimeout(stopTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filmIsRecording])

    const cleanFilmLine = (s: string) => s.trim().replace(/^say:\s*/i, '').replace(/^["\u201c\u201d']+|["\u201c\u201d']+$/g, '').trim()

  const splitFilmText = (text: string): string[] => {
    const byLine = text.split(/\n+/).map(cleanFilmLine).filter(Boolean)
    if (byLine.length > 1) return byLine
    const sentences = (text.match(/[^.!?]+[.!?]*/g) || []).map(cleanFilmLine).filter(Boolean)
    return sentences.length > 1 ? sentences : byLine
  }

  const getFilmLines = (item: FilmingItem): string[] => {
    const script = item.script || ''
    const byLine = script.split(/\n+/).map(cleanFilmLine).filter(Boolean)
    const lines = byLine.length > 1 ? byLine : splitFilmText(script)
    if (lines.length > 0) return lines
    // No separate script was saved, so take the spoken words from the filming steps
    return (item.checklist || []).map((st: string) => { const m = st.match(/say:\s*([\s\S]*)$/i); return m ? cleanFilmLine(m[1]) : '' }).filter(Boolean)
  }

  // What the person should physically do in each clip (camera position, hands, movement). One entry per step, never repeated.
  const getFilmActions = (item: FilmingItem): string[] => {
    const dirs = (item.directions || []).map((d: string) => d.trim()).filter(Boolean)
    const fromSteps = (item.checklist || [])
      .map((st: string) => st.replace(/^\s*\d+:\d+\s*(?:to|-|–)\s*\d+:\d+\s*[-–:]?\s*/i, '').replace(/[,;.]?\s*(?:and\s+)?say:.*$/i, '').trim())
      .filter(Boolean)
    const withText = (list: string[]) => list.some((s: string) => /on-?screen text/i.test(s))
    const source = withText(dirs) ? dirs : withText(fromSteps) ? fromSteps : dirs.length > 0 ? dirs : fromSteps
    return source.map(simplifyFilmAction)
  }

  // Keeps an action short: just the first thing to do, with any on-screen text removed
  const simplifyFilmAction = (text: string): string => {
    const t = text
      .replace(/\s+/g, ' ')
      .replace(/[,;.]?\s*(?:and\s+)?(?:show\s+)?on-?screen text\s*:?.*$/i, '')
      .trim()
    const first = (t.match(/^[^.!?]+[.!?]?/)?.[0] || t).trim().replace(/[.]$/, '')
    return first.split(/,\s+(?:then|and then|while|as|so)\s+/i)[0]
  }

  // Joins a list down to n entries by merging neighbours, so nothing is repeated or dropped
  const groupFilmList = (list: string[], n: number, glue: string): string[] =>
    Array.from({ length: n }, (_, i) => list.slice(Math.floor((i * list.length) / n), Math.floor(((i + 1) * list.length) / n)).join(glue))

  // The script and actions for one idea, lined up so each clip has its own words and its own action
  const getFilmPlan = (item: FilmingItem): { lines: string[]; actions: string[]; durations: (number | null)[] } => {
    // Silent films only have on-screen text, so nothing goes on the teleprompter
    const lines = silentCaptions(item) ? [] : getFilmLines(item)
    const actions = getFilmActions(item)
    // Recommended seconds for each action, from the time range on each filming step (0:05 to 0:11 is 6 seconds)
    const steps = (item.checklist || []).map((st: string) => {
      const m = st.match(/(\d+):(\d+)\s*(?:to|-|–)\s*(\d+):(\d+)/i)
      return m ? Math.max(1, (Number(m[3]) * 60 + Number(m[4])) - (Number(m[1]) * 60 + Number(m[2]))) : null
    })
    const durations: (number | null)[] = steps.length === actions.length ? steps : []
    if (lines.length === 0 || actions.length === 0 || lines.length === actions.length) return { lines, actions, durations }
    const n = Math.min(lines.length, actions.length)
    const sumGroup = (i: number): number | null => {
      if (durations.length === 0) return null
      const part = durations.slice(Math.floor((i * durations.length) / n), Math.floor(((i + 1) * durations.length) / n))
      return part.every((d) => d !== null) ? part.reduce((t: number, d) => t + (d as number), 0) : null
    }
    return { lines: groupFilmList(lines, n, ' '), actions: groupFilmList(actions, n, '. Then '), durations: Array.from({ length: n }, (_, i) => actions.length === n ? (durations[i] ?? null) : sumGroup(i)) }
  }

  // The on-screen text of each filming step, lined up with n clips
  const getFilmTexts = (item: FilmingItem, n: number): string[][] => {
    const per = (item.checklist || []).map((st: string) => extractOnScreenText(st))
    if (per.length === 0 || n === 0) return []
    return Array.from({ length: n }, (_, i) => per.slice(Math.floor((i * per.length) / n), Math.floor(((i + 1) * per.length) / n)).flat())
  }

  const selectFilmSource = (id: string | null, lines: string[], actions: string[] = [], durations: (number | null)[] = []) => {
    setFilmRecorderOpen(false)
    setFilmSelectedId(id)
    setFilmScript(lines.join('\n'))
    setFilmActionsText(actions.join('\n'))
    setFilmDurations(durations)
    setFilmLineIdx(0)
    filmClips.forEach((cl) => URL.revokeObjectURL(cl.url))
    setFilmClips([])
    setFilmReview(false)
    setFilmRedoIdx(null)
    if (filmPending) URL.revokeObjectURL(filmPending.url)
    setFilmPending(null)
  }

  const startFilmRecording = async () => {
    if (!filmStreamRef.current || filmClipCount === 0) return
    if (!streamIsLive(filmStreamRef.current)) { setFilmRecordError('The camera stopped. It is restarting, press record again in a moment.'); filmStreamRef.current = null; setFilmCameraActive(false); startFilmCamera(); return }
    setFilmRecordError('')
    for (let n = cam.timer; n > 0; n--) {
      setFilmCountdown(n)
      await new Promise(r => setTimeout(r, 1000))
    }
    setFilmCountdown(null)
    try {
      const mimeType = pickRecorderMime(filmBadMimeRef.current)
      // Record exactly 9:16 (portrait) or 16:9 (landscape). If the camera gives a different shape
      // (a laptop webcam in portrait, say), crop the centre of every frame to the right shape.
      let recordStream: MediaStream = filmStreamRef.current
      let stopCanvas: (() => void) | null = null
      const vid = filmVideoRef.current
      const target = filmOrientationRef.current === 'landscape' ? 16 / 9 : 9 / 16
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
          const cs = canvas.captureStream(cam.frameRate())
          filmStreamRef.current.getAudioTracks().forEach((t) => cs.addTrack(t))
          recordStream = cs
          stopCanvas = () => {
            cancelAnimationFrame(raf)
            cs.getVideoTracks().forEach((t) => t.stop())
          }
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
        if (blob.size === 0) {
          // This format recorded nothing on this device, so the next try uses another one on a fresh camera
          filmBadMimeRef.current.add(mimeType)
          setFilmRecordError('That clip did not record. The camera is restarting, please try it again.')
          filmStreamRef.current?.getTracks().forEach((t) => t.stop())
          filmStreamRef.current = null
          setFilmCameraActive(false)
          startFilmCamera()
          return
        }
        setFilmRecordError('')
        setFilmPending({ blob, ext, type: baseType, url: URL.createObjectURL(blob) })
      }
      recorder.onerror = () => { setFilmRecordError('Recording stopped unexpectedly. Please try again.'); setFilmIsRecording(false) }
      beginRecorder(recorder, mimeType)
      filmMediaRecorderRef.current = recorder
      setFilmIsRecording(true)
    } catch (err) {
      console.error('Recording failed:', err)
      setFilmRecordError('Could not start recording on this browser.')
    }
  }

  const stopFilmRecording = () => {
    if (filmMediaRecorderRef.current) finishRecorder(filmMediaRecorderRef.current)
    setFilmIsRecording(false)
  }

  const redoFilmClip = () => {
    if (filmPending) URL.revokeObjectURL(filmPending.url)
    setFilmPending(null)
  }

  const startRedoFilmClip = (i: number) => {
    setFilmRedoIdx(i)
    setFilmLineIdx(i)
    setFilmReview(false)
  }

  const cancelFilmRedo = () => {
    if (filmPending) URL.revokeObjectURL(filmPending.url)
    setFilmPending(null)
    setFilmRedoIdx(null)
    setFilmLineIdx(0)
    setFilmPlayIdx(0)
    setFilmReview(true)
  }

  const closeFilmRecorder = () => {
    if (filmIsRecording || filmCountdown !== null) return
    if (filmRedoIdx !== null) cancelFilmRedo()
    else if (filmPending) redoFilmClip()
    setFilmRecorderOpen(false)
  }

  const filmBezelStyle = {
    background: '#0b0a10',
    borderRadius: filmOrientation === 'landscape' ? 28 : 42,
    padding: 8,
    boxShadow: 'none',
    width: '100%',
    maxWidth: filmOrientation === 'landscape' ? 720 : 340,
    margin: '0 auto',
    position: 'relative' as const,
  }
  const filmNotch = filmOrientation === 'portrait'
    ? <div aria-hidden="true" style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', width: 76, height: 20, borderRadius: 4, background: '#0b0a10', zIndex: 6, pointerEvents: 'none' }} />
    : null

  const previewCaptionStyle: PreviewCaptionStyle = {
    color: captionColor,
    border: captionBorderColor,
    background: captionBg,
    size: Number(captionFontSize) || 60,
    onScreen: layerPoint(captionLayers, 'onScreen', captionPosition),
    speech: layerPoint(captionLayers, 'speech', captionPosition),
  }

  // Captions are sent as plain data: text, when it shows and where it sits
  const customCaptionStyle = { fontFamily: captionFontFamily, size: Number(captionFontSize) || 60, color: captionColor, borderColor: captionBorderColor, backgroundColor: captionBg ?? undefined }
  const captionTimingNote = cutDeadSpace ? 'Smart Trim is switched off for this video while it has captions, so they stay in time.' : undefined

  // Dragging the ends of a clip on the timeline sets its trim
  const applyTrim = (setter: React.Dispatch<React.SetStateAction<Record<number, ClipTrimRange>>>, key: number, file: File, start: number, end: number, total: number) => {
    setter((prev) => {
      const n = { ...prev }
      if (start <= 0.05 && end >= total - 0.05) delete n[key]
      else n[key] = { start, end, total, file }
      return n
    })
  }
  const trimUploadClip = (i: number, start: number, end: number, total: number) => {
    const id = uploadSlots.filter((slot) => uploadSlotFiles[slot])[i]
    if (id !== undefined && uploadSlotFiles[id]) applyTrim(setUploadTrims, id, uploadSlotFiles[id], start, end, total)
  }
  const trimAiClip = (i: number, start: number, end: number, total: number) => {
    const step = Object.keys(stepUploads).map(Number).sort((a, b) => a - b)[i]
    if (step !== undefined && stepUploads[step]) applyTrim(setAiTrims, step, stepUploads[step], start, end, total)
  }

  // The Audio section: original sound, voiceover and music in their own card
  const renderAudioSection = (musicTarget: 'upload' | 'ai', scriptLabel?: string) => (
    <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px' }}>
      <AudioPanel
        takes={voiceTakes}
        originalVol={originalVol}
        onOriginalVol={setOriginalVolPick}
        hasMusic={!!(musicFile || libraryMusicUrl || extractedMusicPath)}
        musicVol={musicVol}
        onMusicVol={setMusicVol}
        onTakeVolume={setTakeVolume}
        scriptLabel={scriptLabel}
        onOpenRecord={() => { setScriptOpen(true); document.querySelector('.ed-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
        onAddFile={addVoiceFile}
        onRemoveTake={removeVoiceTake}
        statuses={clipUploadStatus}
        onRetry={(id) => { const t = voiceTakes.find((x) => x.id === id); if (t) startAssetUpload(`v:${id}`, t.blob, 'voiceover') }}
        musicPicker={
          <MusicPicker
            libraryName={libraryMusicName}
            musicFile={musicFile}
            extractedPath={extractedMusicPath}
            extracting={extractingAudio}
            extractError={extractAudioError}
            uploadStatus={clipUploadStatus['m']}
            onOpenLibrary={() => setShowMusicLibrary(musicTarget)}
            onPickFile={pickMusicFile}
            onExtract={handleExtractAudio}
            onClear={clearMusic}
            onRetry={() => { if (musicFile) startAssetUpload('m', musicFile, musicFile.name) }}
          />
        }
      />
    </div>
  )

  // Simple blocks shared by both editors. m says which editor's settings to use.
  const subHead = (title: string, hint: string) => (
    <div style={{ marginBottom: 10 }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{title}</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{hint}</p>
    </div>
  )

  // Auto captions: the words from the person's voice, added for them
  // Auto captions: the words from the person's voice, added for them
  const renderAutoCaptions = (m: 'upload' | 'ai') => {
    const on = m === 'ai' ? aiAddCaptions : uploadAddCaptions
    const setOn = m === 'ai' ? setAiAddCaptions : setUploadAddCaptions
    const chosenPreset = m === 'ai' ? aiCaptionPreset : captionPreset
    const setPreset = m === 'ai' ? setAiCaptionPreset : setCaptionPreset
    return (
      <div>
        <label style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: on ? 14 : 0, cursor: 'pointer' }}>
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
          Add auto captions
        </label>
        {on && (
          <>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>Choose how the words appear:</p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 0 }}>
                            {CAPTION_PRESETS.map((preset) => (
                              <button key={preset.id} title={preset.desc} onClick={() => setPreset(preset.id)}
                                style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 4, border: chosenPreset === preset.id ? '2px solid var(--coral)' : '1px solid rgba(128,128,128,0.2)', background: chosenPreset === preset.id ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', cursor: 'pointer' }}>
                                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, color: chosenPreset === preset.id ? 'var(--coral)' : 'var(--ink)' }}>{preset.label}</p>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.35, margin: 0 }}>{preset.desc}</p>
                              </button>
                            ))}
                          </div>
          </>
        )}
      </div>
    )
  }

  // Caption style: one place for how every caption looks, whether typed or from the voice
  const renderCaptionStyle = () => (
    <div>
      <div style={{ background: '#111', borderRadius: 4, height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden', position: 'relative' }}>
                            <p style={{ fontFamily: 'Arial Black, sans-serif', fontSize: Math.min(Number(captionFontSize) * 0.44, 28), fontWeight: 900, color: captionColor, WebkitTextStroke: `2px ${captionBorderColor}`, paintOrder: 'stroke fill', letterSpacing: 1, textAlign: 'center', margin: 0, background: captionBg ?? 'transparent', padding: captionBg ? '4px 12px' : 0, borderRadius: 4 }}>Your caption</p>
                          </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, background: 'var(--card-bg)', padding: 14, borderRadius: 4, marginTop: 8 }}>
                              <div><label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-muted)' }}>Font</label><select value={captionFontFamily} onChange={(e) => setCaptionFontFamily(e.target.value)} style={{ ...inputStyle, marginBottom: 0, fontSize: 12 }}>{FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
                              <div><label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-muted)' }}>Size</label><input type="text" inputMode="numeric" value={captionFontSize} onFocus={(e) => e.target.select()} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ""); setCaptionFontSize(v || "") }} onBlur={(e) => { const v = Number(e.target.value); setCaptionFontSize(v >= 10 ? v : 36) }} style={{ ...inputStyle, marginBottom: 0, fontSize: 12 }} /></div>
                              <div><label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-muted)' }}>Colour</label><input type="color" value={captionColor} onChange={(e) => setCaptionColor(e.target.value)} style={{ ...inputStyle, padding: 4, height: 36, marginBottom: 0 }} /></div>
                              <div><label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-muted)' }}>Background</label>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <input type="color" value={captionBg ?? '#000000'} onChange={(e) => setCaptionBg(e.target.value)} aria-label="Caption background colour" style={{ ...inputStyle, padding: 4, height: 36, marginBottom: 0, flex: 1, minWidth: 0, opacity: captionBg ? 1 : 0.45 }} />
                                  <button type="button" onClick={() => setCaptionBg(null)} disabled={!captionBg} style={{ ...choiceBtn(!captionBg), padding: '0 10px', height: 36, fontSize: 12 }}>None</button>
                                </div></div>
                              <div><label style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-muted)' }}>Position</label><select value={captionPosition} onChange={(e) => setCaptionPosition(e.target.value as 'bottom' | 'top' | 'center')} style={{ ...inputStyle, marginBottom: 0, fontSize: 12 }}><option value="bottom">Bottom</option><option value="center">Center</option><option value="top">Top</option></select></div>
                            </div>
    </div>
  )

  const renderOwnCaptions = (m: 'upload' | 'ai') => {
    const caps = m === 'upload' ? uploadCaps : aiCaps
    const setCaps = m === 'upload' ? setUploadCaps : setAiCaps
    const canAdd = m === 'upload' ? uploadSlots.some((id) => !!uploadSlotFiles[id]) : Object.keys(stepUploads).length > 0
    const add = () => {
      const { t, total } = playheadRef.current
      const text = capDraft.trim()
      if (!text || !canAdd || total <= 0 || caps.length >= 30) return
      const start = t >= total - 0.5 ? Math.max(0, total - 3) : t
      const end = Math.min(total, start + 3)
      const stacked = caps.filter((c) => c.start < end && c.end > start).length
      const id = `cap-${uploadStamp()}-${Math.random().toString(36).slice(2, 6)}`
      setCaps([...caps, { id, text: text.slice(0, 140), start, end, x: 0.5, y: Math.max(0.2, 0.72 - stacked * 0.12) }])
      setSelCap(id)
      setCapDraft('')
    }
    const sel = caps.find((x) => x.id === selCap)
    return (
      <div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" value={capDraft} maxLength={140} disabled={!canAdd} placeholder={canAdd ? 'Type a caption' : 'Add a clip first'} aria-label="Type a caption"
            onChange={(e) => setCapDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 4, border: '1px solid rgba(128,128,128,0.3)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13 }} />
          <button type="button" onClick={add} disabled={!canAdd || !capDraft.trim()} style={{ ...choiceBtn(false, !canAdd || !capDraft.trim()), flexShrink: 0 }}>Add caption</button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
          Shows for 3 seconds at the playhead. Drag it on the preview to place it.
        </p>
        {caps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {caps.map((c) => {
              const patch = (p: Partial<CustomCaption>) => setCaps(caps.map((x) => (x.id === c.id ? { ...x, ...p } : x)))
              const open = openCapStyle === c.id
              const customised = c.font !== undefined || c.size !== undefined || c.color !== undefined || c.bg !== undefined
              const lab = { fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-muted)' } as const
              return (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" value={c.text} maxLength={140} aria-label="Edit caption" onFocus={() => setSelCap(c.id)}
                  onChange={(e) => setCaps(caps.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))}
                  style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 4, border: `1px solid ${sel?.id === c.id ? 'var(--coral)' : 'rgba(128,128,128,0.3)'}`, background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13 }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{c.start.toFixed(1)}s to {c.end.toFixed(1)}s</span>
                <button type="button" onClick={() => setOpenCapStyle(open ? null : c.id)} aria-expanded={open} style={{ ...choiceBtn(open || customised), flexShrink: 0 }}>Text</button>
                <button type="button" onClick={() => { setCaps(caps.filter((x) => x.id !== c.id)); if (selCap === c.id) setSelCap(null) }} style={{ ...choiceBtn(), flexShrink: 0 }}>Delete</button>
              </div>
              {open && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, background: 'var(--card-bg)', padding: 12, borderRadius: 4, border: '1px solid var(--line)' }}>
                  <div><label style={lab}>Font</label>
                    <select value={c.font ?? ''} onChange={(e) => patch({ font: e.target.value || undefined })} style={{ ...inputStyle, marginBottom: 0, fontSize: 12 }}>
                      <option value="">Same as the look</option>
                      {CAPTION_TEXT_FONTS.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                    </select></div>
                  <div><label style={lab}>Size</label>
                    <input type="number" min={16} max={200} placeholder={String(Number(captionFontSize) || 60)} value={c.size ?? ''} onChange={(e) => { const n = Number(e.target.value); patch({ size: e.target.value === '' || !Number.isFinite(n) ? undefined : Math.min(200, Math.max(16, n)) }) }} style={{ ...inputStyle, marginBottom: 0, fontSize: 12 }} /></div>
                  <div><label style={lab}>Colour</label>
                    <input type="color" value={c.color ?? captionColor} onChange={(e) => patch({ color: e.target.value })} aria-label="Caption text colour" style={{ ...inputStyle, padding: 4, height: 36, marginBottom: 0 }} /></div>
                  <div><label style={lab}>Background</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="color" value={(c.bg !== undefined ? c.bg : captionBg) ?? '#000000'} onChange={(e) => patch({ bg: e.target.value })} aria-label="Caption background colour" style={{ ...inputStyle, padding: 4, height: 36, marginBottom: 0, flex: 1, minWidth: 0, opacity: (c.bg !== undefined ? c.bg : captionBg) ? 1 : 0.45 }} />
                      <button type="button" onClick={() => patch({ bg: null })} disabled={c.bg === null || (c.bg === undefined && !captionBg)} style={{ ...choiceBtn(), padding: '0 10px', height: 36, fontSize: 12 }}>None</button>
                    </div></div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" onClick={() => patch({ font: undefined, size: undefined, color: undefined, bg: undefined })} disabled={!customised} style={{ ...choiceBtn(false, !customised), height: 36, fontSize: 12 }}>Use shared look</button>
                  </div>
                </div>
              )}
              </div>
              )
            })}
          </div>
        )}
        {caps.length > 0 && captionTimingNote && <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>{captionTimingNote}</p>}
      </div>
    )
  }

  // The Captions card: auto captions, then the look, then typed captions
  const renderCaptionsCard = (m: 'upload' | 'ai') => (
    <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Captions</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>Add words from your voice, type your own, or both. They all use the same look.</p>
      </div>
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}>
        {subHead('1. Auto captions', 'Words from your voice, added for you.')}
        {renderAutoCaptions(m)}
      </div>
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}>
        {subHead('2. Your own captions', 'Type a caption, then drag its bar on the preview timeline to time it. Press Text on a caption to change its own font, size and colours.')}
        {renderOwnCaptions(m)}
      </div>
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}>
        {subHead('3. Caption look', 'Font, size, colours and where they sit. Applies to both kinds.')}
        {renderCaptionStyle()}
      </div>
    </div>
  )

  // Overlay: an image or video laid over the video, such as a logo or a b-roll clip
  const renderOverlayCard = () => (
    <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Overlay</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>Lay an image or video over your video, like a logo or a product shot. Drag it on the preview to place it.</p>
      </div>
      <input ref={overlayInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => { pickOverlay(e.target.files?.[0] || null); e.target.value = '' }} />
      {!overlay ? (
        <div><button type="button" style={choiceBtn()} onClick={() => overlayInputRef.current?.click()}>Add an image or video</button></div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 4, padding: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: 4, overflow: 'hidden', background: '#111', flexShrink: 0 }}>
              {overlay.kind === 'image'
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={overlay.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <video src={overlay.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <p style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{overlay.file.name}</p>
            <button type="button" style={choiceBtn()} onClick={() => overlayInputRef.current?.click()}>Change</button>
            <button type="button" style={choiceBtn()} onClick={clearOverlay}>Remove</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>
              Size
              <input type="range" min={10} max={100} step={5} value={Math.round(overlay.size * 100)} onChange={(e) => patchOverlay({ size: Number(e.target.value) / 100 })} aria-label="Overlay size" style={{ width: '100%', accentColor: 'var(--coral)', display: 'block', marginTop: 8 }} />
            </label>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>
              Shows from (seconds)
              <input type="number" min={0} step={0.5} value={overlay.start} onChange={(e) => patchOverlay({ start: Math.max(0, Number(e.target.value) || 0) })} style={{ ...inputStyle, marginBottom: 0, marginTop: 6, fontSize: 12 }} />
            </label>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>
              Until (seconds, empty = the end)
              <input type="number" min={0} step={0.5} value={overlay.end ?? ''} placeholder="End" onChange={(e) => patchOverlay({ end: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0) })} style={{ ...inputStyle, marginBottom: 0, marginTop: 6, fontSize: 12 }} />
            </label>
          </div>
        </>
      )}
      {overlayError && <p role="alert" style={{ fontSize: 12, color: '#d92d20', margin: 0 }}>{overlayError}</p>}
    </div>
  )

  // Video quality and Smart Trim
  const renderVideoSettingsBody = (m: 'upload' | 'ai') => {
    const resolution = m === 'ai' ? aiResolution : uploadResolution
    const setResolution = m === 'ai' ? setAiResolution : setUploadResolution
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 8px' }}>Quality</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['high', '1080p', 'Basic and Pro'], ['4k', '4K', 'Pro only']] as const).map(([val, label, desc]) => (
              <button key={val} type="button" onClick={() => { if (val === '4k' && userPlan !== 'top') { window.location.href = '/plans'; return } setResolution(val) }} style={{ flex: 1, padding: '10px 12px', borderRadius: 4, border: resolution === val ? '2px solid var(--coral)' : '1px solid rgba(128,128,128,0.2)', background: resolution === val ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', textAlign: 'left', cursor: 'pointer' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: resolution === val ? 'var(--coral)' : 'var(--ink)', margin: 0 }}>{label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{desc}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 8px' }}>Smart Trim</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: cutDeadSpace ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', border: cutDeadSpace ? '1px solid var(--coral)' : '1px solid rgba(128,128,128,0.2)', borderRadius: 4, padding: '10px 14px' }}>
            <input type="checkbox" checked={cutDeadSpace} onChange={(e) => setCutDeadSpace(e.target.checked)} />
            <span style={{ fontSize: 13, fontWeight: 600, color: cutDeadSpace ? 'var(--coral)' : 'var(--ink)' }}>Cut silences and dead air</span>
          </label>
        </div>
      </div>
    )
  }
  const renderVideoSettings = (m: 'upload' | 'ai') => (
    <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px' }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: '0 0 14px' }}>Video settings</p>
      {renderVideoSettingsBody(m)}
    </div>
  )

  // Used by the review screen after filming
  const renderPreferencesFields = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        {subHead('Auto captions', 'Words from your voice, added for you.')}
        {renderAutoCaptions('upload')}
      </div>
      <div>
        {subHead('Caption look', 'Font, size, colours and where they sit.')}
        {renderCaptionStyle()}
      </div>
      {renderVideoSettingsBody('upload')}
    </div>
  )


  const getVideoSize = (file: File) => new Promise<{ w: number; h: number } | null>((resolve) => {
    const v = document.createElement('video')
    const url = URL.createObjectURL(file)
    const done = (r: { w: number; h: number } | null) => { URL.revokeObjectURL(url); resolve(r) }
    v.preload = 'metadata'
    v.onloadedmetadata = () => done({ w: v.videoWidth, h: v.videoHeight })
    v.onerror = () => done(null)
    setTimeout(() => done(null), 4000)
    v.src = url
  })

  const aiIdeaItem = filmingItems.find((f) => f.id === selectedFilmingId)
  const aiIdeaLines = aiIdeaItem ? getFilmLines(aiIdeaItem) : []
  // Everything that can be filmed in the "Several videos" mode, with its lines, actions and on-screen text
  const multiLowComfort = parseComfort(profile?.filming_comfort).level === 'low'
  const buildMultiIdea = (key: string, title: string, ideaId: string | null, source: 'idea' | 'script', caption: string | null, tags: unknown, lines: string[], actions: string[], durations: (number | null)[] = [], stepTexts: string[][] = []): MultiFilmIdea => ({
    key, title, ideaId, source, caption, tags, lines, actions, durations,
    texts: Array.from({ length: Math.max(lines.length, actions.length) }, (_, i) => {
      if (stepTexts[i] && stepTexts[i].length > 0) return stepTexts[i]
      const fromAction = extractOnScreenText(actions[i] || '')
      return fromAction.length > 0 ? fromAction : multiLowComfort && lines[i] ? [lines[i]] : []
    }),
  })
  const multiFilmIdeas: MultiFilmIdea[] = [
    ...filmingItems.filter((i) => !i.id.startsWith('script-') && i.source !== 'script').map((i) => {
      const plan = getFilmPlan(i)
      return buildMultiIdea(`idea:${i.id}`, i.title || 'Idea', i.id, 'idea', i.caption || null, i.tags || null, plan.lines, plan.actions, plan.durations, getFilmTexts(i, Math.max(plan.lines.length, plan.actions.length)))
    }),
    ...dbSavedIdeas.filter((i) => i.source !== 'script' && !filmingItems.some((f) => f.id === i.id)).map((i) => buildMultiIdea(`idea:${i.id}`, i.title || 'Idea', i.id, 'idea', null, i.tags || null, [], [])),
    ...savedScripts.map((s) => {
      const fi = filmingItems.find((f) => f.id === `script-${s.id}` || (f.source === 'script' && f.title === s.topic))
      const plan = fi ? getFilmPlan(fi) : { lines: splitFilmText(s.script), actions: [] as string[], durations: [] as (number | null)[] }
      return buildMultiIdea(`script-${s.id}`, s.topic, null, 'script', null, null, plan.lines, plan.actions, plan.durations, fi ? getFilmTexts(fi, Math.max(plan.lines.length, plan.actions.length)) : [])
    }),
  ]
  const musicFileUrl = musicFile ? previewUrlFor(musicFile) : null
  const previewMusicUrl = libraryMusicUrl || musicFileUrl

  const finishFilm = async (clips: { blob: Blob; ext: string; type: string; url: string }[], renderNow = true) => {
    setFilmUploading(true)
    try {
      const filmItem = filmSelectedId?.startsWith('idea:') ? filmingItems.find((f) => f.id === filmSelectedId.slice(5)) : undefined
      const filmSavedIdea = !filmItem && filmSelectedId?.startsWith('idea:') ? dbSavedIdeas.find((i) => i.id === filmSelectedId.slice(5)) : undefined
      const filmScriptRow = savedScripts.find((s) => `script-${s.id}` === filmSelectedId)
      filmRenderContextRef.current = filmItem
        ? { ideaId: filmItem.id.startsWith('script-') ? null : filmItem.id, source: 'idea', title: filmItem.title || null, caption: filmItem.caption || null, tags: filmItem.tags || null }
        : filmSavedIdea
        ? { ideaId: filmSavedIdea.id, source: 'idea', title: filmSavedIdea.title || null, caption: null, tags: filmSavedIdea.tags || null }
        : filmScriptRow
        ? { ideaId: null, source: 'script', title: filmScriptRow.topic, caption: null, tags: null }
        : null
      filmOutputOrientationRef.current = filmOrientationRef.current
      const stamp = uploadStamp()
      const results = await Promise.all(clips.map(async (cl, i) => {
        const filePath = `${userId}/film/filmed-${stamp}-${i}.${cl.ext}`
        const { data, error } = await supabase.storage.from('video-uploads').upload(filePath, cl.blob, { contentType: cl.type, upsert: true })
        if (error || !data) throw new Error('upload failed')
        return { path: data.path, file: new File([cl.blob], `filmed-${stamp}-${i}.${cl.ext}`, { type: cl.type }) }
      }))
      // Cut the first and last 0.3 seconds of each filmed clip (screen taps). The trim tool can still change this.
      const filmDurs = await Promise.all(results.map((r) => getVideoDuration(r.file)))
      const filmTrims: Record<number, ClipTrimRange> = {}
      results.forEach((r, i) => { const d = filmDurs[i]; if (d > 1.5 && d !== 5) filmTrims[i] = { start: 0.3, end: d - 0.3, total: d, file: r.file } })
      setUploadTrims(filmTrims)
      const slots = results.map((_, i) => i)
      const filesMap: Record<number, File> = {}
      const pathsMap: Record<number, string> = {}
      results.forEach((r, i) => { filesMap[i] = r.file; pathsMap[i] = r.path })
      setUploadSlots(slots)
      setUploadSlotFiles(filesMap)
      setUploadSlotPaths(pathsMap)
      const filmActionLines = splitScriptLines(filmActionsText)
      const filmScriptLines = splitScriptLines(filmScript)
      const lowComfort = parseComfort(profile?.filming_comfort).level === 'low'
      const slotTexts: Record<number, string[]> = {}
      results.forEach((_, i) => {
        const fromAction = extractOnScreenText(filmActionLines[i] || '')
        const use = fromAction.length > 0 ? fromAction : lowComfort && filmScriptLines[i] ? [filmScriptLines[i]] : []
        if (use.length > 0) slotTexts[i] = use
      })
      setUploadSlotTexts(slotTexts)
      setUploadSpeechSlots(new Set(slots))
      const wideSlots = new Set<number>()
      if (filmOrientationRef.current === 'portrait') {
        const sizes = await Promise.all(results.map((r) => getVideoSize(r.file)))
        sizes.forEach((s, i) => { if (s && s.w > s.h) wideSlots.add(i) })
      }
      setUploadLandscapeSlots(wideSlots)
      const scriptLinesDone = splitScriptLines(filmScript)
      if (scriptLinesDone.length > 0) setVoiceScript({ id: 'film', label: filmItem?.title || filmSavedIdea?.title || filmScriptRow?.topic || 'Your filmed script', lines: scriptLinesDone })
      setFilmSelectedId(null)
      clips.forEach((cl) => URL.revokeObjectURL(cl.url))
      setFilmClips([])
      setFilmLineIdx(0)
      setFilmReview(false)
      setFilmRecorderOpen(false)
      if (renderNow) setFilmAutoRender(true)
      setTab('uploads')
    } catch (err) {
      console.error('Film upload failed:', err)
      alert('Upload failed. Your clips are kept, press Retry upload.')
    }
    setFilmUploading(false)
  }

  const saveFilmClip = () => {
    if (!filmPending) return
    const clip = { blob: filmPending.blob, ext: filmPending.ext, type: filmPending.type, url: filmPending.url }
    setFilmPending(null)
    if (filmRedoIdx !== null) {
      const next = [...filmClips]
      if (next[filmRedoIdx]) URL.revokeObjectURL(next[filmRedoIdx].url)
      next[filmRedoIdx] = clip
      setFilmClips(next)
      setFilmRedoIdx(null)
      setFilmLineIdx(0)
      setFilmPlayIdx(0)
      setFilmReview(true)
      return
    }
    const clips = [...filmClips, clip]
    setFilmClips(clips)
    if (filmLineIdx + 1 < filmClipCount) {
      setFilmLineIdx(filmLineIdx + 1)
    } else {
      setFilmPlayIdx(0)
      setFilmReview(true)
    }
  }

  useEffect(() => {
    if (filmAutoRender && uploadSlotFiles[0]) {
      setFilmAutoRender(false)
      runUploadAndRender()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filmAutoRender, uploadSlotFiles])

    const togglePreviewTrack = (trackId: string, url: string) => {
    if (previewingTrackId === trackId) {
      previewAudioRef.current?.pause()
      setPreviewingTrackId(null)
      return
    }
    if (!url) return
    previewAudioRef.current?.pause()
    const audio = new Audio(url)
    audio.play()
    audio.onended = () => setPreviewingTrackId(null)
    previewAudioRef.current = audio
    setPreviewingTrackId(trackId)
  }

  const selectLibraryTrack = (trackId: string, name: string, url: string, target: 'ai' | 'upload') => {
    previewAudioRef.current?.pause()
    setPreviewingTrackId(null)
    setLibraryMusicUrl(url)
    setLibraryMusicName(name)
    setMusicFile(null)
    setExtractedMusicPath(null)
    setShowMusicLibrary(null)
  }

  const clearFilming = async () => {
    if (filmingItems.length === 0) return
    const ids = filmingItems.map((i) => i.id)
    setFilmingItems([])
    await supabase.from("generated_ideas").update({ filming_cleared: true }).in("id", ids)
  }

  const undoIdeas = () => {
    if (batchIndex <= 0) return
    const newIndex = batchIndex - 1
    setBatchIndex(newIndex)
    setIdeas(weeklyBatches[newIndex].ideas)
    setCurrentBatch(weeklyBatches[newIndex].batchNumber)
  }

  const redoIdeas = () => {
    if (batchIndex >= weeklyBatches.length - 1) return
    const newIndex = batchIndex + 1
    setBatchIndex(newIndex)
    setIdeas(weeklyBatches[newIndex].ideas)
    setCurrentBatch(weeklyBatches[newIndex].batchNumber)
  }

  const proceedToFilming = async (ideasToGenerate: Idea[]) => {
    if (!profile) return
    setGeneratingFilming(true)
    setTab("filming")
    setFilmingError(null)

    try {
      const results = await Promise.allSettled(
        ideasToGenerate.map((idea) =>
          authFetch("/api/generate-checklist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idea, profile, customization: profile.custom_guidance, userId, peopleCountOverride: profile.video_people_count, filmingMode, videoLength, sceneCount }),
          }).then(async (res) => {
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Request failed")
            return { idea, data }
          })
        )
      )

      const merged: FilmingItem[] = []
      let failCount = 0

      for (const result of results) {
        if (result.status === "fulfilled") {
          const { idea, data } = result.value
          const item: FilmingItem = {
            ...idea,
            checklist: data.checklist || [],
            prep: data.prep || [],
            caption: data.caption || "",
            script: data.script || "",
            directions: Array.isArray(data.directions) ? data.directions : [],
          }
          merged.push(item)
          if (item.id.startsWith('script-')) {
            // Script-based ideas don't exist in generated_ideas - insert a new row
            // Check if a row already exists for this script idea
            const { data: existing } = await supabase
              .from("generated_ideas")
              .select("id, saved")
              .eq("user_id", userId)
              .eq("title", item.title)
              .eq("source", "script")
              .maybeSingle()

            // Don't re-save if user has explicitly removed it
            if (existing && existing.saved === false) {
              continue
            }

            let inserted = existing
            if (!existing) {
              const { data: newRow } = await supabase
                .from("generated_ideas")
                .insert({
                  user_id: userId,
                  title: item.title,
                  hook: item.hook,
                  description: item.description,
                  tags: item.tags,
                  saved: true,
                  batch_number: 0,
                  checklist: { steps: item.checklist, prep: item.prep, caption: item.caption, script: item.script, directions: item.directions },
                  filming_cleared: false,
                  source: 'script',
                })
                .select()
                .single()
              inserted = newRow
            } else {
              // Update checklist on existing row
              await supabase
                .from("generated_ideas")
                .update({ checklist: { steps: item.checklist, prep: item.prep, caption: item.caption, script: item.script, directions: item.directions }, filming_cleared: false, saved: true })
                .eq("id", existing.id)
            }
            if (inserted) {
              // Update the item id to the real DB id so future operations work
              merged[merged.length - 1] = { ...item, id: inserted.id }
            }
          } else {
            await supabase
              .from("generated_ideas")
              .update({ checklist: { steps: item.checklist, prep: item.prep, caption: item.caption, script: item.script, directions: item.directions }, filming_cleared: false })
              .eq("id", item.id)
          }
        } else {
          failCount++
        }
      }

      setFilmingItems((prev) => {
        // Merge: new items at top, update existing, keep rest
        const mergedIds = new Set(merged.map((m) => m.id))
        const kept = prev.filter((i) => !mergedIds.has(i.id))
        return [...merged, ...kept]
      })
      if (failCount > 0) {
        setFilmingError(`${failCount} of ${ideasToGenerate.length} idea${failCount > 1 ? "s" : ""} failed to generate. You can try again for those.`)
      }
    } catch (err) {
      setFilmingError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setGeneratingFilming(false); refreshStats()
    }
  }

  const generateFreeformScript = async () => {
    if (!scriptTopic.trim()) return
    setGeneratingScript(true)
    setScriptGenError(null)
    setGeneratedScript(null)

    try {
      const res = await authFetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: scriptTopic, length: scriptLength, style: scriptStyle, profile, userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Request failed")

      const newScript = data.script || ""
      setGeneratedScript(newScript)
      if (newScript && userId) {
        const { data: inserted } = await supabase
          .from('generated_scripts')
          .insert({ user_id: userId, topic: scriptTopic, script: newScript, length: scriptLength, style: scriptStyle || null })
          .select()
          .single()
        if (inserted) setSavedScripts((prev) => [inserted, ...prev])
      }
    } catch (err) {
      setScriptGenError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setGeneratingScript(false)
    }
  }

  const downloadVideo = async (url: string, filename: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error("Download failed", err)
    }
  }

  const isVideoFile = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(f.name)

  // Any-video editor: drag a clip block on the preview timeline to a new place
  const reorderUploadClip = (from: number, to: number) => {
    const filled = uploadSlots.filter((id) => uploadSlotFiles[id])
    const fromId = filled[from]
    const toId = filled[to]
    if (fromId === undefined || toId === undefined || fromId === toId) return
    setUploadSlots((prev) => {
      const fromIdx = prev.indexOf(fromId)
      const toIdx = prev.indexOf(toId)
      if (fromIdx < 0 || toIdx < 0) return prev
      const next = [...prev]
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, fromId)
      return next
    })
  }

  // Any-video editor: videos dropped on the preview fill empty clip slots first, then add new ones
  const addUploadFiles = (files: File[]) => {
    if (!userId) return
    const vids = files.filter(isVideoFile)
    if (vids.length === 0) return
    const empty = uploadSlots.filter((id) => !uploadSlotFiles[id])
    let nextId = Math.max(-1, ...uploadSlots) + 1
    const added: number[] = []
    const assign: Record<number, File> = {}
    vids.forEach((f) => {
      let id: number
      if (empty.length > 0) id = empty.shift() as number
      else { id = nextId++; added.push(id) }
      assign[id] = f
    })
    if (added.length > 0) setUploadSlots((prev) => [...prev, ...added])
    setUploadSlotFiles((prev) => ({ ...prev, ...assign }))
    Object.entries(assign).forEach(([id, f]) => startClipUpload('u', Number(id), f))
  }

  // AI editor: the steps are fixed, so dropped videos fill the next empty steps in order
  const addAiFiles = (files: File[]) => {
    if (!userId) return
    const vids = files.filter(isVideoFile)
    if (vids.length === 0) return
    const item = filmingItems.find((f) => f.id === selectedFilmingId)
    const stepCount = aiSingleClipMode ? 1 : item?.checklist.length || 0
    const empty: number[] = []
    for (let i = 0; i < stepCount; i++) if (!stepUploads[i]) empty.push(i)
    const used = vids.slice(0, empty.length)
    used.forEach((f, n) => {
      const idx = empty[n]
      setStepUploads((prev) => ({ ...prev, [idx]: f }))
      startClipUpload('a', idx, f)
    })
    if (used.length < vids.length) {
      setAiEditorError(used.length === 0 ? 'Choose an idea first, or every step already has a clip.' : `Only ${used.length} ${used.length === 1 ? 'step was' : 'steps were'} empty, so the other ${vids.length - used.length} ${vids.length - used.length === 1 ? 'video was' : 'videos were'} not added.`)
    }
  }

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.preload = "metadata"
      video.onloadedmetadata = () => {
        if (!isFinite(video.duration)) {
          // Browser-recorded video reports no duration until seeked to the end
          video.currentTime = 1e101
          video.ontimeupdate = () => {
            video.ontimeupdate = null
            URL.revokeObjectURL(video.src)
            resolve(isFinite(video.duration) && video.duration > 0 ? video.duration : 5)
          }
        } else {
          URL.revokeObjectURL(video.src)
          resolve(video.duration || 5)
        }
      }
      video.onerror = () => resolve(5)
      video.src = URL.createObjectURL(file)
    })
  }

  const isLandscapeVideo = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.preload = "metadata"
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src)
        // Use displayed dimensions (respects rotation metadata on iPhone MOVs)
        const w = video.videoWidth
        const h = video.videoHeight
        // If dimensions are equal it's square, not landscape
        resolve(w > h)
      }
      video.onerror = () => resolve(false)
      // Force the video to render so browser applies rotation
      video.style.position = 'fixed'
      video.style.visibility = 'hidden'
      document.body.appendChild(video)
      video.src = URL.createObjectURL(file)
      setTimeout(() => {
        try { document.body.removeChild(video) } catch {}
      }, 2000)
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadError('')
    }
  }

  const BASIC_CAP_MIN = 10
  const PRO_CAP_MIN = 25
  const PREMIUM_CAP_MIN = 60

  const isOverRenderCap = () => {
    const capMin = userPlan === "top" ? PREMIUM_CAP_MIN : userPlan === "mid" ? PRO_CAP_MIN : BASIC_CAP_MIN
    return totalRenderSeconds / 60 >= capMin
  }

  const gateRenderAction = (action: () => void) => {
    if (isOverRenderCap()) {
      setPendingRenderAction(() => action)
      setShowOverageModal(true)
    } else {
      action()
    }
  }

  // Clips start uploading the moment they are picked, so "Create video" only has to wait for
  // whatever is still in flight instead of uploading everything from scratch.
  const [clipUploadStatus, setClipUploadStatus] = useState<Record<string, ClipUploadState>>({})

  const startClipUpload = (kind: 'u' | 'a', idx: number, file: File) => {
    if (!userId) return
    const key = `${kind}${idx}`
    const setPaths = kind === 'u' ? setUploadSlotPaths : setStepUploadPaths
    // The old path belongs to the previous file, so never let a render use it
    setPaths((prev) => { const n = { ...prev }; delete n[idx]; return n })
    if (file.size > 500 * 1024 * 1024) {
      clipUploadPromises.delete(key)
      setClipUploadStatus((prev) => ({ ...prev, [key]: 'toolarge' }))
      return
    }
    setClipUploadStatus((prev) => ({ ...prev, [key]: 'uploading' }))
    const safeName = file.name.replace(/[^\w.-]+/g, '_')
    const path = `${userId}/drafts/${kind === 'u' ? 'upload' : 'ai'}-${idx}-${Date.now()}-${safeName}`
    const p: Promise<string | null> = supabase.storage.from('video-uploads').upload(path, file)
      .then(({ error }) => {
        const latest = clipUploadPromises.get(key) === p
        if (error) {
          if (latest) setClipUploadStatus((prev) => ({ ...prev, [key]: 'error' }))
          return null
        }
        if (latest) {
          setPaths((prev) => ({ ...prev, [idx]: path }))
          setClipUploadStatus((prev) => ({ ...prev, [key]: 'done' }))
        }
        return path
      })
      .catch(() => {
        if (clipUploadPromises.get(key) === p) setClipUploadStatus((prev) => ({ ...prev, [key]: 'error' }))
        return null
      })
    clipUploadPromises.set(key, p)
  }

  const forgetClipUpload = (kind: 'u' | 'a', idx: number) => {
    const key = `${kind}${idx}`
    clipUploadPromises.delete(key)
    setClipUploadStatus((prev) => { const n = { ...prev }; delete n[key]; return n })
  }

  const resetAiClipUploads = () => {
    Array.from(clipUploadPromises.keys()).filter((k) => k.startsWith('a')).forEach((k) => clipUploadPromises.delete(k))
    setClipUploadStatus((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith('a'))) as Record<string, ClipUploadState>)
    setStepUploadPaths({})
    setStepUploadNames({})
  }

  // Music and voiceover files upload in the background too ('m' = music file, 'v:<id>' = a voiceover part)
  const pickOverlay = (file: File | null) => {
    if (!file) return
    const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null
    if (!kind) { setOverlayError('Choose an image or a video file.'); return }
    if (file.size > 50 * 1024 * 1024) { setOverlayError('That file is over 50 MB. Try a smaller one.'); return }
    setOverlayError('')
    overlayUploadRef.current = null
    setOverlay((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return { file, kind, url: URL.createObjectURL(file), x: 0.5, y: 0.2, size: 0.35, start: 0, end: null }
    })
  }
  const clearOverlay = () => {
    overlayUploadRef.current = null
    setOverlayError('')
    setOverlay((prev) => { if (prev) URL.revokeObjectURL(prev.url); return null })
  }
  const moveOverlay = (x: number, y: number) => setOverlay((prev) => (prev ? { ...prev, x, y } : prev))
  const patchOverlay = (patch: Partial<OverlayItem>) => setOverlay((prev) => (prev ? { ...prev, ...patch } : prev))
  // Uploads the overlay file when the video is made, and returns what the server needs
  const uploadOverlay = async () => {
    if (!overlay || !userId) return null
    let path = overlayUploadRef.current?.file === overlay.file ? overlayUploadRef.current.path : null
    if (!path) {
      path = `${userId}/overlay-${Date.now()}-${overlay.file.name.replace(/[^\w.-]+/g, '_')}`
      const { error } = await supabase.storage.from('video-uploads').upload(path, overlay.file, overlay.file.type ? { contentType: overlay.file.type } : undefined)
      if (error) throw new Error(`Overlay upload failed: ${error.message}`)
      overlayUploadRef.current = { file: overlay.file, path }
    }
    return { path, kind: overlay.kind, x: overlay.x, y: overlay.y, size: overlay.size, start: overlay.start, end: overlay.end }
  }

  const startAssetUpload = (key: string, blob: Blob, fileName: string) => {
    if (!userId) return
    setAssetPaths((prev) => { const n = { ...prev }; delete n[key]; return n })
    setClipUploadStatus((prev) => ({ ...prev, [key]: 'uploading' }))
    const safeName = fileName.replace(/[^\w.-]+/g, '_')
    const path = key === 'm' ? `${userId}/music-${uploadStamp()}-${safeName}` : `${userId}/voiceover-${uploadStamp()}-${key.slice(2)}.${voiceoverExt(blob)}`
    const p: Promise<string | null> = supabase.storage.from('video-uploads').upload(path, blob, blob.type ? { contentType: blob.type } : undefined)
      .then(({ error }) => {
        const latest = clipUploadPromises.get(key) === p
        if (error) {
          if (latest) setClipUploadStatus((prev) => ({ ...prev, [key]: 'error' }))
          return null
        }
        if (latest) {
          setAssetPaths((prev) => ({ ...prev, [key]: path }))
          setClipUploadStatus((prev) => ({ ...prev, [key]: 'done' }))
        }
        return path
      })
      .catch(() => {
        if (clipUploadPromises.get(key) === p) setClipUploadStatus((prev) => ({ ...prev, [key]: 'error' }))
        return null
      })
    clipUploadPromises.set(key, p)
  }

  const forgetAsset = (key: string) => {
    clipUploadPromises.delete(key)
    setClipUploadStatus((prev) => { const n = { ...prev }; delete n[key]; return n })
    setAssetPaths((prev) => { const n = { ...prev }; delete n[key]; return n })
  }

  const pickMusicFile = (file: File | null) => {
    setMusicFile(file)
    if (file) {
      // One music choice at a time
      setLibraryMusicUrl(null)
      setLibraryMusicName(null)
      setExtractedMusicPath(null)
      startAssetUpload('m', file, file.name)
    } else forgetAsset('m')
  }

  const clearMusic = () => {
    setLibraryMusicUrl(null)
    setLibraryMusicName(null)
    setMusicFile(null)
    setExtractedMusicPath(null)
    setExtractAudioError('')
    forgetAsset('m')
  }

  // Each recording is a "take" placed on the video timeline at the moment it was started
  const addVoiceTake = (blob: Blob, start: number, duration: number) => {
    const id = newTakeId()
    setVoiceTakes((prev) => [...prev, { id, blob, url: URL.createObjectURL(blob), start, duration, volume: 100 }])
    startAssetUpload(`v:${id}`, blob, 'voiceover')
  }

  const addVoiceFile = (file: File) => {
    const probe = new Audio()
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => addVoiceTake(file, 0, Number.isFinite(probe.duration) ? probe.duration : 0)
    probe.onerror = () => addVoiceTake(file, 0, 0)
    probe.src = URL.createObjectURL(file)
  }

  const removeVoiceTake = (id: string) => {
    setVoiceTakes((prev) => prev.filter((t) => t.id !== id))
    forgetAsset(`v:${id}`)
  }

  const setTakeVolume = (id: string, volume: number) => setVoiceTakes((prev) => prev.map((t) => (t.id === id ? { ...t, volume } : t)))

  const moveVoiceTake = (id: string, start: number) => setVoiceTakes((prev) => prev.map((t) => (t.id === id ? { ...t, start } : t)))

  const moveFilmClip = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= filmClips.length) return
    const next = filmClips.slice()
    next[i] = filmClips[j]
    next[j] = filmClips[i]
    setFilmClips(next)
    const ls = splitScriptLines(filmScript)
    if (i < ls.length && j < ls.length) setFilmScript(swapItems(ls, i, j).join('\n'))
    setFilmActionsText((prev) => swapItems(splitScriptLines(prev), i, j).join('\n'))
    setFilmPlayIdx(j)
  }

  const clearVoiceTakes = () => {
    voiceTakes.forEach((t) => forgetAsset(`v:${t.id}`))
    setVoiceTakes([])
  }

  // Warn before the page is closed while anything is still uploading
  const anyClipUploading = uploading || aiUploading || Object.values(clipUploadStatus).some((s) => s === 'uploading')
  useEffect(() => {
    if (!anyClipUploading) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [anyClipUploading])

  const runAiEditorUploads = async () => {
    if (!userId) return
    const selectedItem = filmingItems.find((f) => f.id === selectedFilmingId)
    if (!selectedItem) return

    setAiUploading(true)
    setAiRenderId(null)
    setAiRenderStatus(null)
    setAiOutputUrl(null)

    try {
      const allStepIndices = new Set([...Object.keys(stepUploads).map(Number), ...Object.keys(stepUploadPaths).map(Number)])
      const stepIndices = Array.from(allStepIndices).sort((a, b) => a - b)
      const clipPaths: string[] = []
      const speechIndices: number[] = []
      const clipTrims: { duration: number; trimStart?: number; trimLength?: number }[] = []
      const clipSettings: { letterbox?: boolean }[] = []
      const clipTexts: string[][] = []
      let anyLandscape = false

      // Upload all clips in parallel
      const uploadResults = await Promise.all(stepIndices.map(async (stepIndex) => {
        let path: string | null = null
        if (stepUploads[stepIndex]) {
          const file = stepUploads[stepIndex]
          const inFlight = clipUploadPromises.get(`a${stepIndex}`)
          const pendingPath = inFlight ? await inFlight : null
          const knownPath = pendingPath || stepUploadPaths[stepIndex]
          path = knownPath || `${userId}/${Date.now()}-step${stepIndex}-${file.name}`
          if (!knownPath) {
            if (file && file.size > 500 * 1024 * 1024) throw new Error(`${file.name} is too large. Max file size is 500MB.`)
            const { error } = await supabase.storage.from("video-uploads").upload(path, file)
            if (error) throw new Error(`Upload failed: ${error.message}`)
          }
        } else if (stepUploadPaths[stepIndex]) {
          path = stepUploadPaths[stepIndex]
        }
        if (!path) return null
        const file2 = stepUploads[stepIndex]
        const duration = file2 ? await getVideoDuration(file2) : 0
        const isLandscape = aiLandscapeSteps.has(stepIndex)
        const aiTrim = aiTrims[stepIndex]
        const aiTrimOk = !!aiTrim && !!file2 && aiTrim.file === file2
        const trimStart = aiTrimOk && aiTrim.start > 0.05 ? aiTrim.start : undefined
        const trimLength = aiTrimOk && aiTrim.end < aiTrim.total - 0.05 ? Math.max(0.1, aiTrim.end - aiTrim.start) : (aiTrimOk && trimStart ? Math.max(0.1, aiTrim.total - aiTrim.start) : undefined)
        return { path, stepIndex, duration, isLandscape, trimStart, trimLength }
      }))

      for (const result of uploadResults) {
        if (!result) continue
        clipPaths.push(result.path)
        if (aiSpeechSteps.has(result.stepIndex)) speechIndices.push(clipPaths.length - 1)
        {
          const it = filmingItems.find((f) => f.id === selectedFilmingId)
          const fromActions = extractOnScreenText(it?.directions?.[result.stepIndex] || '')
          const base = fromActions.length > 0 ? fromActions : extractOnScreenText(it?.checklist?.[result.stepIndex] || '')
          const typed = aiOwnTexts[result.stepIndex]
          clipTexts.push(aiAddCaptions && aiCaptionOwn && typed !== undefined ? (typed.trim() ? [typed.trim()] : []) : base)
        }
        clipTrims.push({ duration: result.duration, trimStart: result.trimStart, trimLength: result.trimLength })
        if (result.isLandscape) {
          anyLandscape = true
          clipSettings.push({ letterbox: true })
        } else {
          clipSettings.push({})
        }
      }

      if (clipPaths.length === 0) throw new Error("Upload at least one clip before creating your video.")

      const voiceovers: { path: string; start: number; duration: number; volume: number }[] = []
      for (const take of voiceTakes) {
        const inFlightVo = clipUploadPromises.get(`v:${take.id}`)
        let takePath: string | null = (inFlightVo ? await inFlightVo : null) || assetPaths[`v:${take.id}`] || null
        if (!takePath) {
          const vPath = `${userId}/voiceover-${Date.now()}-${take.id}.${voiceoverExt(take.blob)}`
          const { error: voError } = await supabase.storage.from('video-uploads').upload(vPath, take.blob, { contentType: take.blob.type || 'audio/webm' })
          if (voError) throw new Error(`Voiceover upload failed: ${voError.message}`)
          takePath = vPath
        }
        voiceovers.push({ path: takePath, start: take.start, duration: take.duration, volume: take.volume })
      }

      let musicPath: string | null = extractedMusicPath
      if (!musicPath && musicFile) {
        const inFlightMusic = clipUploadPromises.get('m')
        musicPath = (inFlightMusic ? await inFlightMusic : null) || assetPaths.m || null
        if (!musicPath) {
          const mPath = `${userId}/music-${Date.now()}-${musicFile.name.replace(/[^\w.-]+/g, '_')}`
          const { error: musicError } = await supabase.storage.from('video-uploads').upload(mPath, musicFile)
          if (!musicError) musicPath = mPath
        }
      }

      const outputOrientation = undefined  // always portrait output

      const aiHasTexts = clipTexts.some((t) => t.length > 0)
      const aiOwnMode = aiAddCaptions && aiCaptionOwn
      const aiTextActive = aiHasTexts && (aiOwnMode ? captionLayers.speech.on : captionLayers.onScreen.on)
      const aiSpeechActive = aiAddCaptions && !aiOwnMode && captionLayers.speech.on
      const aiCaptionStyle = aiSpeechActive || aiTextActive
        ? {
            preset: aiCaptionPreset,
            custom: {
              font: { family: captionFontFamily, size: Number(captionFontSize) || 36, color: captionColor },
              position: captionPosition,
              borderColor: captionBorderColor,
              backgroundColor: captionBg ?? undefined,
            },
            layers: resolveCaptionLayers(captionLayers, captionPosition, aiOwnMode),
          }
        : null

      const overlayPayload = await uploadOverlay()
      const res = await authFetch("/api/render-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          clipPaths,
          captionStyle: aiCaptionStyle,
          captionTextOnly: aiTextActive && !aiSpeechActive,
          musicPath,
          voiceovers,
          originalVolume: originalVol, musicVolume: musicVol,
          musicUrl: libraryMusicUrl,
          speechClipIndices: speechIndices,
          clipTrims,
          clipSettings,
          clipTexts,
          outputOrientation,
          resolution: aiResolution,
          cutDeadSpace: cutDeadSpace && aiCaps.length === 0,
          customCaptions: aiCaps,
          customCaptionStyle,
          overlay: overlayPayload,
          
          ideaId: selectedFilmingId || null,
          ideaSource: !selectedFilmingId ? 'upload' : selectedFilmingId.startsWith('script-') ? 'script' : 'idea',
          ideaTitle: filmingItems.find((f) => f.id === selectedFilmingId)?.title || null,
          ideaCaption: filmingItems.find((f) => f.id === selectedFilmingId)?.caption || null,
          ideaTags: filmingItems.find((f) => f.id === selectedFilmingId)?.tags || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Render failed to start")

      setAiRenderId(data.renderId)
      setAiRenderStatus("queued")
      localStorage.setItem('reelezy-render', JSON.stringify({ id: data.renderId, type: 'ai', ts: Date.now() }))
      setMusicFile(null)
      clearVoiceTakes()
      setExtractedMusicPath(null)
    } catch (err) {
      setAiEditorError(err instanceof Error ? err.message : 'Something went wrong uploading your clips. Check file sizes and try again.')
    } finally {
      setAiUploading(false)
    }
  }
  const runUploadAndRender = async () => {
    if (!userId) return
    const slotIds = uploadSlots.filter((id) => uploadSlotFiles[id])
    if (slotIds.length === 0) return

    setUploading(true)
    setUploadError('')
    setRenderId(null)
    setRenderStatus(null)
    setOutputUrl(null)

    try {
      const clipPaths: string[] = []
      const clipTrims: { duration: number; trimStart?: number; trimLength?: number }[] = []
      const clipSettings: { letterbox?: boolean }[] = []
      const clipTexts: string[][] = []
      const speechIndices: number[] = []
      let anyLandscape = false
      const isFilmRender = slotIds.every((id) => (uploadSlotPaths[id] || '').includes('/film/filmed-'))
      const filmCtx = isFilmRender ? filmRenderContextRef.current : null
      const filmLandscapeOut = isFilmRender && filmOutputOrientationRef.current === 'landscape'

      // Upload all clips in parallel
      const uploadResults = await Promise.all(slotIds.map(async (slotId) => {
        let path: string | null = null
        if (uploadSlotFiles[slotId]) {
          const file = uploadSlotFiles[slotId]
          const inFlight = clipUploadPromises.get(`u${slotId}`)
          const pendingPath = inFlight ? await inFlight : null
          const knownPath = pendingPath || uploadSlotPaths[slotId]
          path = knownPath || `${userId}/${Date.now()}-${file.name}`
          if (!knownPath) {
            if (file && file.size > 500 * 1024 * 1024) throw new Error(`${file.name} is too large. Max file size is 500MB.`)
            const { error } = await supabase.storage.from('video-uploads').upload(path, file)
            if (error) throw new Error(`Upload failed: ${error.message}`)
          }
        } else if (uploadSlotPaths[slotId]) {
          path = uploadSlotPaths[slotId]
        }
        if (!path) return null
        const uploadFile = uploadSlotFiles[slotId]
        const duration = uploadFile ? await getVideoDuration(uploadFile) : 0
        const isLandscape = uploadLandscapeSlots.has(slotId)
        const upTrim = uploadTrims[slotId]
        const upTrimOk = !!upTrim && !!uploadFile && upTrim.file === uploadFile
        const trimStart = upTrimOk && upTrim.start > 0.05 ? upTrim.start : undefined
        const trimLength = upTrimOk && upTrim.end < upTrim.total - 0.05 ? Math.max(0.1, upTrim.end - upTrim.start) : (upTrimOk && trimStart ? Math.max(0.1, upTrim.total - upTrim.start) : undefined)
        return { path, slotId, duration, isLandscape, trimStart, trimLength }
      }))

      for (const result of uploadResults) {
        if (!result) continue
        clipPaths.push(result.path)
        if (uploadSpeechSlots.has(result.slotId)) speechIndices.push(clipPaths.length - 1)
        {
          const base = isFilmRender ? (uploadSlotTexts[result.slotId] || []) : []
          const typed = uploadOwnTexts[result.slotId]
          clipTexts.push(uploadAddCaptions && uploadCaptionOwn && typed !== undefined ? (typed.trim() ? [typed.trim()] : []) : base)
        }
        clipTrims.push({ duration: result.duration, trimStart: result.trimStart, trimLength: result.trimLength })
        if (result.isLandscape || filmLandscapeOut) {
          anyLandscape = true
          clipSettings.push({ letterbox: true })
        } else {
          clipSettings.push({})
        }
      }

      if (clipPaths.length === 0) throw new Error("Upload at least one clip before creating your video.")

      const voiceovers: { path: string; start: number; duration: number; volume: number }[] = []
      for (const take of voiceTakes) {
        const inFlightVo = clipUploadPromises.get(`v:${take.id}`)
        let takePath: string | null = (inFlightVo ? await inFlightVo : null) || assetPaths[`v:${take.id}`] || null
        if (!takePath) {
          const vPath = `${userId}/voiceover-${Date.now()}-${take.id}.${voiceoverExt(take.blob)}`
          const { error: voError } = await supabase.storage.from('video-uploads').upload(vPath, take.blob, { contentType: take.blob.type || 'audio/webm' })
          if (voError) throw new Error(`Voiceover upload failed: ${voError.message}`)
          takePath = vPath
        }
        voiceovers.push({ path: takePath, start: take.start, duration: take.duration, volume: take.volume })
      }

      let musicPath: string | null = extractedMusicPath
      if (!musicPath && musicFile) {
        const inFlightMusic = clipUploadPromises.get('m')
        musicPath = (inFlightMusic ? await inFlightMusic : null) || assetPaths.m || null
        if (!musicPath) {
          const mPath = `${userId}/music-${Date.now()}-${musicFile.name.replace(/[^\w.-]+/g, '_')}`
          const { error: musicError } = await supabase.storage.from('video-uploads').upload(mPath, musicFile)
          if (!musicError) musicPath = mPath
        }
      }

      const outputOrientation = filmLandscapeOut ? 'landscape' : undefined

      const hasOnScreen = clipTexts.some((t) => t.length > 0)
      const uploadOwnMode = uploadAddCaptions && uploadCaptionOwn
      const uploadTextActive = hasOnScreen && (uploadOwnMode ? captionLayers.speech.on : captionLayers.onScreen.on)
      const uploadSpeechActive = uploadAddCaptions && !uploadOwnMode && captionLayers.speech.on
      const captionStyle = uploadSpeechActive || uploadTextActive
        ? {
            preset: captionPreset,
            custom: {
              font: { family: captionFontFamily, size: Number(captionFontSize) || 36, color: captionColor },
              position: captionPosition,
              borderColor: captionBorderColor,
              backgroundColor: captionBg ?? undefined,
            },
            layers: resolveCaptionLayers(captionLayers, captionPosition, uploadOwnMode),
          }
        : null

      const overlayPayload = await uploadOverlay()
      const res = await authFetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, clipPaths, captionStyle, captionTextOnly: uploadTextActive && !uploadSpeechActive, musicPath, voiceovers, originalVolume: originalVol, musicVolume: musicVol, musicUrl: libraryMusicUrl, speechClipIndices: speechIndices, clipSettings, clipTexts, outputOrientation, clipTrims, resolution: uploadResolution, ideaId: filmCtx?.ideaId ?? null, ideaSource: filmCtx?.source ?? 'upload', ideaTitle: filmCtx?.title ?? null, ideaCaption: filmCtx?.caption ?? null, ideaTags: filmCtx?.tags ?? null, cutDeadSpace: cutDeadSpace && uploadCaps.length === 0, customCaptions: uploadCaps, customCaptionStyle, overlay: overlayPayload }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Render failed to start')

      setRenderId(data.renderId)
      setRenderStatus('queued')
      localStorage.setItem('reelezy-render', JSON.stringify({ id: data.renderId, type: 'upload', ts: Date.now() }))
      filmRenderContextRef.current = null
      filmOutputOrientationRef.current = null
      setUploadSlots([0])
      setUploadSlotFiles({})
      setUploadSlotPaths({})
      setUploadSpeechSlots(new Set())
      setUploadLandscapeSlots(new Set())
      setMusicFile(null)
      clearVoiceTakes()
      setExtractedMusicPath(null)
      authFetch('/api/delete-draft-clip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, editorType: 'upload' }) })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setUploading(false)
    }
  }

  const submitAiEditorUploads = () => gateRenderAction(() => { runAiEditorUploads() })
  const startUploadAndRender = () => gateRenderAction(() => { runUploadAndRender() })

  const handleExtractAudio = async (file: File) => {
    if (!userId) return
    setExtractingAudio(true)
    setExtractAudioError('')
    setExtractedMusicPath(null)
    setMusicFile(null)
    setLibraryMusicUrl(null)
    setLibraryMusicName(null)

    try {
      const path = `${userId}/${Date.now()}-extract-source-${file.name}`
      const { error: uploadError } = await supabase.storage.from('video-uploads').upload(path, file)
      if (uploadError) throw new Error(uploadError.message)

      const startRes = await authFetch('/api/extract-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath: path }),
      })
      const startData = await startRes.json()
      if (!startRes.ok) throw new Error(startData.error || 'Failed to extract audio')
      setExtractedMusicPath(startData.musicPath)
    } catch (err) {
      setExtractAudioError(err instanceof Error ? err.message : 'Something went wrong extracting audio')
    } finally {
      setExtractingAudio(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }} />
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'ideas', label: 'Content Ideas' },
    { id: 'myideas', label: 'My Ideas' },
    { id: 'filming', label: 'Filming' },
    { id: 'aiuploads', label: 'AI Editor For Generated Idea' },
    { id: 'uploads', label: 'AI Editor For Any Video' },
    { id: 'carousel', label: 'Carousel Reels' },
    { id: 'script', label: 'Script Generator' },
    { id: 'scheduler', label: 'Scheduler' },
    { id: 'library', label: 'Clip Library' },
  ]

  const paidStatus = realSubStatus === 'active' || realSubStatus === 'trialing'
  const isFreeTier = !realSubPlan || !paidStatus
  const showWatermark = subLoaded && isFreeTier
  const freeQuotaExceeded = isFreeTier && lifetimeRenderSeconds >= 60
  const isProPlan = userPlan === 'top' && paidStatus

  const renderCapMin = userPlan === 'top' ? 60 : 25

  const stats = [
    { label: 'Ideas this week', value: isFreeTier ? `${ideasThisWeek} / 24` : `${ideasThisWeek} / ${userPlan === 'top' ? PLAN_LIMITS.top.ideasPerWeek : PLAN_LIMITS.basic.ideasPerWeek}` },
    { label: 'Filming instructions', value: isFreeTier ? `${filmingThisWeek} / 7` : `${filmingThisWeek} / ${userPlan === 'top' ? PLAN_LIMITS.top.filmingPerWeek : PLAN_LIMITS.basic.filmingPerWeek}`, tab: 'film' as Tab },
    { label: 'Reels made', value: String(totalRenders) },
    { label: 'Posts this week', value: String(postsThisWeek) },
    { label: 'Render time used', value: isFreeTier ? (() => {
      const usedSec = lifetimeRenderSeconds
      return `${usedSec}s / 60s`
    })() : (() => {
      const usedMin = Math.floor(totalRenderSeconds / 60)
      const usedSec = totalRenderSeconds % 60
      return `${usedMin}:${String(usedSec).padStart(2, '0')} / ${renderCapMin}:00`
    })() },
  ]

  const savedIdeas = dbSavedIdeas



  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 4, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', fontSize: 13, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", outline: 'none', boxSizing: 'border-box' as const, color: 'var(--ink)' }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5, display: 'block' as const }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .rly-spinner {
          display: inline-block;
          width: 13px;
          height: 13px;
          border: 1.5px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          vertical-align: middle;
          margin-right: 7px;
          flex-shrink: 0;
        }
        .scr-cur { animation: scrIn 0.3s ease; }
        .scr-next { animation: scrNext 0.5s ease; mask-image: linear-gradient(#000 40%, transparent); -webkit-mask-image: linear-gradient(#000 40%, transparent); }
        @keyframes scrIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes scrNext { from { opacity: 0; } to { opacity: 1; } }
        .rly-spinner-coral {
          border-color: rgba(255,106,77,0.3);
          border-top-color: var(--coral);
        }
        @media (min-width: 1024px) {
          .ed-split { display: grid !important; grid-template-columns: 380px minmax(0, 1fr); column-gap: 32px !important; row-gap: 0 !important; align-items: start; }
          .ed-split > .ed-main { grid-column: 2; grid-row: 1; min-width: 0; margin: 0; }
          .ed-split > .ed-preview { grid-column: 1; grid-row: 1; position: sticky !important; top: 16px; align-self: start; margin: 0; max-height: calc(100vh - 32px); overflow-y: auto; scrollbar-width: thin; }
        }
      `}</style>
      {showOverageModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "var(--sand)", borderRadius: 4, padding: "32px", maxWidth: 420, width: "100%" }}>
            <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 12 }}>You&apos;ve reached your monthly render limit</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 24 }}>
              You&apos;ve used all your included render minutes for this month. Press Continue to keep rendering on overage fees, or Exit to stop here.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setShowOverageModal(false); setPendingRenderAction(null) }}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 4, border: "1px solid rgba(128,128,128,0.3)", background: "transparent", fontSize: 14, color: "var(--ink)", cursor: "pointer" }}
              >
                Exit
              </button>
              <button
                onClick={() => {
                  setShowOverageModal(false)
                  if (pendingRenderAction) pendingRenderAction()
                  setPendingRenderAction(null)
                }}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 4, border: "none", background: "var(--coral)", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      <Sidebar />
      {(renderStatus === 'queued' || renderStatus === 'rendering' || renderStatus === 'processing' || aiRenderStatus === 'queued' || aiRenderStatus === 'rendering' || aiRenderStatus === 'processing') && (
        <div style={{ marginLeft: 'var(--sidebar-offset, 56px)', padding: '12px 36px 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,106,77,0.08)', border: '1px solid rgba(255,106,77,0.3)', borderRadius: 4, padding: '8px 18px', fontSize: 13, color: 'var(--coral)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            <span className="rly-spinner" />
            Rendering in the background - feel free to navigate away
          </div>
        </div>
      )}
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav className="dashboard-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <ReelezyLogo size={44} />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a href="/settings?section=billing" className="plan-badge" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--sand)", border: "1px solid rgba(128,128,128,0.2)", borderRadius: 4, padding: "6px 14px", textDecoration: "none", color: "var(--ink)", fontSize: 12, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-muted)" }} />
              {realSubPlan && realSubStatus !== 'active'
                ? `${realSubPlan === "top" ? "Pro" : realSubPlan === "mid" ? "Basic" : "Basic"} Plan (${realSubStatus})`
                : realSubPlan
                ? `${userPlan === "top" ? "Pro" : userPlan === "mid" ? "Basic" : "Basic"} Plan`
                : "Free Plan"}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>· Manage</span>
            </a>
          <button
            onClick={async () => { await supabase.auth.signOut({ scope: 'local' }); router.push('/login') }}
            style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif" }}
          >
            Log out
          </button>
          </div>
        </nav>

        <div className="dashboard-content" style={{ padding: '0 48px 100px' }}>
          {deletionScheduledAt && (
            <div style={{ background: 'rgba(255,106,77,0.1)', border: '1px solid var(--coral)', borderRadius: 4, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--ink)' }}>
                Your account data is scheduled for deletion on <strong>{new Date(deletionScheduledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>. Download a copy of your data or resubscribe before then to keep it.
              </p>
              <a href="/settings" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '8px 16px', borderRadius: 4, fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Go to Settings
              </a>
            </div>
          )}
          <div style={{ background: 'var(--sand)', border: '1px solid var(--line)', borderRadius: 4, padding: '40px 36px', marginBottom: 28 }}>
            <h1 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 26, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
              Welcome back, {profile?.business_name}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
              {profile?.industry} · {profile?.suburb}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
              {stats.map((s) => (
                s.tab ? (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => { setTab(s.tab); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    aria-label={`${s.label}: ${s.value}. Open the ${s.tab} tab`}
                    style={{ background: '#FFFFFF', border: '1px solid var(--line)', borderRadius: 4, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                  >
                    <p style={{ fontSize: 20, fontWeight: 600, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)', margin: 0 }}>{s.value}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{s.label}</p>
                  </button>
                ) : (
                <div key={s.label} style={{ background: '#FFFFFF', border: '1px solid var(--line)', borderRadius: 4, padding: '14px 16px' }}>
                  <p style={{ fontSize: 20, fontWeight: 600, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)' }}>{s.value}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.label}</p>
                </div>
                )
              ))}
            </div>
          </div>

          <div style={{ position: 'relative', marginBottom: 28 }}>
            <div ref={(el) => { navScrollRef.current = el; if (el) setTimeout(checkNavEnd, 0) }} onScroll={checkNavEnd} className="dashboard-tabs-scroll" style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid rgba(128,128,128,0.15)', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }} onClick={() => setOpenDropdown(null)}>

            {/* Overview */}
            <button onClick={(e) => { e.stopPropagation(); setTab('overview'); setOpenDropdown(null) }} style={{ background: 'none', border: 'none', borderBottom: tab === 'overview' ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: tab === 'overview' ? 600 : 500, color: tab === 'overview' ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap' }}>
              Overview
            </button>

            {/* Create dropdown */}
            <div ref={createBtnRef} style={{ position: 'relative' }}>
              <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'create' ? null : 'create') }} data-dropdown style={{ background: 'none', border: 'none', borderBottom: ['ideas','script'].includes(tab) ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: ['ideas','script'].includes(tab) ? 600 : 500, color: ['ideas','script'].includes(tab) ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                Create <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
              </button>
              {openDropdown === 'create' && (
                <div data-dropdown onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: (createBtnRef.current?.getBoundingClientRect().bottom ?? 48) + 4, left: Math.max(8, Math.min(createBtnRef.current?.getBoundingClientRect().left ?? 0, (typeof window !== 'undefined' ? window.innerWidth : 360) - 268)), background: 'var(--sand)', border: '1px solid rgba(128,128,128,0.2)', borderRadius: 4, padding: '6px', zIndex: 100, minWidth: 180, width: 'max-content', maxWidth: 'calc(100vw - 16px)', boxShadow: 'none' }}>
                  {[{ id: 'ideas', label: 'Content Ideas' }, { id: 'script', label: 'Script Generator' }, { id: 'carousel', label: 'Carousel Reels', pro: true }].map((item) => (
                    <button key={item.id} onClick={() => { setTab(item.id as Tab); setOpenDropdown(null) }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', background: tab === item.id ? 'rgba(255,106,77,0.08)' : 'none', border: 'none', borderRadius: 4, padding: '9px 12px', fontSize: 13, fontWeight: tab === item.id ? 600 : 400, color: tab === item.id ? 'var(--coral)' : 'var(--ink)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif" }}>
                      {item.label}{(item as {pro?: boolean}).pro && !isProPlan ? <span style={{ fontSize: 11, color: 'var(--coral)' }}>Pro</span> : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* My Ideas tab */}
            <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); setTab('myideas') }} style={{ background: 'none', border: 'none', borderBottom: tab === 'myideas' ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: tab === 'myideas' ? 600 : 500, color: tab === 'myideas' ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap' }}>
              My Ideas{savedIdeas.length > 0 ? ` (${savedIdeas.length})` : ''}
            </button>

            {/* Instructions tab */}
            <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); setTab('filming') }} style={{ background: 'none', border: 'none', borderBottom: tab === 'filming' ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: tab === 'filming' ? 600 : 500, color: tab === 'filming' ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap' }}>
              Instructions
            </button>

            {/* Film tab */}
            <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); setTab('film') }} style={{ background: 'none', border: 'none', borderBottom: tab === 'film' ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: tab === 'film' ? 600 : 500, color: tab === 'film' ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap' }}>
              Film
            </button>

            {/* Edit dropdown */}
            <div ref={editBtnRef} style={{ position: 'relative' }}>
              <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'edit' ? null : 'edit') }} data-dropdown style={{ background: 'none', border: 'none', borderBottom: ['aiuploads','uploads'].includes(tab) ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: ['aiuploads','uploads'].includes(tab) ? 600 : 500, color: ['aiuploads','uploads'].includes(tab) ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                Edit <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
              </button>
              {openDropdown === 'edit' && (
                <div data-dropdown onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: (editBtnRef.current?.getBoundingClientRect().bottom ?? 48) + 4, left: Math.max(8, Math.min(editBtnRef.current?.getBoundingClientRect().left ?? 0, (typeof window !== 'undefined' ? window.innerWidth : 360) - 268)), background: 'var(--sand)', border: '1px solid rgba(128,128,128,0.2)', borderRadius: 4, padding: '6px', zIndex: 100, minWidth: 180, width: 'max-content', maxWidth: 'calc(100vw - 16px)', boxShadow: 'none' }}>
                  {[{ id: 'aiuploads', label: 'AI Editor For Generated Idea' }, { id: 'uploads', label: 'AI Editor For Any Video' }].map((item) => (
                    <button key={item.id} onClick={() => { setTab(item.id as Tab); setOpenDropdown(null) }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', background: tab === item.id ? 'rgba(255,106,77,0.08)' : 'none', border: 'none', borderRadius: 4, padding: '9px 12px', fontSize: 13, fontWeight: tab === item.id ? 600 : 400, color: tab === item.id ? 'var(--coral)' : 'var(--ink)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif" }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Publish button */}
            <button onClick={(e) => { e.stopPropagation(); setTab('scheduler'); setOpenDropdown(null) }} style={{ background: 'none', border: 'none', borderBottom: tab === 'scheduler' ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: tab === 'scheduler' ? 600 : 500, color: tab === 'scheduler' ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap' }}>
              Publish
            </button>

            {/* Clip library button */}
            <button onClick={(e) => { e.stopPropagation(); setTab('library'); setOpenDropdown(null) }} style={{ background: 'none', border: 'none', borderBottom: tab === 'library' ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: tab === 'library' ? 600 : 500, color: tab === 'library' ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap' }}>
              Library
            </button>

            </div>
            {/* Scroll arrow */}
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 1, width: 48, background: 'linear-gradient(to right, transparent, var(--background) 70%)', display: navAtEnd ? 'none' : 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, pointerEvents: 'none' }}>
              <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>›</span>
            </div>
          </div>



          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              <button
                onClick={() => setTab('ideas')}
                style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'opacity 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--ink)' }}>
                  Content ideas
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {ideas.length > 0 ? `You have ${ideas.length} ideas ready to review.` : `Generate ideas tailored for ${profile?.suburb}.`}
                </p>
                <p style={{ fontSize: 12, color: 'var(--coral)', marginTop: 12, fontWeight: 600 }}>Go to Content Ideas →</p>
              </button>
              <button
                onClick={() => setTab('aiuploads')}
                style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'opacity 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--ink)' }}>
                  Upload & edit
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Upload clips and get them stitched with captions and sound automatically.
                </p>
                <p style={{ fontSize: 12, color: 'var(--coral)', marginTop: 12, fontWeight: 600 }}>Go to AI Editor For Generated Idea →</p>
              </button>
              <button
                onClick={() => setTab('scheduler')}
                style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'opacity 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--ink)' }}>
                  Scheduler
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Plan and schedule your videos across Instagram, TikTok and Facebook.
                </p>
              </button>
            </div>
          )}

          {tab === 'ideas' && (
            <div>

              {/* ── Generation controls ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>

                {/* Row 1: objectives + generate button + arrows */}
                <div className="ideas-row" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.4, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                        Custom input (optional)
                      </label>
                      <textarea
                        value={weeklyObjectives}
                        onChange={(e) => setWeeklyObjectives(e.target.value)}
                        rows={3}
                        placeholder="e.g. Promote our new croissant for 2 videos, introduce Jacob our new baker. More humour this week."
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 4, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", resize: 'none', boxSizing: 'border-box' as const, lineHeight: 1.5 }}
                      />
                    </div>
                  </div>
                  <div className="ideas-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 22, flexShrink: 0 }}>
                    <button
                      onClick={generateIdeas}
                      disabled={generatingIdeas}
                      style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 20px', borderRadius: 4, fontSize: 13, fontWeight: 600, border: 'none', cursor: generatingIdeas ? 'not-allowed' : 'pointer', opacity: generatingIdeas ? 0.7 : 1, whiteSpace: 'nowrap' }}
                    >
                      {generatingIdeas ? <><span className='rly-spinner' />Generating...</> : ideas.length > 0 ? 'Generate more' : 'Generate ideas'}
                    </button>
                    <button onClick={undoIdeas} disabled={batchIndex <= 0} title="Previous batch" style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 4, padding: '9px 12px', fontSize: 15, color: batchIndex > 0 ? 'var(--ink)' : 'var(--text-muted)', cursor: batchIndex > 0 ? 'pointer' : 'not-allowed', opacity: batchIndex > 0 ? 1 : 0.5, lineHeight: 1 }}>←</button>
                    {weeklyBatches.length > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{batchIndex + 1} of {weeklyBatches.length}</span>
                    )}
                    <button onClick={redoIdeas} disabled={batchIndex >= weeklyBatches.length - 1} title="Next batch" style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 4, padding: '9px 12px', fontSize: 15, color: batchIndex < weeklyBatches.length - 1 ? 'var(--ink)' : 'var(--text-muted)', cursor: batchIndex < weeklyBatches.length - 1 ? 'pointer' : 'not-allowed', opacity: batchIndex < weeklyBatches.length - 1 ? 1 : 0.5, lineHeight: 1 }}>→</button>
                  </div>
                </div>

                {/* Row 2: seasonal mode + tone - full width */}
                <div className="ideas-row2" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Seasonal */}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>Content style</p>
                    <div className="ideas-style-cards" style={{ display: 'flex', gap: 6 }}>
                      {([
                        { id: 'seasonal', label: 'Seasonal', desc: 'Tied to upcoming dates & events', icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2.5" width="12" height="10.5" rx="1.5"/><line x1="1" y1="5.5" x2="13" y2="5.5"/><line x1="4.5" y1="1" x2="4.5" y2="4"/><line x1="9.5" y1="1" x2="9.5" y2="4"/></svg> },
                        { id: 'mix', label: 'Mix', desc: 'Seasonal + timeless blend', icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="7" cy="7" r="5.5"/><path d="M7 1.5 A5.5 5.5 0 0 1 7 12.5" fill="currentColor" fillOpacity="0.15"/><line x1="7" y1="1.5" x2="7" y2="12.5"/></svg> },
                        { id: 'evergreen', label: 'Timeless', desc: 'Works any time of year', icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="5.5"/><polyline points="7,3.5 7,7 9.5,9"/></svg> },
                      ] as { id: 'seasonal' | 'mix' | 'evergreen'; label: string; desc: string; icon: React.ReactNode }[]).map((opt) => (
                        <button key={opt.id} type="button" onClick={() => setSeasonalMode(opt.id)} style={{ flex: 1, padding: '7px 10px', borderRadius: 4, border: seasonalMode === opt.id ? '1.5px solid var(--coral)' : '1px solid rgba(128,128,128,0.25)', background: seasonalMode === opt.id ? 'rgba(255,106,77,0.1)' : 'var(--card-bg)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", textAlign: 'left' as const }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: seasonalMode === opt.id ? 'var(--coral)' : 'var(--ink)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>{opt.icon}{opt.label}</p>
                          <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Tone */}
                  <div className="ideas-tone" style={{ flexShrink: 0 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>Tone</p>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {([
                        { id: null, label: 'Default' },
                        { id: 'casual', label: 'Casual' },
                        { id: 'professional', label: 'Professional' },
                        { id: 'humorous', label: 'Humorous' },
                        { id: 'heartfelt', label: 'Inspirational' },
                      ] as { id: string | null; label: string }[]).map((t) => (
                        <button key={t.id ?? 'default'} type="button" onClick={() => setToneOverride(t.id)} style={{ padding: '4px 10px', borderRadius: 4, border: toneOverride === t.id ? '1.5px solid var(--coral)' : '1px solid rgba(128,128,128,0.25)', background: toneOverride === t.id ? 'rgba(255,106,77,0.1)' : 'var(--card-bg)', color: toneOverride === t.id ? 'var(--coral)' : 'var(--text-secondary)', fontSize: 11, fontWeight: toneOverride === t.id ? 600 : 400, cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap' }}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {usageInfo && (
                <div style={{ background: usageInfo.used >= usageInfo.limit ? 'rgba(255,106,77,0.1)' : 'var(--sand)', border: usageInfo.used >= usageInfo.limit ? '1px solid var(--coral)' : 'none', borderRadius: 4, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {usageInfo.used} of {usageInfo.limit} ideas generated this week ({isFreeTier ? 'Free' : userPlan === 'top' ? 'Pro' : 'Basic'} plan)
                    {' · '}
                    <span style={{ color: 'var(--text-muted)' }}>
                      Resets {(() => {
                        const now = new Date()
                        const daysUntilMonday = (8 - now.getDay()) % 7 || 7
                        const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday)
                        return nextMonday.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                      })()}
                    </span>
                  </p>
                  {usageInfo.used >= usageInfo.limit && userPlan !== 'top' && (
                    <a href="/plans" style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 600, textDecoration: 'none' }}>{userPlan === 'mid' ? 'Upgrade to Pro →' : 'Upgrade to Basic →'}</a>
                  )}
                </div>
              )}

              {showKeyEventsPanel && (
                <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '16px 20px', marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Log a key event</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    e.g. "New barista Jake started this week" - these get woven into future idea generations where relevant.
                  </p>
                  <textarea
                    value={newKeyEvent}
                    onChange={(e) => setNewKeyEvent(e.target.value)}
                    rows={2}
                    placeholder="What's happening in your business right now?"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 4, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }}
                  />
                  <button
                    onClick={addKeyEvent}
                    disabled={savingKeyEvent || !newKeyEvent.trim()}
                    style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '8px 16px', borderRadius: 4, fontSize: 13, fontWeight: 600, border: 'none', cursor: savingKeyEvent || !newKeyEvent.trim() ? 'not-allowed' : 'pointer', opacity: savingKeyEvent || !newKeyEvent.trim() ? 0.5 : 1, marginBottom: 14 }}
                  >
                    {savingKeyEvent ? 'Saving...' : 'Add event'}
                  </button>
                  {keyEvents.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {keyEvents.slice(0, 5).map((ev) => (
                        <div key={ev.id} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 10px', background: 'var(--card-bg)', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span>{ev.event_text}</span>
                          <button
                            onClick={() => deleteKeyEvent(ev.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}
                            aria-label="Delete event"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(128,128,128,0.15)' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Weekly performance suggestions</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 10px', background: 'var(--card-bg)', borderRadius: 4 }}>
                    </p>
                  </div>
                </div>
              )}

              {ideaError && (
                <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 16 }}>{ideaError}</p>
              )}

              {ideas.length === 0 && !generatingIdeas && (
                <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '48px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    Click "Generate ideas" to get content ideas made for {profile?.business_name}.
                  </p>
                </div>
              )}

              {ideas.length > 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 14px' }}>
                  ☆ Star an idea to save and get filming instructions
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                {ideas.map((idea) => (
                  <div key={idea.id} style={{ background: 'var(--sand)', borderRadius: 4, padding: '22px', position: 'relative' }}>
                    <button
                      onClick={() => toggleSave(idea.id)}
                      style={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 16,
                        color: savedIds.has(idea.id) ? 'var(--coral)' : 'var(--text-muted)',
                      }}
                    >
                      {savedIds.has(idea.id) ? '★' : '☆'}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      {idea.source === 'script' && (
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', background: 'rgba(255,106,77,0.12)', color: 'var(--coral)', borderRadius: 4, padding: '2px 7px', border: '1px solid rgba(255,106,77,0.25)' }}>From script</span>
                      )}
                    </div>
                    <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 10, paddingRight: 24 }}>
                      {idea.title}
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                      {idea.hook}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 12 }}>
                      {idea.description}
                    </p>                    <p style={{ fontSize: 12, color: 'var(--coral)' }}>{(() => { try { const t = JSON.parse(idea.tags); return Array.isArray(t) ? t.join(" ") : idea.tags } catch { return idea.tags } })()}</p>
                    {savedIds.has(idea.id) && (
                      <div style={{ borderTop: '1px solid rgba(128,128,128,0.12)', marginTop: 14, paddingTop: 12 }}>
                        <button
                          onClick={() => setTab('myideas')}
                          style={{ background: 'rgba(255,106,77,0.1)', border: '1px solid rgba(255,106,77,0.3)', borderRadius: 4, padding: '5px 12px', fontSize: 12, color: 'var(--coral)', cursor: 'pointer', fontWeight: 600 }}
                        >
                          View in My Ideas →
                        </button>
                      </div>
                    )}
                    {(userPlan === "mid" || userPlan === "top") && (
                      refiningId === idea.id ? (
                        <div style={{ marginTop: 12 }}>
                          <input
                            type="text"
                            value={refineInstruction}
                            onChange={(e) => setRefineInstruction(e.target.value)}
                            placeholder="e.g. make it funnier, shorter, more casual..."
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid rgba(128,128,128,0.25)", background: "var(--card-bg)", color: "var(--ink)", fontSize: 12, marginBottom: 8, boxSizing: "border-box" }}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => refineIdea(idea)}
                              disabled={refineLoading}
                              style={{ background: "var(--coral)", color: "#fff", border: "none", borderRadius: 4, padding: "6px 12px", fontSize: 12, cursor: refineLoading ? "not-allowed" : "pointer" }}
                            >
                              {refineLoading ? "Refining..." : "Apply"}
                            </button>
                            <button
                              onClick={() => { setRefiningId(null); setRefineInstruction("") }}
                              style={{ background: "none", border: "1px solid rgba(128,128,128,0.3)", borderRadius: 4, padding: "6px 12px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRefiningId(idea.id)}
                          style={{ marginTop: 10, background: "none", border: "1px dashed rgba(128,128,128,0.35)", borderRadius: 4, padding: "5px 10px", fontSize: 11, color: "var(--text-secondary)", cursor: "pointer" }}
                        >
                          Refine this idea
                        </button>
                      )
                    )}                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'myideas' && (
            <div>
              {savedIdeas.length === 0 ? (
                <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '48px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    No ideas saved yet. Star an idea in Content Ideas to see it here.
                  </p>
                  <button
                    onClick={() => router.push('/history')}
                    style={{ marginTop: 14, background: 'none', border: '1px solid rgba(128,128,128,0.35)', borderRadius: 4, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    View old ideas
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>Saved ideas</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 24 }}>
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
                        Review your selected ideas, then film them.
                      </p>
                      <button
                        onClick={() => router.push('/history')}
                        style={{ background: 'none', border: '1px solid rgba(128,128,128,0.35)', borderRadius: 4, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        View old ideas
                      </button>
                    </div>
                    <button
                      onClick={() => { setSelectedIdeaIdsForFilming(savedIdeas.map((i) => i.id)); setTab('filming') }}
                      style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 20px', borderRadius: 4, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      Get filming instructions
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                    {savedIdeas.map((idea) => (
                      <div key={idea.id} style={{ background: 'var(--sand)', borderRadius: 4, padding: '22px', position: 'relative' }}>
                        <button
                          onClick={() => toggleSave(idea.id)}
                          style={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            background: 'none',
                            border: '1px solid rgba(200,50,50,0.4)',
                            borderRadius: 4,
                            padding: '3px 10px',
                            cursor: 'pointer',
                            fontSize: 12,
                            color: 'rgba(200,50,50,0.8)',
                          }}
                        >
                          Remove
                        </button>
                        <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 10, paddingRight: 90 }}>
                          {idea.title}
                        </h3>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                          {idea.hook}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 12 }}>
                          {idea.description}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--coral)' }}>{(() => { try { const t = JSON.parse(idea.tags); return Array.isArray(t) ? t.join(" ") : idea.tags } catch { return idea.tags } })()}</p>
                        {editingNotesId === idea.id ? (
                          <textarea
                            value={idea.notes || ''}
                            onChange={(e) => updateIdeaNotes(idea.id, e.target.value)}
                            onBlur={() => setEditingNotesId(null)}
                            autoFocus
                            placeholder="Add your own notes or tweaks for this idea..."
                            style={{ width: '100%', marginTop: 12, padding: '10px 12px', borderRadius: 4, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", minHeight: 70, resize: 'vertical', boxSizing: 'border-box' }}
                          />
                        ) : idea.notes ? (
                          <div onClick={() => setEditingNotesId(idea.id)} style={{ marginTop: 12, padding: '10px 12px', borderRadius: 4, background: 'var(--card-bg)', cursor: 'pointer' }}>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Your notes (click to edit)</p>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{idea.notes}</p>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingNotesId(idea.id)}
                            style={{ marginTop: 12, background: 'none', border: '1px dashed rgba(128,128,128,0.35)', borderRadius: 4, padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}
                          >
                            + Add notes
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedIdeaIdsForFilming([idea.id])
                            setTab('filming')
                          }}
                          style={{ marginTop: 12, background: 'none', border: '1px solid var(--coral)', borderRadius: 4, padding: '8px 16px', fontSize: 12, fontWeight: 600, color: 'var(--coral)', cursor: 'pointer', display: 'block' }}
                        >
                          Film this
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scripts subsection */}
              {savedScripts.length > 0 && (
                <div style={{ marginTop: 40 }}>
                  <div style={{ borderTop: '1px solid rgba(128,128,128,0.12)', marginBottom: 24 }} />
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Scripts generated</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Scripts you've created in the Script Generator.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {savedScripts.filter((s) => !dismissedScriptIds.has(s.id)).map((s) => (
                      <div key={s.id} style={{ background: 'var(--sand)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{s.topic}</p>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                              {(s.length || s.style) && (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{[s.length, s.style].filter(Boolean).join(' · ')}</span>
                              )}
                              <button
                                onClick={async () => {
                                  setDismissedScriptIds((prev) => new Set([...prev, s.id]))
                                  setSavedScripts((prev) => prev.filter((sc) => sc.id !== s.id))
                                  // Mark script as dismissed in DB
                                  await supabase.from('generated_scripts').update({ dismissed: true }).eq('id', s.id)
                                  // Also unsave any generated_ideas row created from this script
                                  await supabase
                                    .from('generated_ideas')
                                    .update({ saved: false })
                                    .eq('user_id', userId)
                                    .eq('source', 'script')
                                    .eq('title', s.topic)
                                  setDbSavedIdeas((prev) => prev.filter((i) => !(i.source === 'script' && i.title === s.topic)))
                                }}
                                style={{ background: 'none', border: '1px solid rgba(200,50,50,0.4)', borderRadius: 4, padding: '3px 10px', fontSize: 12, color: 'rgba(200,50,50,0.8)', cursor: 'pointer' }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {s.script.split(/(?<=[.!?])\s+/).map((sentence: string, i: number, arr: string[]) => (
                              <div key={i} style={{ paddingTop: i === 0 ? 0 : 8, paddingBottom: 8, borderBottom: i < arr.length - 1 ? '1px solid rgba(128,128,128,0.1)' : 'none' }}>
                                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{sentence}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'filming' && (
            <div>
              {savedIdeas.length > 0 && (
                <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '22px', marginBottom: 24 }}>
                  <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                    Select ideas to film
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {savedIdeas.map((idea) => (
                      <label
                        key={idea.id}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 4, background: 'var(--card-bg)', cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIdeaIdsForFilming.includes(idea.id)}
                          onChange={(e) => {
                            setSelectedIdeaIdsForFilming((prev) =>
                              e.target.checked ? [...prev, idea.id] : prev.filter((id) => id !== idea.id)
                            )
                          }}
                          style={{ marginTop: 3, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 13, lineHeight: 1.4 }}>{idea.title}</span>
                      </label>
                    ))}
                    {savedScripts.length > 0 && (
                      <>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '6px 0 2px' }}>Custom scripts</p>
                        {savedScripts.filter((s) => !dismissedScriptIds.has(s.id)).map((s) => (
                          <label
                            key={s.id}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 4, background: 'var(--card-bg)', cursor: 'pointer' }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIdeaIdsForFilming.includes(`script-${s.id}`)}
                              onChange={(e) => {
                                setSelectedIdeaIdsForFilming((prev) =>
                                  e.target.checked ? [...prev, `script-${s.id}`] : prev.filter((id) => id !== `script-${s.id}`)
                                )
                              }}
                              style={{ marginTop: 3, cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: 13, lineHeight: 1.4 }}>{s.topic}</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 24px', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(128,128,128,0.12)' }}>
                    <div style={{ maxWidth: '100%' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Video length</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {[{ val: 15, label: '15s' }, { val: 30, label: '30s' }, { val: 45, label: '45s' }, { val: 60, label: '1 min' }].map((opt) => (
                          <button key={opt.val} type="button" onClick={() => setVideoLength(opt.val)} style={{ padding: '6px 12px', borderRadius: 4, border: videoLength === opt.val ? '2px solid var(--coral)' : '1px solid rgba(128,128,128,0.25)', background: videoLength === opt.val ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', fontSize: 12, fontWeight: videoLength === opt.val ? 600 : 400, color: videoLength === opt.val ? 'var(--coral)' : 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {filmingMode !== 'single' && filmingMode !== 'quick' && (
                      <div style={{ maxWidth: '100%', minWidth: 190 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Scenes</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 34 }}>
                          <input type="range" min={1} max={15} step={1} value={sceneCount ?? Math.min(15, Math.max(3, Math.round(videoLength / 5)))} onChange={(e) => setSceneCount(Number(e.target.value))} aria-label="Number of scenes" style={{ width: 120, accentColor: 'var(--coral)' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', minWidth: 38, fontVariantNumeric: 'tabular-nums' }}>{sceneCount ?? 'Auto'}</span>
                          {sceneCount !== null && (
                            <button type="button" onClick={() => setSceneCount(null)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>Auto</button>
                          )}
                        </div>
                      </div>
                    )}
                    <div style={{ maxWidth: '100%' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Filming style</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {[
                          { id: 'default', label: 'Standard', tip: 'Best for most reels - balanced mix of shots, clear instructions, works for any business.' },
                          { id: 'multi', label: 'Multi-shot', tip: 'Lots of fast cuts - great for real estate, tutorials, or product showcases with high production value.' },
                          { id: 'single', label: 'Single shot', tip: 'One continuous shot - perfect for vlogs, talking-to-camera, or quick product demos.' },
                          { id: 'quick', label: 'Limited time', tip: 'Busy? 2-3 simple steps, 15-25 seconds total. Grab your phone and film in under 2 minutes.' },
                        ].map((mode) => (
                          <Tooltip key={mode.id} text={mode.tip} position="bottom">
                            <button type="button" onClick={() => setFilmingMode(mode.id as 'default' | 'multi' | 'single' | 'quick')} style={{ padding: '6px 12px', borderRadius: 4, border: filmingMode === mode.id ? '2px solid var(--coral)' : '1px solid rgba(128,128,128,0.25)', background: filmingMode === mode.id ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', fontSize: 12, fontWeight: filmingMode === mode.id ? 600 : 400, color: filmingMode === mode.id ? 'var(--coral)' : 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              {mode.label}
                            </button>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const ideaItems = savedIdeas.filter((idea) => selectedIdeaIdsForFilming.includes(idea.id))
                      const scriptItems = savedScripts
                        .filter((s) => selectedIdeaIdsForFilming.includes(`script-${s.id}`))
                        .map((s) => ({ id: `script-${s.id}`, title: s.topic, hook: s.script.split(/[.!?]/)[0] || s.topic, description: s.topic, tags: '', script: s.script }))
                      proceedToFilming([...ideaItems, ...scriptItems])
                    }}
                    disabled={selectedIdeaIdsForFilming.length === 0 || generatingFilming}
                    style={{ marginTop: 4, backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 20px', borderRadius: 4, fontSize: 13, fontWeight: 600, border: 'none', cursor: selectedIdeaIdsForFilming.length === 0 || generatingFilming ? 'not-allowed' : 'pointer', opacity: selectedIdeaIdsForFilming.length === 0 || generatingFilming ? 0.6 : 1 }}
                  >
                    {generatingFilming ? <><span className='rly-spinner' />Generating...</> : 'Get filming instructions'}
                  </button>
                </div>
              )}

              {filmingError && (
                <p style={{ fontSize: 13, color: "var(--coral)", marginBottom: 16 }}>{filmingError}</p>
              )}              {filmingItems.length > 0 && (
                <div style={{ paddingTop: 4, marginBottom: 16 }}>
                  <button
                    onClick={clearFilming}
                    style={{ background: "none", border: "1px solid rgba(128,128,128,0.3)", borderRadius: 4, padding: "8px 14px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}
                  >
                    Clear
                  </button>
                </div>
              )}
              {generatingFilming && (
                <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, marginTop: 16 }}>
                  <span className='rly-spinner rly-spinner-coral' />
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Generating filming instructions. Your existing cards are still below...</p>
                </div>
              )}
              {!generatingFilming && filmingItems.length === 0 && savedIdeas.length === 0 && (
                <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '48px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    Star an idea in Content Ideas to see it here for filming.
                  </p>
                </div>
              )}
              {filmingItems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {filmingItems.map((item) => (
                    <div key={item.id} style={{ background: 'var(--sand)', borderRadius: 4, overflow: 'hidden' }}>
                      {/* Header */}
                      <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid rgba(128,128,128,0.12)' }}>
                        <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
                          {item.title}
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--coral)' }}>{item.tags}</p>
                      </div>

                      {/* What you'll need */}
                      {item.prep && item.prep.length > 0 && (
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(128,128,128,0.12)', background: 'rgba(128,128,128,0.04)' }}>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>What you'll need</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {item.prep.map((p, i) => (
                              <span key={i} style={{ fontSize: 12, color: 'var(--ink)', background: 'var(--card-bg)', border: '1px solid rgba(128,128,128,0.18)', borderRadius: 4, padding: '4px 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Filming steps */}
                      <div style={{ padding: '16px 24px', borderBottom: item.caption || item.script ? '1px solid rgba(128,128,128,0.12)' : 'none' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>Filming steps</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {item.checklist.map((step, i) => {
                            const dashIdx = step.indexOf(' - ')
                            const timeRange = dashIdx !== -1 ? step.slice(0, dashIdx).trim() : null
                            const instruction = dashIdx !== -1 ? step.slice(dashIdx + 3).trim() : step
                            return (
                              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--coral)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                                  {i + 1}
                                </div>
                                <div style={{ flex: 1 }}>
                                  {timeRange && (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--coral)', background: 'rgba(255,106,77,0.1)', borderRadius: 4, padding: '2px 6px', marginBottom: 4, display: 'inline-block' }}>
                                      {timeRange}
                                    </span>
                                  )}
                                  <p style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.6, fontWeight: 500 }}>{silentCaptions(item) ? simplifyFilmAction(instruction) : instruction}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Caption */}
                      {item.caption && (
                        <div style={{ padding: '16px 24px', borderBottom: item.script ? '1px solid rgba(128,128,128,0.12)' : 'none', background: 'rgba(128,128,128,0.04)' }}>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Suggested caption</p>
                          <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{item.caption}</p>
                        </div>
                      )}

                      {/* Script */}
                      {item.script && (
                        <div style={{ padding: '16px 24px' }}>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>{silentCaptions(item) ? 'On-screen text' : 'Full script'}</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {(() => {
                              // Silent films show one caption per step. Otherwise split the script into sentences
                              const silent = silentCaptions(item)
                              const joiner = silent || item.script.includes('\n') ? '\n' : ' '
                              const sentences: string[] = silent ?? (item.script.includes('\n') ? splitScriptLines(item.script) : item.script
                                .split(/(?<=[.!?])\s+/)
                                .map((s: string) => s.trim())
                                .filter((s: string) => s.length > 0))
                              // Use directions from API if available, otherwise no directions
                              const directions: (string | null)[] = item.directions && item.directions.length > 0 ? item.directions : []
                              // Distribute directions evenly across sentences
                              const validDirections = directions.filter(Boolean)
                              const directionInterval = validDirections.length > 0 ? Math.max(1, Math.floor(sentences.length / validDirections.length)) : 0
                              const stepAction = (i: number) => { const st = item.checklist[i] || ''; const d = st.indexOf(' - '); return simplifyFilmAction(d !== -1 ? st.slice(d + 3) : st) || null }
                              const sentenceDirections: (string | null)[] = silent ? sentences.map((_: string, i: number) => stepAction(i)) : sentences.map((_: string, i: number) => {
                                const dirIdx = directionInterval > 0 ? Math.floor(i / directionInterval) : -1
                                return (dirIdx >= 0 && dirIdx < validDirections.length && i % directionInterval === 0) ? validDirections[dirIdx] : null
                              })

                              return sentences.map((sentence: string, i: number) => {
                                const editKey = `${item.id}-${i}`
                                const isEditing = editingScriptItemId === editKey
                                return (
                                  <div key={i} style={{ paddingTop: i === 0 ? 0 : 14, paddingBottom: 14, borderBottom: i < sentences.length - 1 ? '1px solid rgba(128,128,128,0.1)' : 'none' }}>
                                    {sentenceDirections[i] && (
                                      <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.4, marginBottom: 5 }}>{sentenceDirections[i]}</p>
                                    )}
                                    {isEditing ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <textarea
                                          autoFocus
                                          value={editingScriptText}
                                          onChange={(e) => setEditingScriptText(e.target.value)}
                                          onKeyDown={(e) => { if (e.key === 'Escape') setEditingScriptItemId(null) }}
                                          style={{ width: '100%', fontSize: 14, color: 'var(--ink)', lineHeight: 1.65, background: 'var(--card-bg)', border: '1px solid var(--coral)', borderRadius: 4, padding: '6px 8px', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", resize: 'vertical', boxSizing: 'border-box' as const, minHeight: 60 }}
                                        />
                                        <div style={{ display: 'flex', gap: 8 }}>
                                          <button onClick={async () => {
                                            const newSentences = [...sentences]
                                            const trimmed = editingScriptText.trim() || sentence
                                            newSentences[i] = trimmed
                                            const newScript = newSentences.join(joiner)
                                            // Also update matching checklist step's Say: part
                                            const newChecklist = item.checklist.map((step: string, si: number) => {
                                              if (si !== i) return step
                                              if (silent && silent[i]) return step.replace(silent[i], trimmed)
                                              const sayIdx = step.indexOf("Say: '")
                                              if (sayIdx === -1) return step
                                              return step.slice(0, sayIdx) + `Say: '${trimmed}'`
                                            })
                                            setFilmingItems((prev) => prev.map((f) => f.id === item.id ? { ...f, script: newScript, checklist: newChecklist } : f))
                                            setEditingScriptItemId(null)
                                            await supabase.from('ideas').update({ checklist: { steps: newChecklist, prep: item.prep, caption: item.caption, script: newScript, directions: item.directions } }).eq('id', item.id)
                                          }} style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--coral)', border: 'none', borderRadius: 4, padding: '5px 12px', cursor: 'pointer' }}>Save</button>
                                          <button onClick={() => setEditingScriptItemId(null)} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: '1px solid rgba(128,128,128,0.25)', borderRadius: 4, padding: '5px 12px', cursor: 'pointer' }}>Cancel</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                        <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.65, flex: 1 }}>{sentence}</p>
                                        <button onClick={() => { setEditingScriptItemId(editKey); setEditingScriptText(sentence) }} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid rgba(128,128,128,0.2)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}>Edit</button>
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            })()}
                          </div>
                        </div>
                      )}
                      {/* Film & edit CTA */}
                      <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(128,128,128,0.12)', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => { { const plan = getFilmPlan(item); selectFilmSource(`idea:${item.id}`, plan.lines, plan.actions, plan.durations) }; setTab('film'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                          style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 20px', borderRadius: 4, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                        >
                          Film & edit this
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}


            </div>
          )}

          {tab === 'carousel' && !isProPlan && (
            <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '48px', textAlign: 'center' }}>
              <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Carousel Posts</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Carousel posts are available on the Pro plan.</p>
              <a href="/plans" style={{ fontSize: 13, color: '#fff', background: 'var(--coral)', padding: '10px 18px', borderRadius: 4, fontWeight: 600, textDecoration: 'none' }}>Upgrade to Pro →</a>
            </div>
          )}
          {tab === 'carousel' && isProPlan && (
            <div>
              <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '32px', marginBottom: 24 }}>
                <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Create a carousel
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Upload multiple images and arrange their order. No video rendering involved - this creates a static carousel post.
                </p>

                <input
                  ref={carouselInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleCarouselFileSelect}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => carouselInputRef.current?.click()}
                  style={{
                    background: "var(--coral)",
                    border: "none",
                    borderRadius: 4,
                    padding: "9px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#fff",
                    cursor: "pointer",
                    marginBottom: 16,
                  }}
                >
                  + Add images
                </button>

                {carouselFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Drag to reorder</p>
                    {carouselFiles.map((file, i) => (
                      <div
                        key={i}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move' }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
                          reorderCarouselFiles(fromIndex, i)
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--card-bg)', borderRadius: 4, cursor: 'grab' }}
                      >
                        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>⠿</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{i + 1}</span>
                        <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeCarouselFile(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Caption (optional)</label>
                <textarea
                  value={carouselCaption}
                  onChange={(e) => setCarouselCaption(e.target.value)}
                  rows={2}
                  placeholder="Write a caption for this carousel..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 4, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", resize: 'vertical', boxSizing: 'border-box', marginBottom: 16 }}
                />

                {carouselError && (
                  <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 12 }}>{carouselError}</p>
                )}

                <button
                  onClick={saveCarousel}
                  disabled={savingCarousel || carouselFiles.length === 0}
                  style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 18px', borderRadius: 4, fontSize: 13, fontWeight: 600, border: 'none', cursor: savingCarousel || carouselFiles.length === 0 ? 'not-allowed' : 'pointer', opacity: savingCarousel || carouselFiles.length === 0 ? 0.6 : 1 }}
                >
                  {savingCarousel ? 'Saving...' : 'Save carousel'}
                </button>
              </div>

              {savedCarousels.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600 }}>
                      Saved carousels
                    </h3>
                    <button
                      onClick={downloadAllCarousels}
                      style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 4, padding: '8px 14px', fontSize: 12, color: 'var(--ink)', cursor: 'pointer' }}
                    >
                      Download all
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {savedCarousels.map((c, ci) => (
                      <div key={c.id} style={{ background: 'var(--sand)', borderRadius: 4, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 96, gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 72, height: 72, borderRadius: 4, overflow: 'hidden', background: 'var(--card-bg)', flexShrink: 0 }}>
                            {carouselThumbnails[c.id] && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={carouselThumbnails[c.id]} alt="Carousel preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{c.image_paths.length} images</p>
                            {c.caption && <p style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.caption}</p>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                          <button
                            onClick={() => downloadCarouselImages(c.image_paths, ci)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--coral)', fontSize: 13, fontWeight: 600 }}
                          >
                            Download
                          </button>
                          <button
                            onClick={() => deleteCarousel(c.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'script' && (
            <div>
              {!isProPlan && (
                <div style={{ background: 'rgba(255,106,77,0.08)', border: '1px solid rgba(255,106,77,0.2)', borderRadius: 4, padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Basic plan includes 20 scripts per week. Pro plan includes 96 scripts per week.</p>
                  <a href="/plans" style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', marginLeft: 16 }}>Upgrade to Pro →</a>
                </div>
              )}
              <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '32px', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, margin: 0 }}>Script Generator</h3>
                  <div style={{ background: 'var(--card-bg)', border: '1px solid rgba(128,128,128,0.2)', borderRadius: 4, padding: '6px 12px', textAlign: 'center', flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{scriptsThisWeek} / {isFreeTier ? 3 : isProPlan ? 96 : 20}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>scripts</p>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Type in any idea or topic, pick a length and style, and generate a full word-for-word script - no saved idea required.
                </p>

                <label style={labelStyle}>What's the video about?</label>
                <textarea
                  value={scriptTopic}
                  onChange={(e) => setScriptTopic(e.target.value)}
                  rows={3}
                  placeholder="e.g. Why our sourdough takes 3 days to make, and why it's worth the wait"
                  style={{ ...inputStyle, resize: 'vertical', marginBottom: 20 }}
                />

                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Length</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  {[
                    { id: "short", label: "Short (~15-20s)" },
                    { id: "medium", label: "Medium (~30-45s)" },
                    { id: "long", label: "Long (~60-90s)" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setScriptLength(opt.id as "short" | "medium" | "long")}
                      style={{ padding: "8px 14px", borderRadius: 4, border: scriptLength === opt.id ? "2px solid var(--coral)" : "1px solid rgba(128,128,128,0.25)", background: "var(--card-bg)", fontSize: 12, color: "var(--ink)", cursor: "pointer" }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <label style={labelStyle}>Style (optional)</label>
                <input
                  value={scriptStyle}
                  onChange={(e) => setScriptStyle(e.target.value)}
                  placeholder="e.g. funny, professional, dramatic, warm and personal"
                  style={{ ...inputStyle, marginBottom: 20 }}
                />

                <button
                  onClick={generateFreeformScript}
                  disabled={generatingScript || !scriptTopic.trim()}
                  style={{ backgroundColor: "var(--coral)", color: "#fff", padding: "12px 24px", borderRadius: 4, fontSize: 14, fontWeight: 600, border: "none", cursor: generatingScript || !scriptTopic.trim() ? "not-allowed" : "pointer", opacity: generatingScript || !scriptTopic.trim() ? 0.5 : 1, marginBottom: 20, display: "block" }}
                >
                  {generatingScript ? "Generating script..." : "Generate script"}
                </button>

                {scriptGenError && (
                  <p style={{ fontSize: 13, color: "var(--coral)", marginBottom: 16 }}>{scriptGenError}</p>
                )}

                {savedScripts.length > 0 && !generatedScript && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Previous scripts</p>
                      <button
                        onClick={async () => {
                          if (!userId) return
                          await supabase.from('generated_scripts').delete().eq('user_id', userId)
                          setSavedScripts([])
                        }}
                        style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Clear all
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {savedScripts.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setGeneratedScript(s.script); setScriptTopic(s.topic) }}
                          style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 4, border: '1px solid rgba(128,128,128,0.2)', background: 'var(--card-bg)', cursor: 'pointer', width: '100%' }}
                        >
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{s.topic}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.length ? `${s.length}` : ''}{s.style ? ` · ${s.style}` : ''} · {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {generatedScript && (
                  <div style={{ background: "var(--card-bg)", borderRadius: 4, padding: "24px" }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Full script</p>
                      <button onClick={() => setGeneratedScript(null)} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>← Back to history</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {generatedScript
                        .split(/(?<=[.!?])\s+/)
                        .map((s: string) => s.trim())
                        .filter((s: string) => s.length > 0)
                        .map((sentence: string, i: number, arr: string[]) => (
                          <div key={i} style={{ paddingTop: i === 0 ? 0 : 20, paddingBottom: 20, borderBottom: i < arr.length - 1 ? '1px solid rgba(128,128,128,0.1)' : 'none' }}>
                            <p style={{ fontSize: 22, color: 'var(--ink)', lineHeight: 1.7, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontWeight: 500 }}>{sentence}</p>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
                {generatedScript && (
                  <button
                    onClick={async () => {
                      if (!profile) return
                      const idea = { id: 'script-gen', title: scriptTopic, hook: generatedScript.split(/[.!?]/)[0] || scriptTopic, description: scriptTopic, tags: '', script: generatedScript }
                      await proceedToFilming([idea])
                    }}
                    style={{ marginTop: 12, backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 20px', borderRadius: 4, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                  >
                    Make filming instructions for this
                  </button>
                )}
              </div>
            </div>
          )}
          {tab === 'library' && (
            <ClipLibrary userId={userId} plan={isFreeTier ? 'free' : userPlan} onPlans={() => { window.location.href = '/plans' }} />
          )}
          {libraryPicker && (
            <LibraryPicker
              userId={userId}
              single={libraryPicker === 'film'}
              title={libraryPicker === 'film' ? 'Use a saved clip' : undefined}
              onClose={() => setLibraryPicker(null)}
              onAdd={(files) => {
                if (libraryPicker === 'film') {
                  const f = files[0]
                  if (f) { setFilmRecordError(''); setFilmPending({ blob: f, ext: (f.name.split('.').pop() || 'mp4').toLowerCase(), type: f.type || 'video/mp4', url: URL.createObjectURL(f) }) }
                } else if (libraryPicker === 'ai') addAiFiles(files)
                else addUploadFiles(files)
              }}
            />
          )}

          {tab === 'uploads' && (
            <div className="ed-split" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
<div className="ed-main" style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>

              {/* ── CLIPS ── */}
              <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Your clips</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {uploadSlots.map((slotId, slotIndex) => (
                    <div key={`slot-wrapper-${slotId}`}>

                    <div
                      key={slotId}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(slotId)); e.dataTransfer.effectAllowed = 'move' }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const fromId = parseInt(e.dataTransfer.getData('text/plain'))
                        if (fromId === slotId) return
                        setUploadSlots((prev) => {
                          const fromIdx = prev.indexOf(fromId)
                          const toIdx = prev.indexOf(slotId)
                          const next = [...prev]
                          next.splice(fromIdx, 1)
                          next.splice(toIdx, 0, fromId)
                          return next
                        })
                      }}
                      style={{ background: 'var(--card-bg)', borderRadius: 4, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'grab', border: '1px solid rgba(128,128,128,0.1)' }}
                    >
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>⠿</span>
                      <span style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                        <button type="button" aria-label="Move clip up" disabled={slotIndex === 0} onClick={() => setUploadSlots((prev) => swapItems(prev, prev.indexOf(slotId), prev.indexOf(slotId) - 1))} style={{ background: 'none', border: 'none', padding: '0 4px', fontSize: 10, lineHeight: 1.2, cursor: slotIndex === 0 ? 'default' : 'pointer', opacity: slotIndex === 0 ? 0.25 : 0.8, color: 'var(--ink)' }}>▲</button>
                        <button type="button" aria-label="Move clip down" disabled={slotIndex === uploadSlots.length - 1} onClick={() => setUploadSlots((prev) => swapItems(prev, prev.indexOf(slotId), prev.indexOf(slotId) + 1))} style={{ background: 'none', border: 'none', padding: '0 4px', fontSize: 10, lineHeight: 1.2, cursor: slotIndex === uploadSlots.length - 1 ? 'default' : 'pointer', opacity: slotIndex === uploadSlots.length - 1 ? 0.25 : 0.8, color: 'var(--ink)' }}>▼</button>
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--coral)', background: 'rgba(255,106,77,0.1)', borderRadius: 4, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{slotIndex + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <input
                          ref={(el) => { if (el) el.dataset.slotid = String(slotId) }}
                          className={`upload-slot-input-${slotId}`}
                          type="file" accept="video/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            const sid = parseInt(e.target.dataset.slotid || '0')
                            if (!file || !userId) return
                            setUploadSlotFiles((prev) => ({ ...prev, [sid]: file }))
                            startClipUpload('u', sid, file)
                          }}
                          style={{ display: 'none' }}
                        />
                        {uploadSlotFiles[slotId] ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <p style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadSlotFiles[slotId].name}</p>
                            <ClipUploadBadge status={clipUploadStatus[`u${slotId}`]} onRetry={() => startClipUpload('u', slotId, uploadSlotFiles[slotId])} />
                            <SaveToLibraryButton key={`${slotId}-${uploadSlotFiles[slotId].name}-${uploadSlotFiles[slotId].size}`} userId={userId} plan={isFreeTier ? 'free' : userPlan} getFile={() => uploadSlotFiles[slotId] || null} />
                            <button type="button" onClick={() => (document.querySelector(`.upload-slot-input-${slotId}`) as HTMLInputElement)?.click()} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid rgba(128,128,128,0.25)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}>Change</button>
                          </div>
                        ) : (
                          <div
                            draggable={false}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--coral)' }}
                            onDragLeave={(e) => { e.stopPropagation(); e.currentTarget.style.borderColor = 'transparent' }}
                            onDrop={async (e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              e.currentTarget.style.borderColor = 'transparent'
                              const file = e.dataTransfer.files?.[0]
                              if (!file || !userId) return
                              setUploadSlotFiles((prev) => ({ ...prev, [slotId]: file }))
                              startClipUpload('u', slotId, file)
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, border: '2px dashed transparent', borderRadius: 4, padding: '2px', transition: 'border-color 0.15s' }}
                          >
                            <button type="button" onClick={() => (document.querySelector(`.upload-slot-input-${slotId}`) as HTMLInputElement)?.click()} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                              + Choose clip
                            </button>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>or drag & drop</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                        {uploadSlots.length > 1 && (
                          <button onClick={() => {
                            setUploadSlots((prev) => prev.filter((id) => id !== slotId))
                            setUploadSlotFiles((prev) => { const n = { ...prev }; delete n[slotId]; return n })
                            setUploadSlotPaths((prev) => { const n = { ...prev }; delete n[slotId]; return n })
                            forgetClipUpload('u', slotId)
                            setUploadSpeechSlots((prev) => { const n = new Set(prev); n.delete(slotId); return n })
                            setUploadLandscapeSlots((prev) => { const n = new Set(prev); n.delete(slotId); return n })
                          }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
                        )}
                      </div>
                    </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setUploadSlots((prev) => [...prev, (prev[prev.length - 1] ?? -1) + 1])}
                  style={{ background: 'none', border: '1px dashed rgba(128,128,128,0.3)', borderRadius: 4, padding: '7px 14px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', width: '100%' }}>
                  + Add another clip
                </button>
                <button type="button" onClick={() => setLibraryPicker('any')}
                  style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 4, padding: '7px 14px', fontSize: 12, color: 'var(--ink)', fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 8 }}>
                  Add from library
                </button>
                {uploadLandscapeSlots.size > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(128,128,128,0.12)' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--ink)' }}>How should landscape clips appear?</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[{ id: 'crop', label: 'Crop & zoom' }, { id: 'blur', label: 'Blurred bars' }, { id: 'landscape', label: 'Keep as-is' }].map((opt) => (
                        <button key={opt.id} type="button" onClick={() => setLandscapeHandling(opt.id as 'crop' | 'blur' | 'landscape')}
                          style={{ padding: '6px 12px', borderRadius: 4, border: landscapeHandling === opt.id ? '2px solid var(--coral)' : '1px solid rgba(128,128,128,0.2)', background: landscapeHandling === opt.id ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', fontSize: 12, color: landscapeHandling === opt.id ? 'var(--coral)' : 'var(--ink)', cursor: 'pointer', fontWeight: landscapeHandling === opt.id ? 600 : 400 }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── AUDIO ── */}
              {renderAudioSection('upload', voiceScript?.label)}

              {/* ── CAPTIONS ── */}
              {renderCaptionsCard('upload')}
              {renderOverlayCard()}

              {/* ── VIDEO SETTINGS ── */}
              {renderVideoSettings('upload')}

              {/* ── Render ── */}
              {uploading && (
                <div style={{ padding: '12px 16px', background: 'rgba(200,50,50,0.06)', borderRadius: 4, border: '1px solid rgba(200,50,50,0.3)' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'rgb(220,60,60)', marginBottom: 2 }}>Uploading your clips...</p>
                  <p style={{ fontSize: 12, color: 'rgba(220,60,60,0.7)' }}>Don't navigate away or close this tab until the render starts.</p>
                </div>
              )}
              {uploadError && <p style={{ fontSize: 13, color: 'var(--coral)' }}>{uploadError}</p>}

              <button
                onClick={() => {
                  if (freeQuotaExceeded) { window.location.href = '/plans'; return }
                  const hasAnyFile = uploadSlots.some((id) => uploadSlotFiles[id])
                  if (uploading || extractingAudio || !hasAnyFile) return
                  startUploadAndRender()
                }}
                disabled={uploading || extractingAudio || !uploadSlots.some((id) => uploadSlotFiles[id])}
                style={{ width: '100%', backgroundColor: 'var(--coral)', color: '#fff', padding: '15px', borderRadius: 4, fontSize: 15, fontWeight: 700, border: 'none', boxShadow: uploading || !uploadSlots.some((id) => uploadSlotFiles[id]) ? 'none' : '0 4px 18px rgba(255,106,77,0.4)', cursor: uploading || extractingAudio ? 'not-allowed' : 'pointer', opacity: uploading || extractingAudio || !uploadSlots.some((id) => uploadSlotFiles[id]) ? 0.5 : 1, letterSpacing: 0.3 }}
              >
                {freeQuotaExceeded ? 'Upgrade to render more videos' : uploading ? 'Uploading...' : extractingAudio ? 'Extracting audio...' : 'Create video'}
              </button>

              {/* ── Result ── */}
              {renderId && (
                <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '28px' }}>
                  <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Your video</h3>
                  {renderStatus !== 'done' && renderStatus !== 'failed' && (
                    <>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>Status: {renderStatus || 'starting'}... usually takes a minute or two.</p>
                      <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(128,128,128,0.2)', overflow: 'hidden' }}>
                        <div style={{ width: `${renderProgress}%`, height: '100%', background: 'var(--coral)', borderRadius: 4, transition: 'width 0.4s ease' }} />
                      </div>
                    </>
                  )}
                  {renderStatus === 'failed' && (
                    <p style={{ fontSize: 13, color: 'var(--coral)' }}>
                      {renderError?.includes('No spoken audio') ? 'A clip was marked as speech but no audio was detected. Uncheck "Speech" for that clip and try again.' : renderError || 'Something went wrong. Please try again.'}
                    </p>
                  )}
                  {renderStatus === 'done' && outputUrl && (
                    <>
                      <video controls controlsList="nodownload noremoteplayback" disablePictureInPicture onContextMenu={(e) => { if (isFreeTier) e.preventDefault() }} src={outputUrl} style={{ width: '100%', maxWidth: 400, borderRadius: 4, marginTop: 12 }} />
                      {renderOverQuota ? (
                        <button onClick={() => window.location.href = '/plans'} style={{ marginTop: 12, backgroundColor: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          Upgrade to download ↗
                        </button>
                      ) : (
                        isFreeTier ? <a href="/plans" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: 'var(--sand)', color: 'var(--coral)', border: '1px solid var(--coral)', borderRadius: 4, padding: '6px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Upgrade to download</a> : <button onClick={() => downloadVideo(outputUrl, 'reelezy-video.mp4')} title="Download" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, width: 38, height: 38, fontSize: 16, cursor: 'pointer' }}>↓</button>
                      )}
                    </>
                  )}
                </div>
              )}

              </div>

              {(!renderId || renderStatus === 'failed') && <EditorPreview
                onReorderClip={reorderUploadClip}
                onDropFiles={addUploadFiles}
                captionStyle={previewCaptionStyle}
                captions={uploadCaps}
                onCaptions={setUploadCaps}
                onTrimClip={trimUploadClip}
                showScript={scriptOpen}
                selCap={selCap}
                onSelCap={setSelCap}
                onPlayhead={handlePlayhead}
                overlay={overlay}
                onOverlayMove={moveOverlay}
                segments={uploadSlots.filter((id) => uploadSlotFiles[id]).map((id) => { const f = uploadSlotFiles[id]; const t = uploadTrims[id]; const ok = !!t && t.file === f; return { file: f, start: ok ? t.start : 0, end: ok ? t.end : null } })}
                takes={voiceTakes}
                originalVol={originalVol}
                musicUrl={previewMusicUrl}
                musicVol={musicVol}
                scriptLines={voiceScript?.lines ?? []}
                onAddTake={addVoiceTake}
                onRemoveTake={removeVoiceTake}
                onMoveTake={moveVoiceTake}
              />}
            </div>
          )}

                        {/* Film tab */}
              {tab === 'film' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: filmMulti ? 880 : 1180, margin: '32px auto', padding: '0 24px' }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Film with Teleprompter</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>{filmMulti ? 'Film several videos back to back, then choose the settings for each one and render them all together. You can close the app while they render.' : 'Pick an idea and check its script and actions. Press Start filming to open the full-screen recorder, film one clip per line, then review your video and render it.'}</p>
                  </div>
                  <div role="group" aria-label="How many videos" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 4, background: 'var(--sand)' }}>
                    {([[false, 'One video'], [true, 'Several videos']] as const).map(([multi, name]) => {
                      const locked = filmMultiBusy || filmIsRecording || filmRecorderOpen || filmClips.length > 0 || !!filmPending
                      const active = filmMulti === multi
                      return (
                        <button key={name} type="button" aria-pressed={active} disabled={locked && !active} onClick={() => setFilmMulti(multi)} title={locked && !active ? 'Finish or clear your clips to switch' : undefined} style={{ flex: 1, padding: '9px 12px', borderRadius: 4, border: 'none', background: active ? 'var(--coral)' : 'transparent', color: active ? '#fff' : 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: locked && !active ? 'not-allowed' : 'pointer', opacity: locked && !active ? 0.5 : 1, fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>{name}</button>
                      )
                    })}
                  </div>
                  {filmMulti && userId ? (
                    <MultiFilm
                      userId={userId}
                      ideas={multiFilmIdeas}
                      isFreeTier={showWatermark}
                      userPlan={userPlan}
                      captionDefaults={{ preset: captionPreset, fontFamily: captionFontFamily, fontSize: Number(captionFontSize) || 36, color: captionColor, position: captionPosition, borderColor: captionBorderColor, layers: captionLayers }}
                      captionPresets={CAPTION_PRESETS}
                      fontOptions={FONT_OPTIONS}
                      renderBlocked={freeQuotaExceeded}
                      gateRender={gateRenderAction}
                      onCleared={applyFilmCleared}
                      onBusy={setFilmMultiBusy}
                    />
                  ) : (
                  <>
                  <div className="film-split" style={filmReview ? { display: 'none' } : undefined}>
                  <div style={{ background: 'var(--sand)', borderRadius: 4, padding: 16 }}>
                    <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 12, marginTop: 0 }}>Select idea to film</h3>
                    <div className="film-ideas" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {filmingItems.filter((i) => !i.id.startsWith('script-') && i.source !== 'script').map((idea) => (
                        <label key={idea.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 4, background: filmSelectedId === `idea:${idea.id}` ? 'rgba(255,106,77,0.08)' : 'rgba(128,128,128,0.08)', border: filmSelectedId === `idea:${idea.id}` ? '1px solid var(--coral)' : '1px solid rgba(128,128,128,0.2)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={filmSelectedId === `idea:${idea.id}`} onChange={(e) => { if (e.target.checked) { const plan = getFilmPlan(idea); selectFilmSource(`idea:${idea.id}`, plan.lines, plan.actions, plan.durations) } else selectFilmSource(null, []) }} style={{ marginTop: 2, cursor: 'pointer', accentColor: '#FF6A4D', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, lineHeight: 1.4 }}>{idea.title}</span>
                        </label>
                      ))}
                      {dbSavedIdeas.filter((i) => i.source !== 'script' && !filmingItems.some((f) => f.id === i.id)).length > 0 && (
                        <>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '6px 0 2px', margin: 0 }}>My ideas</p>
                          {dbSavedIdeas.filter((i) => i.source !== 'script' && !filmingItems.some((f) => f.id === i.id)).map((idea) => (
                            <label key={idea.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 4, background: filmSelectedId === `idea:${idea.id}` ? 'rgba(255,106,77,0.08)' : 'rgba(128,128,128,0.08)', border: filmSelectedId === `idea:${idea.id}` ? '1px solid var(--coral)' : '1px solid rgba(128,128,128,0.2)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={filmSelectedId === `idea:${idea.id}`} onChange={(e) => { if (e.target.checked) selectFilmSource(`idea:${idea.id}`, []); else selectFilmSource(null, []) }} style={{ marginTop: 2, cursor: 'pointer', accentColor: '#FF6A4D', flexShrink: 0 }} />
                              <span style={{ fontSize: 13, lineHeight: 1.4 }}>{idea.title}</span>
                            </label>
                          ))}
                        </>
                      )}
                      {savedScripts.length > 0 && (
                        <>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '6px 0 2px', margin: 0 }}>Custom scripts</p>
                          {savedScripts.map((s) => (
                            <label key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 4, background: filmSelectedId === `script-${s.id}` ? 'rgba(255,106,77,0.08)' : 'rgba(128,128,128,0.08)', border: filmSelectedId === `script-${s.id}` ? '1px solid var(--coral)' : '1px solid rgba(128,128,128,0.2)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={filmSelectedId === `script-${s.id}`} onChange={(e) => { if (e.target.checked) { const fi = filmingItems.find((f) => f.id === `script-${s.id}` || (f.source === 'script' && f.title === s.topic)); const plan = fi ? getFilmPlan(fi) : { lines: splitFilmText(s.script), actions: [] as string[], durations: [] as (number | null)[] }; selectFilmSource(`script-${s.id}`, plan.lines, plan.actions, plan.durations) } else selectFilmSource(null, []) }} style={{ marginTop: 2, cursor: 'pointer', accentColor: '#FF6A4D', flexShrink: 0 }} />
                              <span style={{ fontSize: 13, lineHeight: 1.4 }}>{s.topic}</span>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                    {filmingItems.length === 0 && savedScripts.length === 0 && dbSavedIdeas.length === 0 && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 8px' }}>Generate filming instructions for an idea first, or paste your own script below.</p>
                    )}
                  </div>
                  <div style={{ background: 'var(--sand)', borderRadius: 4, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Script and actions</h3>
                    <div className="film-fields">
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '16px 0 0' }}>Your script</p>
                        <textarea value={filmScript} onChange={(e) => { setFilmScript(e.target.value); setFilmLineIdx(0); setFilmClips([]); setFilmReview(false); setFilmRedoIdx(null) }} placeholder="Words to say or show. One line per clip." rows={12} style={{ marginTop: 8, padding: '10px 12px', borderRadius: 4, border: '1px solid rgba(128,128,128,0.2)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, lineHeight: 1.5, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '16px 0 0' }}>Actions</p>
                        <textarea value={filmActionsText} onChange={(e) => { setFilmActionsText(e.target.value); setFilmDurations([]); setFilmLineIdx(0); setFilmClips([]); setFilmReview(false); setFilmRedoIdx(null) }} placeholder="What to do in each clip. One line per clip. You only need a script or actions, not both." rows={12} style={{ marginTop: 8, padding: '10px 12px', borderRadius: 4, border: '1px solid rgba(128,128,128,0.2)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, lineHeight: 1.5, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }} />
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>{filmClipCount} {filmClipCount === 1 ? 'clip' : 'clips'}, one per line</p>
                    {filmSelectedId && filmClipCount === 0 && (
                      <p style={{ fontSize: 12, color: 'var(--coral)', margin: '8px 0 0' }}>This idea has no script or actions yet. Generate its filming instructions, or type your own script or actions. You only need one of them.</p>
                    )}
                    {filmClipCount > 0 && !filmReview && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>Clip plan</p>
                        {Array.from({ length: filmClipCount }, (_, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr', gap: 10, alignItems: 'start', padding: '8px 10px', borderRadius: 4, background: 'var(--card-bg)' }}>
                            <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--coral)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                            <p style={{ fontSize: 12, lineHeight: 1.4, margin: 0, color: filmLines[i] ? 'var(--ink)' : 'var(--text-muted)' }}>{filmLines[i] || 'No script'}</p>
                            <p style={{ fontSize: 12, lineHeight: 1.4, margin: 0, color: 'var(--text-secondary)' }}>{filmActions[i] || 'No action'}{filmActions[i] && filmDurations[i] ? <span style={{ marginLeft: 6, fontWeight: 700, color: 'var(--coral)', whiteSpace: 'nowrap' }}>{filmDurations[i]}s</span> : null}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {!filmReview && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['portrait', 'landscape'] as const).map((o) => {
                      const locked = filmIsRecording || filmClips.length > 0 || !!filmPending
                      const active = filmOrientation === o
                      return (
                        <button
                          key={o}
                          type="button"
                          onClick={() => changeFilmOrientation(o)}
                          disabled={locked}
                          title={locked && !active ? 'Finish or clear your clips to change orientation' : undefined}
                          style={{ flex: 1, padding: '9px 12px', borderRadius: 4, border: active ? '1px solid var(--coral)' : '1px solid rgba(128,128,128,0.3)', background: active ? 'rgba(255,106,77,0.1)' : 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: locked ? 'not-allowed' : 'pointer', opacity: locked && !active ? 0.5 : 1 }}
                        >
                          {o === 'portrait' ? '▯ Portrait' : '▭ Landscape'}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilmRecorderOpen(true)}
                    disabled={filmClipCount === 0}
                    style={{ padding: '15px 20px', borderRadius: 4, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: filmClipCount === 0 ? 'not-allowed' : 'pointer', opacity: filmClipCount === 0 ? 0.5 : 1, boxShadow: filmClipCount === 0 ? 'none' : '0 4px 18px rgba(255,106,77,0.4)', fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}
                  >
                    {filmClips.length > 0 ? `Continue filming (clip ${Math.min(filmLineIdx + 1, filmClipCount)} of ${filmClipCount})` : 'Start filming'}
                  </button>
                  {filmClipCount === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>Choose an idea or add a script or actions to start filming.</p>
                  )}
                      </div>
                    )}
                  </div>
                  </div>
                  {filmRecorderVisible && typeof document !== 'undefined' && createPortal(
                    <div role="dialog" aria-label="Film your video" style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#0b0a10', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
                      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ position: 'relative', background: '#17151f', overflow: 'hidden', aspectRatio: filmOrientation === 'landscape' ? '16 / 9' : '9 / 16', width: filmOrientation === 'landscape' ? 'min(100vw, calc((100dvh - 84px) * 16 / 9))' : 'min(100vw, calc((100dvh - 84px) * 9 / 16))' }}>
                      <button type="button" onClick={closeFilmRecorder} disabled={filmIsRecording || filmCountdown !== null} aria-label="Close recorder" style={{ position: 'absolute', top: 10, right: 10, zIndex: 7, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 20, lineHeight: 1, cursor: filmIsRecording || filmCountdown !== null ? 'not-allowed' : 'pointer', opacity: filmIsRecording || filmCountdown !== null ? 0.4 : 1 }}>✕</button>
                    {showWatermark && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><span style={{ transform: 'rotate(-28deg)', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 44, fontWeight: 800, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', textShadow: '0 2px 8px rgba(0,0,0,0.35)', userSelect: 'none' }}>reelezy</span></div>}
                    <video ref={(el) => { filmVideoRef.current = el; if (el && filmStreamRef.current && el.srcObject !== filmStreamRef.current) el.srcObject = filmStreamRef.current }} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: filmMirrored ? 'scaleX(-1)' : 'none', display: 'block' }} />
                    <CameraControls
                      cam={cam}
                      cameraActive={filmCameraActive}
                      isRecording={filmIsRecording}
                      counting={filmCountdown !== null}
                      recordDisabled={filmUploading || filmClipCount === 0}
                      hidden={!!filmPending}
                      notice={filmClips.length > 0 && !filmPending && filmDeviceLandscape !== (filmOrientation === 'landscape') ? `Turn your phone ${filmOrientation === 'landscape' ? 'sideways' : 'upright'} to match your other clips` : null}
                      onRecord={startFilmRecording}
                      onStop={stopFilmRecording}
                      onFlip={flipFilmCamera}
                      onRestart={restartFilmCamera}
                      onLens={pickFilmLens}
                      onLibrary={() => setLibraryPicker('film')}
                    />
                    {filmClipCount > 0 && (
                      <div style={{ position: 'absolute', bottom: 108, right: 14, zIndex: 3, background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '5px 11px', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                        Clip {Math.min(filmLineIdx + 1, filmClipCount)} of {filmClipCount}
                      </div>
                    )}
                    {filmCurrentLine && !filmPending && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, background: 'rgba(8,6,24,0.62)', padding: filmOrientation === 'landscape' ? '12px 60px 12px 18px' : '46px 60px 14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {filmLines[filmLineIdx - 1] && <p style={{ color: 'rgba(241,239,232,0.45)', fontSize: 14, lineHeight: 1.35, margin: 0 }}>{filmLines[filmLineIdx - 1]}</p>}
                        {filmIsRecording ? (
                          <div style={{ overflow: 'hidden' }}>
                            <p ref={filmTeleprompterInnerRef} style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0, whiteSpace: 'nowrap', textShadow: '0 1px 8px rgba(0,0,0,0.7)', willChange: 'transform', display: 'inline-block', paddingLeft: '100%' }}>{filmCurrentLine}</p>
                          </div>
                        ) : (
                          <p style={{ color: '#fff', fontSize: 17, fontWeight: 700, lineHeight: 1.35, margin: 0 }}>{filmCurrentLine}</p>
                        )}
                        {filmLines[filmLineIdx + 1] && <p style={{ color: 'rgba(241,239,232,0.45)', fontSize: 14, lineHeight: 1.35, margin: 0 }}>{filmLines[filmLineIdx + 1]}</p>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Slower</span>
                          <input type="range" min={1} max={10} value={filmScrollSpeed} aria-label="Teleprompter speed" onChange={(e) => changeFilmSpeed(Number(e.target.value))} style={{ flex: 1, minWidth: 0, accentColor: 'var(--coral)' }} />
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Faster</span>
                        </div>
                      </div>
                    )}
                    {filmCurrentAction && !filmPending && (
                      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 150, zIndex: 2, background: 'rgba(8,6,24,0.62)', borderRadius: 4, padding: '9px 14px', maxHeight: '38%', overflowY: 'auto' }}>
                        <p style={{ color: 'rgba(241,239,232,0.6)', fontSize: 11, fontWeight: 600, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>Action{filmDurations[filmLineIdx] ? <span style={{ background: 'var(--coral)', color: '#fff', fontSize: 13, fontWeight: 800, borderRadius: 4, padding: '2px 10px' }}>about {filmDurations[filmLineIdx]} seconds</span> : null}</p>
                        <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, lineHeight: 1.3, margin: 0, textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>{filmCurrentAction}</p>
                      </div>
                    )}
                    {filmCountdown !== null && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
                        <span style={{ fontSize: 100, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{filmCountdown}</span>
                      </div>
                    )}
                    {!filmCameraActive && !filmIsRecording && filmCountdown === null && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'rgba(0,0,0,0.5)' }}>
                        <button onClick={startFilmCamera} style={{ padding: '12px 28px', borderRadius: 4, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>Enable Camera</button>
                        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, margin: 0, padding: '0 24px', textAlign: 'center', lineHeight: 1.5 }}>{filmCameraError || 'Click to start your camera'}</p>
                      </div>
                    )}
                    {filmRecordError && (
                      <div role="alert" style={{ position: 'absolute', left: 14, right: 14, bottom: 150, zIndex: 6, background: 'rgba(217,45,32,0.92)', color: '#fff', borderRadius: 4, padding: '10px 14px', fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{filmRecordError}</div>
                    )}
                    {filmIsRecording && (
                      <div style={{ position: 'absolute', bottom: 108, left: 14, zIndex: 3, display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '5px 11px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3b30', display: 'inline-block' }} />
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>REC</span>
                      </div>
                    )}
                    {filmPending && (
                      <video key={filmPending.url} src={filmPending.url} controls autoPlay playsInline controlsList="nodownload noremoteplayback" disablePictureInPicture onContextMenu={(e) => { if (isFreeTier) e.preventDefault() }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#000' }} />
                    )}
                  </div>
                      </div>
                      <div style={{ height: 84, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', background: '#0b0a10', color: '#fff' }}>
                        {filmPending ? (
                          <>
                            <p style={{ flex: 1, fontSize: 13, fontWeight: 600, margin: 0 }}>{filmRedoIdx !== null ? `Re-recording clip ${filmRedoIdx + 1}` : `Clip ${filmLineIdx + 1} of ${filmClipCount}`}</p>
                            <SaveToLibraryButton dark key={filmPending.url} userId={userId} plan={isFreeTier ? 'free' : userPlan} getFile={() => new File([filmPending.blob], `film-clip.${filmPending.ext}`, { type: filmPending.type })} />
                            <button onClick={redoFilmClip} style={{ padding: '13px 20px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>↺ Redo</button>
                            <button onClick={saveFilmClip} style={{ padding: '13px 20px', borderRadius: 4, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>{filmRedoIdx !== null ? '✓ Save clip' : filmLineIdx + 1 >= filmClipCount ? '✓ Review video' : '✓ Save & next'}</button>
                          </>
                        ) : (
                          <>
                          
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{filmRedoIdx !== null ? `Re-recording clip ${filmRedoIdx + 1}` : 'Scroll speed'}</span>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{filmScrollSpeed}x</span>
                            </div>
                            <input type="range" min={1} max={10} value={filmScrollSpeed} onChange={(e) => changeFilmSpeed(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--coral)' }} />
                          </div>
                          </>
                        )}
                      </div>
                    </div>,
                    document.body
                  )}
                  {filmReview && (
                    <div className="film-review" style={{ ['--fr-col' as string]: filmOrientation === 'landscape' ? 'minmax(380px, 640px)' : '380px' }}>
                      <div className="fr-left">
                      <div style={filmBezelStyle}>
                      <div style={{ position: 'relative', background: '#17151f', borderRadius: filmOrientation === 'landscape' ? 22 : 34, overflow: 'hidden', aspectRatio: filmOrientation === 'landscape' ? '16 / 9' : '9 / 16', width: '100%' }}>
                        {showWatermark && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><span style={{ transform: 'rotate(-28deg)', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 44, fontWeight: 800, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', textShadow: '0 2px 8px rgba(0,0,0,0.35)', userSelect: 'none' }}>reelezy</span></div>}
                    <video key={filmPlayIdx} src={filmClips[filmPlayIdx]?.url} autoPlay controls playsInline controlsList="nodownload noremoteplayback" disablePictureInPicture onContextMenu={(e) => { if (isFreeTier) e.preventDefault() }} onEnded={() => { if (filmPlayIdx + 1 < filmClips.length) setFilmPlayIdx(filmPlayIdx + 1) }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <div style={{ position: 'absolute', top: filmOrientation === 'landscape' ? 12 : 44, left: 12, background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '5px 11px', color: '#fff', fontSize: 11, fontWeight: 700, pointerEvents: 'none' }}>Clip {filmPlayIdx + 1} of {filmClips.length}</div>
                      </div>
                      {filmNotch}
                      </div>
                      <button type="button" onClick={() => setFilmPlayIdx(0)} style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 4, padding: '7px 16px', fontSize: 12, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}>▶ Play from the start</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                      <div>
                        <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 17, fontWeight: 700, margin: 0 }}>Review your video</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>Watch it back in order. Redo any clip you don&apos;t like, then render.</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {filmClips.map((cl, i) => (
                          <div key={cl.url} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 4, background: filmPlayIdx === i ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', border: filmPlayIdx === i ? '1px solid var(--coral)' : '1px solid transparent' }}>
                            <button type="button" onClick={() => setFilmPlayIdx(i)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>{i + 1}</button>
                            <p style={{ flex: 1, fontSize: 13, lineHeight: 1.4, margin: 0 }}>{filmLines[i] || filmActions[i] || `Clip ${i + 1}`}</p>
                            <span style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                              <button type="button" aria-label="Move clip earlier" disabled={i === 0} onClick={() => moveFilmClip(i, -1)} style={{ background: 'none', border: 'none', padding: '0 6px', fontSize: 11, lineHeight: 1.3, cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.25 : 0.8, color: 'var(--ink)' }}>▲</button>
                              <button type="button" aria-label="Move clip later" disabled={i === filmClips.length - 1} onClick={() => moveFilmClip(i, 1)} style={{ background: 'none', border: 'none', padding: '0 6px', fontSize: 11, lineHeight: 1.3, cursor: i === filmClips.length - 1 ? 'default' : 'pointer', opacity: i === filmClips.length - 1 ? 0.25 : 0.8, color: 'var(--ink)' }}>▼</button>
                            </span>
                            <SaveToLibraryButton key={cl.url} userId={userId} plan={isFreeTier ? 'free' : userPlan} getFile={() => new File([cl.blob], `film-clip-${i + 1}.${cl.ext}`, { type: cl.type })} />
                            <button type="button" onClick={() => startRedoFilmClip(i)} disabled={filmUploading} style={{ background: 'none', border: '1px solid rgba(128,128,128,0.35)', borderRadius: 4, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', flexShrink: 0 }}>↺ Redo</button>
                          </div>
                        ))}
                      </div>
                      {renderAudioSection('upload', voiceScript?.label)}
                      <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '20px 24px 24px' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: '0 0 18px' }}>Preferences</p>
                        {renderPreferencesFields()}
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>Render time used: {stats.find((s) => s.label === 'Render time used')?.value}</p>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button onClick={() => { if (freeQuotaExceeded) { window.location.href = '/plans'; return } gateRenderAction(() => { finishFilm(filmClips, true) }) }} disabled={filmUploading} style={{ flex: 1, minWidth: 140, padding: '13px 20px', borderRadius: 4, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: filmUploading ? 'not-allowed' : 'pointer', opacity: filmUploading ? 0.7 : 1, fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>{filmUploading ? 'Saving…' : freeQuotaExceeded ? 'Upgrade to render' : 'Render video'}</button>
                        <button onClick={() => finishFilm(filmClips, false)} disabled={filmUploading} style={{ flex: 1, minWidth: 140, padding: '13px 20px', borderRadius: 4, border: '1px solid rgba(128,128,128,0.35)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, cursor: filmUploading ? 'not-allowed' : 'pointer', opacity: filmUploading ? 0.7 : 1, fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>Open in full editor</button>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Open in full editor also lets you change clip order, speed and trims before you render.</p>
                      </div>
                    </div>
                  )}
                  </>
                  )}
                </div>
              )}

{tab === 'aiuploads' && (
            <div className={selectedFilmingId ? 'ed-split' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
<div className="ed-main" style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>

              {/* ── Select idea ── */}
              <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '28px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Select an idea to film</p>
                {filmingItems.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Generate filming instructions first in the Filming tab, then come back here to upload your clips.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {filmingItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { setSelectedFilmingId(item.id); setStepUploads({}); resetAiClipUploads(); setAiSpeechSteps(new Set()); setAiOwnTexts({}); setAiCaps([]); const scriptLinesForIdea = getFilmLines(item); if (scriptLinesForIdea.length > 0) setVoiceScript({ id: `idea:${item.id}`, label: item.title || 'Idea', lines: scriptLinesForIdea }); else setVoiceScript(null) }}
                        style={{ padding: '8px 14px', borderRadius: 4, border: selectedFilmingId === item.id ? '2px solid var(--coral)' : '1px solid rgba(128,128,128,0.25)', background: selectedFilmingId === item.id ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', fontSize: 12, color: selectedFilmingId === item.id ? 'var(--coral)' : 'var(--ink)', fontWeight: selectedFilmingId === item.id ? 600 : 400, cursor: 'pointer' }}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedFilmingId && (() => {
                const item = filmingItems.find((f) => f.id === selectedFilmingId)
                if (!item) return null
                return (
                  <>
                    {/* ── STEP 1: Clips per step ── */}
                    <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '28px' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>1 · Upload your clips</p>
                      <button type="button" onClick={() => setLibraryPicker('ai')} style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 4, padding: '6px 12px', fontSize: 12, color: 'var(--ink)', fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>Add from library</button>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                        <button type="button" onClick={() => setAiSingleClipMode(false)} style={{ padding: '8px 16px', borderRadius: 4, border: !aiSingleClipMode ? '2px solid var(--coral)' : '1px solid rgba(128,128,128,0.25)', background: !aiSingleClipMode ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', fontSize: 13, color: !aiSingleClipMode ? 'var(--coral)' : 'var(--ink)', fontWeight: !aiSingleClipMode ? 600 : 400, cursor: 'pointer' }}>
                          I filmed separate clips per step
                        </button>
                        <button type="button" onClick={() => setAiSingleClipMode(true)} style={{ padding: '8px 16px', borderRadius: 4, border: aiSingleClipMode ? '2px solid var(--coral)' : '1px solid rgba(128,128,128,0.25)', background: aiSingleClipMode ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', fontSize: 13, color: aiSingleClipMode ? 'var(--coral)' : 'var(--ink)', fontWeight: aiSingleClipMode ? 600 : 400, cursor: 'pointer' }}>
                          I filmed one long video
                        </button>
                      </div>
                      {aiSingleClipMode ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input id="ai-single-clip" type="file" accept="video/*" onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setStepUploads({ 0: file })
                            startClipUpload('a', 0, file)
                          }} style={{ display: 'none' }} />
                          <div style={{ background: 'var(--card-bg)', borderRadius: 4, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(128,128,128,0.1)' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--coral)', background: 'rgba(255,106,77,0.1)', borderRadius: 4, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {stepUploads[0] ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <p style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stepUploads[0].name}</p>
                                  <ClipUploadBadge status={clipUploadStatus['a0']} onRetry={() => startClipUpload('a', 0, stepUploads[0])} />
                                  <button type="button" onClick={() => document.getElementById('ai-single-clip')?.click()} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid rgba(128,128,128,0.25)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}>Change</button>
                                </div>
                              ) : (
                                <div
                                  draggable={false}
                                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--coral)' }}
                                  onDragLeave={(e) => { e.stopPropagation(); e.currentTarget.style.borderColor = 'transparent' }}
                                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'transparent'; const file = e.dataTransfer.files?.[0]; if (file) setStepUploads({ 0: file }) }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, border: '2px dashed transparent', borderRadius: 4, padding: '2px', transition: 'border-color 0.15s' }}
                                >
                                  <button type="button" onClick={() => document.getElementById('ai-single-clip')?.click()} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Choose clip</button>
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>or drag & drop</span>
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>

                              {stepUploads[0] && <button type="button" onClick={() => { setStepUploads({}); resetAiClipUploads() }} style={{ fontSize: 14, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>}
                            </div>
                          </div>
                        </div>
                      ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {item.checklist.map((step, i) => {
                          const dashIdx = step.indexOf(' - ')
                          const timeRange = dashIdx !== -1 ? step.slice(0, dashIdx).trim() : null
                          const instruction = dashIdx !== -1 ? step.slice(dashIdx + 3).trim() : step
                          return (
                            <React.Fragment key={i}>
<div key={i} style={{ background: 'var(--card-bg)', borderRadius: 4, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, border: '1px solid rgba(128,128,128,0.1)' }}>
                              <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>⠿</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--coral)', background: 'rgba(255,106,77,0.1)', borderRadius: 4, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{i + 1}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {timeRange && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--coral)', background: 'rgba(255,106,77,0.1)', borderRadius: 4, padding: '2px 6px', marginBottom: 4, display: 'inline-block' }}>{timeRange}</span>}
                                <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, fontWeight: 500, marginBottom: 8 }}>{instruction}</p>
                                <input id={`ai-step-${i}`} type="file" accept="video/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { setStepUploads((prev) => ({ ...prev, [i]: file })); startClipUpload('a', i, file) } }} style={{ display: 'none' }} />
                                {(stepUploads[i] || stepUploadNames[i]) ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <p style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stepUploads[i]?.name || stepUploadNames[i]}</p>
                                    <ClipUploadBadge status={clipUploadStatus[`a${i}`]} onRetry={() => { const f = stepUploads[i]; if (f) startClipUpload('a', i, f) }} />
                                    <button type="button" onClick={() => document.getElementById(`ai-step-${i}`)?.click()} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid rgba(128,128,128,0.25)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}>Change</button>
                                  </div>
                                ) : (
                                  <div
                                    draggable={false}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--coral)' }}
                                    onDragLeave={(e) => { e.stopPropagation(); e.currentTarget.style.borderColor = 'transparent' }}
                                    onDrop={async (e) => {
                                      e.preventDefault(); e.stopPropagation()
                                      e.currentTarget.style.borderColor = 'transparent'
                                      const file = e.dataTransfer.files?.[0]
                                      if (file) { setStepUploads((prev) => ({ ...prev, [i]: file })); startClipUpload('a', i, file) }
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, border: '2px dashed transparent', borderRadius: 4, padding: '2px', transition: 'border-color 0.15s' }}
                                  >
                                    <button type="button" onClick={() => document.getElementById(`ai-step-${i}`)?.click()} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Choose clip</button>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>or drag & drop</span>
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                                {(stepUploads[i] || stepUploadNames[i]) && (
                                  <button type="button" onClick={() => {
                                    setStepUploads((prev) => { const n = {...prev}; delete n[i]; return n })
                                    setStepUploadPaths((prev) => { const n = {...prev}; delete n[i]; return n })
                                    forgetClipUpload('a', i)
                                    setStepUploadNames((prev) => { const n = {...prev}; delete n[i]; return n })
                                    void authFetch('/api/delete-draft-clip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, editorType: 'ai', slotIndex: i }) })
                                  }} style={{ fontSize: 14, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
                                )}
                              </div>
                            </div>
                            </React.Fragment>
                          )
                        })}
                      </div>
                      )}
                      {!aiSingleClipMode && aiLandscapeSteps.size > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Landscape clips: how should they appear?</p>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[{ id: 'crop', label: 'Crop & zoom' }, { id: 'blur', label: 'Blurred bars' }, { id: 'landscape', label: 'Keep landscape' }].map((opt) => (
                              <button key={opt.id} type="button" onClick={() => setAiLandscapeHandling(opt.id as 'crop' | 'blur' | 'landscape')} style={{ padding: '7px 14px', borderRadius: 4, border: aiLandscapeHandling === opt.id ? '2px solid var(--coral)' : '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', fontSize: 12, color: 'var(--ink)', cursor: 'pointer' }}>{opt.label}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── AUDIO ── */}
                    {renderAudioSection('ai', voiceScript?.label ?? (aiIdeaLines.length > 0 ? aiIdeaItem?.title || 'your idea' : undefined))}

                    {/* ── CAPTIONS ── */}
                    {renderCaptionsCard('ai')}
                    {renderOverlayCard()}

                    {/* ── VIDEO SETTINGS ── */}
                    {renderVideoSettings('ai')}

                    {/* ── Render ── */}
                    {aiUploading && (
                      <div style={{ padding: '12px 16px', background: 'rgba(200,50,50,0.06)', borderRadius: 4, border: '1px solid rgba(200,50,50,0.3)' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'rgb(220,60,60)', marginBottom: 2 }}>Uploading your clips...</p>
                        <p style={{ fontSize: 12, color: 'rgba(220,60,60,0.7)' }}>Don't navigate away or close this tab until the render starts.</p>
                      </div>
                    )}
                    {aiEditorError && (
                      <p style={{ fontSize: 13, color: 'var(--coral)', padding: '12px 16px', background: 'rgba(255,106,77,0.08)', borderRadius: 4, border: '1px solid rgba(255,106,77,0.25)' }}>{aiEditorError}</p>
                    )}

                    <button
                      onClick={() => { if (freeQuotaExceeded) { window.location.href = '/plans'; return } if (aiUploading || extractingAudio || Object.keys(stepUploads).length === 0) return; submitAiEditorUploads() }}
                      disabled={aiUploading || extractingAudio || Object.keys(stepUploads).length === 0}
                      style={{ width: '100%', backgroundColor: 'var(--coral)', color: '#fff', padding: '15px', borderRadius: 4, fontSize: 15, fontWeight: 700, border: 'none', boxShadow: aiUploading || Object.keys(stepUploads).length === 0 ? 'none' : '0 4px 18px rgba(255,106,77,0.4)', cursor: aiUploading || extractingAudio ? 'not-allowed' : 'pointer', opacity: aiUploading || extractingAudio || Object.keys(stepUploads).length === 0 ? 0.5 : 1, letterSpacing: 0.3 }}
                    >
                      {freeQuotaExceeded ? 'Upgrade to render more videos' : aiUploading ? 'Uploading...' : extractingAudio ? 'Extracting audio...' : 'Create video'}
                    </button>

                    {aiRenderId && (
                      <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '28px' }}>
                        <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Your video</h3>
                        {aiRenderStatus !== 'done' && aiRenderStatus !== 'failed' && (
                          <>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>Status: {aiRenderStatus || 'starting'}... usually takes a minute or two.</p>
                            <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(128,128,128,0.2)', overflow: 'hidden' }}>
                              <div style={{ width: `${aiRenderProgress}%`, height: '100%', background: 'var(--coral)', borderRadius: 4, transition: 'width 0.4s ease' }} />
                            </div>
                          </>
                        )}
                        {aiRenderStatus === 'failed' && <p style={{ fontSize: 13, color: 'var(--coral)' }}>Something went wrong rendering your video. Please try again.</p>}
                        {aiRenderStatus === 'done' && aiOutputUrl && (
                          <>
                            <video controls controlsList="nodownload noremoteplayback" disablePictureInPicture onContextMenu={(e) => { if (isFreeTier) e.preventDefault() }} src={aiOutputUrl} style={{ width: '100%', maxWidth: 400, borderRadius: 4, marginTop: 12 }} />
                            {aiRenderOverQuota ? (
                              <button onClick={() => window.location.href = '/plans'} style={{ marginTop: 12, backgroundColor: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                Upgrade to download ↗
                              </button>
                            ) : (
                              isFreeTier ? <a href="/plans" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: 'var(--sand)', color: 'var(--coral)', border: '1px solid var(--coral)', borderRadius: 4, padding: '6px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Upgrade to download</a> : <button onClick={() => downloadVideo(aiOutputUrl, 'reelezy-video.mp4')} title="Download" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, width: 38, height: 38, fontSize: 16, cursor: 'pointer' }}>↓</button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )
              })()}
              </div>

              {!!selectedFilmingId && (!aiRenderId || aiRenderStatus === 'failed') && <EditorPreview
                onDropFiles={addAiFiles}
                captionStyle={previewCaptionStyle}
                captions={aiCaps}
                onCaptions={setAiCaps}
                onTrimClip={trimAiClip}
                showScript={scriptOpen}
                selCap={selCap}
                onSelCap={setSelCap}
                onPlayhead={handlePlayhead}
                overlay={overlay}
                onOverlayMove={moveOverlay}
                segments={Object.keys(stepUploads).map(Number).sort((a, b) => a - b).map((i) => { const f = stepUploads[i]; const t = aiTrims[i]; const ok = !!t && t.file === f; return { file: f, start: ok ? t.start : 0, end: ok ? t.end : null } })}
                takes={voiceTakes}
                originalVol={originalVol}
                musicUrl={previewMusicUrl}
                musicVol={musicVol}
                scriptLines={voiceScript?.lines ?? aiIdeaLines}
                onAddTake={addVoiceTake}
                onRemoveTake={removeVoiceTake}
                onMoveTake={moveVoiceTake}
              />}
            </div>
          )}

        {tab === 'scheduler' && (
          <SchedulerTab userId={userId} carousels={savedCarousels} isFree={isFreeTier} />
          )}
        </div>
      </div>

      {showProfileNudge && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#FFFFFF', border: '1px solid var(--line)', borderRadius: 4, padding: '36px 32px', maxWidth: 420, width: '100%', boxShadow: 'none' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 }}>Quick tip</p>
            <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
              Your ideas will get a lot better
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
              You&apos;ve got the basics set up. Adding your tone, ideal customer, selling points and a few more details takes 2 minutes and makes your content ideas dramatically more specific and useful.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowProfileNudge(false)}
                style={{ flex: 1, padding: '11px', borderRadius: 4, border: '1px solid var(--line)', background: 'none', color: 'var(--ink)', fontSize: 14, cursor: 'pointer' }}
              >
                Maybe later
              </button>
              <button
                onClick={() => { setShowProfileNudge(false); window.location.href = '/settings' }}
                style={{ flex: 2, padding: '11px', borderRadius: 4, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                Fill out my profile →
              </button>
            </div>
          </div>
        </div>
      )}

      {showMusicLibrary && (
        <div
          onClick={() => { previewAudioRef.current?.pause(); setPreviewingTrackId(null); setShowMusicLibrary(null) }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--card-bg)", borderRadius: 4, padding: "32px", maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto" }}
          >
            <h2 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
              Music library
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              Browse licensed tracks and preview before adding them to your video.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MUSIC_LIBRARY_TRACKS.map((track) => (
                <div key={track.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--sand)", borderRadius: 4 }}>
                  <button
                    type="button"
                    onClick={() => togglePreviewTrack(track.id, track.url)}
                    style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "var(--coral)", color: "#fff", fontSize: 14, cursor: "pointer", flexShrink: 0 }}
                  >
                    {previewingTrackId === track.id ? "❚❚" : "▶"}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{track.name}</p>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>{track.mood}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectLibraryTrack(track.id, track.name, track.url, showMusicLibrary)}
                    style={{ background: "none", border: "1px solid rgba(128,128,128,0.3)", borderRadius: 4, padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}
                  >
                    Use this track
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
