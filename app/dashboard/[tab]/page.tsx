'use client'

import React from 'react'
import { ReelezyLogo } from '@/components/ReelezyLogo'
import { authFetch } from '@/lib/authFetch'
import { parseComfort } from '@/lib/filmingComfort'
import { PLAN_LIMITS } from '@/lib/planLimits'
import { type CaptionLayers, DEFAULT_CAPTION_LAYERS, resolveCaptionLayers, layerPoint } from '@/lib/captionLayers'
import { useEffect, useState, useRef, useMemo, useCallback, useSyncExternalStore } from 'react'
import Dropdown from '@/components/Dropdown'
import ColorSelect from '@/components/ColorSelect'
import CollapsibleBox, { BoxOpenContext } from '@/components/CollapsibleBox'
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
import SpeedSlider from '@/components/SpeedSlider'
import CropPage from '@/components/CropPage'
import ClipLibrary, { LibraryPicker, SaveToLibraryButton } from '@/components/ClipLibrary'
import { AudioLibrary, AudioPicker, announceAudioLibraryChanged } from '@/components/AudioLibrary'
import { saveAudioToLibrary } from '@/lib/clipLibrary'
import Tour, { type TourStep } from '@/components/Tour'
import OverlayPicker from '@/components/OverlayPicker'
import OverlayElements from '@/components/OverlayElements'
import { useCameraControls } from '@/lib/useCameraControls'
import { photoToClip } from '@/lib/photoToClip'
import MultiFilm, { type MultiFilmIdea, type MultiFilmHandoff } from '@/components/MultiFilm'
import { trackRenders } from '@/lib/renderTracker'
import { pickRecorderMime, streamIsLive, beginRecorder, beginRecorderPaused, resumeRecorder, finishRecorder } from '@/lib/recorderSupport'
import Icon from '@/components/Icon'
import OverviewPanel from '@/components/OverviewPanel'
import CarouselCard, { carouselBtn } from '@/components/CarouselCard'
import { BADGE_SPOT, BADGE_SRC, BADGE_RATIO } from '@/lib/madeWithBadge'
type Profile = {
  business_name: string
  industry: string
  suburb: string
  target_locations?: string | null
  website?: string | null
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

// Notifications and post stats are hidden for launch until posting accounts are approved. Set to true to bring them back.
const SHOW_OVERVIEW_PANELS = false

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
type ArchivedFilmingItem = FilmingItem & { createdAt?: string }


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


// The part of a clip's picture to keep, as shares of its width and height (0 to 1)
type ClipCrop = { x: number; y: number; w: number; h: number }
// Where a clip sits in the frame after it is dragged or zoomed on the preview: x and y move its middle by that share
// of the frame, s zooms it (1 is the whole picture fitted inside the frame)
type ClipPlace = { x: number; y: number; s: number }
const placeIsPlain = (p: ClipPlace | null | undefined) => !p || (Math.abs(p.x) < 0.002 && Math.abs(p.y) < 0.002 && Math.abs(p.s - 1) < 0.002)
// Where the + on a timeline line can add from: the user's Reelezy library, their photo library or their files
type AddSource = { library: () => void; photos: (files: File[]) => void; files: (files: File[]) => void; photoAccept: string; fileAccept: string; multiple?: boolean; photoLabel?: string; libraryLabel?: string }
type AddSources = { video?: AddSource; audio?: AddSource }
// What tapping the other things on the timeline can do: voiceovers, music, overlays and captions
type TimelineOps = { onTakeVolume?: (id: string, v: number) => void; onMusicVol?: (v: number) => void; onRemoveMusic?: () => void; onRemoveOverlay?: (id: string) => void; musicStart?: number; onMusicStart?: (s: number) => void }
// Small line icons for the clip pop-up and the phone tools
const CLIP_ICONS: Record<string, React.ReactNode> = {
  speed: <><path d="M3.5 15.5a7.5 6.5 0 0 1 15 0z" /><path d="M8.5 9.6 11 15.5M13.5 9.6 11 15.5M3.5 13h15" /><path d="M18.5 13.5h1.8a1.8 1.8 0 0 0 0-3.6h-.6c-.6 0-1.2.6-1.2 1.2" /><path d="M6 15.5 5 18M16 15.5l1 2.5M3.5 15.5 2 16.5" /></>,
  audio: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  crop: <><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  fit: <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  bin: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
}
const PLUS_COL = 40
// A full-width volume slider for the dark timeline pop-ups
const PopVolume = ({ value, onChange, label = 'Volume' }: { value: number; onChange: (v: number) => void; label?: string }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
    <span style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><span style={{ fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{value <= 0 ? 'Muted' : `${Math.round(value)}%`}</span></span>
    <input type="range" min={0} max={100} step={1} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--coral)', minHeight: 28, margin: 0 }} />
  </label>
)
// Videos and sounds recorded in a browser (filmed clips, voice recordings) often say their length is unknown.
// Jumping to the far end makes the browser work it out. Without this the timeline thought filmed clips were
// 0 seconds long, so the line never moved and dragging it did nothing.
const whenDurationKnown = (m: HTMLMediaElement, done: (d: number) => void, giveUpMs = 6000) => {
  if (Number.isFinite(m.duration) && m.duration > 0) { done(m.duration); return }
  let finished = false
  const stop = () => { finished = true; m.removeEventListener('durationchange', check); m.removeEventListener('timeupdate', check); m.removeEventListener('seeked', check) }
  function check() {
    if (finished || !Number.isFinite(m.duration) || m.duration <= 0) return
    stop()
    done(m.duration)
  }
  m.addEventListener('durationchange', check)
  m.addEventListener('timeupdate', check)
  m.addEventListener('seeked', check)
  try { m.currentTime = 1e101 } catch {}
  window.setTimeout(() => { if (!finished) stop() }, giveUpMs)
}
const LineIcon = ({ n, size = 20 }: { n: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{CLIP_ICONS[n]}</svg>
)
// iPhones draw nothing for a video that has never played, so a clip stayed black until Play was pressed and
// moving the line did not change the picture. Playing it for a moment with the sound off makes it draw.
const primeVideo = (v: HTMLVideoElement | null, keepPlaying: () => boolean, soundOn: () => boolean) => {
  if (!v) return
  const src = v.getAttribute('data-src') || v.currentSrc || ''
  if (!src || v.getAttribute('data-primed') === src || !v.paused) return
  v.setAttribute('data-primed', src)
  const at = v.currentTime
  v.muted = true
  const p = v.play()
  if (!p) return
  p.then(() => {
    // Play was pressed meanwhile: the Play press already set the sound. Safari pauses a playing video whose
    // sound is switched on by the page rather than by a tap, so leave it alone.
    if (keepPlaying()) return
    v.pause()
    // Go back to the frame it was on, unless something else has moved it since
    try { if (v.currentTime - at > 0 && v.currentTime - at < 0.3) v.currentTime = at } catch {}
    v.muted = !soundOn()
  }).catch(() => { v.removeAttribute('data-primed') })
}
// What tapping a clip on the timeline can do: its speed, sound, crop, duplicate and delete. On phones onOpen takes
// Speed and Audio to their own panel; on a computer they open inside the little pop-up.
type ClipOps = {
  onOpen?: (kind: 'speed' | 'audio', i: number) => void
  level: (i: number) => { vol: number; muted: boolean }
  onVolume: (i: number, v: number) => void
  onMute: (i: number, m: boolean) => void
  onCrop: (i: number, crop: ClipCrop | null) => void
  onPlace?: (i: number, place: ClipPlace | null) => void
  onDelete: (i: number) => void
  onDuplicate?: (i: number) => void
  onTap?: (i: number) => void
}
type VoiceoverSegment = { file: File; start: number; end: number | null; speed?: number; volume?: number; crop?: ClipCrop; place?: ClipPlace; appearance?: AppearanceSettings; caption?: string; captionLayer?: 'onScreen' | 'speech' }
// How the preview draws the user's own captions (same colours and places as the final video)
// Optional per-caption text settings: anything left out uses the shared Caption look
type CustomCaption = { id: string; text: string; start: number; end: number; x: number; y: number; w?: number; font?: string; size?: number; color?: string; bg?: string | null; bold?: boolean; italic?: boolean; underline?: boolean }
// Is a font bold when nothing else is said? ("Sans Bold" is, "Sans" is not)
const fontIsBold = (name?: string) => /bold|impact|anton|bebas/i.test(name || 'Sans Bold')
// Picking up a range slider inside a card that can be dragged must move the slider, not the card
const holdCardDrag = (e: React.PointerEvent) => {
  const card = (e.currentTarget as HTMLElement).closest('[draggable="true"]') as HTMLElement | null
  if (!card) return
  card.draggable = false
  const restore = () => { card.draggable = true; window.removeEventListener('pointerup', restore); window.removeEventListener('pointercancel', restore) }
  window.addEventListener('pointerup', restore)
  window.addEventListener('pointercancel', restore)
}
// The fonts the finished video can use. The render server has the Liberation fonts, which are drawn to match
// Arial, Times New Roman, Courier New and Arial Narrow, so the preview and the menu show those.
// The names are what gets saved and sent; the labels are what people see.
const CAPTION_TEXT_FONTS: { name: string; label: string; css: string; weight: number }[] = [
  { name: 'Sans Bold', label: 'Arial Bold', css: "Arial, 'Liberation Sans', Helvetica, sans-serif", weight: 700 },
  { name: 'Sans', label: 'Arial', css: "Arial, 'Liberation Sans', Helvetica, sans-serif", weight: 400 },
  { name: 'Narrow Bold', label: 'Arial Narrow Bold', css: "'Arial Narrow', 'Liberation Sans Narrow', 'Roboto Condensed', Arial, sans-serif", weight: 700 },
  { name: 'Narrow', label: 'Arial Narrow', css: "'Arial Narrow', 'Liberation Sans Narrow', 'Roboto Condensed', Arial, sans-serif", weight: 400 },
  { name: 'Serif Bold', label: 'Times New Roman Bold', css: "'Times New Roman', 'Liberation Serif', Times, serif", weight: 700 },
  { name: 'Serif', label: 'Times New Roman', css: "'Times New Roman', 'Liberation Serif', Times, serif", weight: 400 },
  { name: 'Mono Bold', label: 'Courier New Bold', css: "'Courier New', 'Liberation Mono', Courier, monospace", weight: 700 },
  { name: 'Mono', label: 'Courier New', css: "'Courier New', 'Liberation Mono', Courier, monospace", weight: 400 },
]
// Older saved choices (Montserrat, Impact and so on) were always drawn with these, so show them as what they really are
const toCaptionFont = (name?: string | null) => CAPTION_TEXT_FONTS.some((f) => f.name === name) ? (name as string) : /impact|anton|bebas|oswald|narrow/i.test(name || '') ? 'Narrow Bold' : 'Sans Bold'
const FONT_OPTIONS = CAPTION_TEXT_FONTS.map((f) => f.name)
// Menu entries that show each font in its own typeface
const FONT_MENU = CAPTION_TEXT_FONTS.map((f) => ({ value: f.name, label: f.label, style: { fontFamily: f.css, fontWeight: f.weight, fontSize: 14 } as React.CSSProperties }))
// Ready-made looks for the captions the person types. Each one sets the font, text colour and background in one press.
const CAPTION_LOOKS: { name: string; font: string; color: string; bg: string | null }[] = [
  { name: 'Classic', font: 'Sans Bold', color: '#FFFFFF', bg: null },
  { name: 'Highlight', font: 'Sans Bold', color: '#111111', bg: '#FFE14D' },
  { name: 'Soft box', font: 'Sans', color: '#FFFFFF', bg: '#000000' },
  { name: 'Sticker', font: 'Sans Bold', color: '#111111', bg: '#FFFFFF' },
  { name: 'Pop', font: 'Sans Bold', color: '#FFE14D', bg: null },
  { name: 'Neon', font: 'Sans Bold', color: '#38E8FF', bg: null },
  { name: 'Hot', font: 'Narrow Bold', color: '#FF4D4D', bg: null },
  { name: 'Elegant', font: 'Serif', color: '#FFFFFF', bg: null },
  { name: 'Story', font: 'Serif Bold', color: '#FFF3D6', bg: '#2B2118' },
  { name: 'Typewriter', font: 'Mono Bold', color: '#FFFFFF', bg: '#000000' },
  { name: 'Slim', font: 'Narrow', color: '#FFFFFF', bg: null },
  { name: 'Mint', font: 'Sans Bold', color: '#0B3D2E', bg: '#8CF2C4' },
]
// An image or video the person lays over their video. x and y are the centre as a share of the frame,
// size is its width as a share of the frame, start and end are seconds on the timeline (end null = to the end).
type OverlayItem = { id: string; file: File; kind: 'image' | 'video'; isLogo?: boolean; url: string; x: number; y: number; size: number; start: number; end: number | null; ar: number; cl: number; cr: number; ct: number; cb: number }
// Everything one video holds in the editor, so several filmed videos can each have their own tab
type EditorSnap = {
  slots: number[]; files: Record<number, File>; paths: Record<number, string>; trims: Record<number, ClipTrimRange>; speeds: Record<number, number>; vols: Record<number, number>; muted?: Record<number, boolean>; screenTexts?: Record<number, string>; crops?: Record<number, ClipCrop>; places?: Record<number, ClipPlace>
  looks: Record<number, AppearanceSettings>; texts: Record<number, string[]>; ownTexts: Record<number, string>; speech: Set<number>; landscape: Set<number>
  caps: CustomCaption[]; overlays: OverlayItem[]; takes: VoiceTake[]; assets: Record<string, string>
  musicFile: File | null; libMusicUrl: string | null; libMusicName: string | null; extracted: string | null; musicStart?: number
  badge: boolean; autoCaptions: boolean; preset: string; script: { id: string; label: string; lines: string[] } | null
  renderId: string | null; renderStatus: string | null; renderProgress: number; outputUrl: string | null; overQuota: boolean; renderError: string | null; uploadError: string
  ctx: { ideaId: string | null; source: string; title: string | null; caption: string | null; tags: string | null } | null
  orientation: 'portrait' | 'landscape' | null
}
// The 'appearance' look: skin smoothing and low light lift (0 to 100 each) and a colour look. It is applied to every clip.
type AppearanceSettings = { touchUp: number; light: number; look: 'none' | 'warm' | 'cool' | 'vivid' | 'soft' | 'bw' }
const APPEARANCE_LOOKS: [AppearanceSettings['look'], string][] = [['none', 'None'], ['warm', 'Warm'], ['cool', 'Cool'], ['vivid', 'Vivid'], ['soft', 'Soft'], ['bw', 'Black and white']]
// What the preview shows. The finished video uses ffmpeg versions of the same looks; the smoothing here is only an approximation.
function appearanceCss(a?: AppearanceSettings): string | undefined {
  if (!a) return undefined
  const parts: string[] = []
  const looks: Record<string, string> = {
    warm: 'sepia(0.18) saturate(1.1) hue-rotate(-8deg)',
    cool: 'hue-rotate(12deg) saturate(1.05)',
    vivid: 'saturate(1.35) contrast(1.08)',
    soft: 'contrast(0.92) saturate(0.92) brightness(1.02)',
    bw: 'grayscale(1) contrast(1.1)',
  }
  if (a.look !== 'none' && looks[a.look]) parts.push(looks[a.look])
  if (a.light > 0) parts.push(`brightness(${(1 + 0.18 * (a.light / 100)).toFixed(3)}) contrast(${(1 + 0.06 * (a.light / 100)).toFixed(3)})`)
  if (a.touchUp > 0) parts.push(`blur(${(0.9 * (a.touchUp / 100)).toFixed(2)}px)`)
  return parts.length ? parts.join(' ') : undefined
}

type PreviewCaptionStyle = { color: string; border: string; background: string | null; bold?: boolean; italic?: boolean; underline?: boolean; size: number; onScreen: { x: number; y: number }; speech: { x: number; y: number } }

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
// Clip speeds: slow-mo below 1x, timelapse above it
// How fast scripts scroll at 1x, in words a second. 1x is a slow, walking pace (people talking on camera usually
// manage about 2.3 a second, which is the 2x setting's top end). Every teleprompter runs from 0.25x to 2x.
const SCRIPT_WORDS_PER_SEC = 1.3
// The voiceover teleprompter's 1x: what used to be 1.5x, a relaxed talking pace
const VOICE_WORDS_PER_SEC = SCRIPT_WORDS_PER_SEC * 1.5
const SCRIPT_SPEED_MIN = 0.25
const SCRIPT_SPEED_MAX = 2
const clampScriptSpeed = (v: number) => Math.min(SCRIPT_SPEED_MAX, Math.max(SCRIPT_SPEED_MIN, v))
const CLIP_SHADES = ['rgba(70,110,160,0.6)', 'rgba(70,140,140,0.6)', 'rgba(110,100,170,0.6)', 'rgba(150,120,80,0.6)']
const clipShade = (i: number) => CLIP_SHADES[i % CLIP_SHADES.length]

const newTakeId = () => Math.random().toString(36).slice(2, 9)

// iPhones only draw a video's picture once it has been moved to a time, and moving to 0 when it is already at 0
// does nothing, so a fresh clip stayed black. Every jump goes at least this far in, which draws the first frame.
const FIRST_FRAME = 0.001
const previewDurations = new Map<string, number>()
// Each clip's picture size, for drawing a crop in the preview
const previewDims = new Map<string, { w: number; h: number }>()
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
// Actions: every full stop ends a scene, so two sentences on one line are two scenes
const splitActionLines = (s: string) => splitScriptLines(s).flatMap((l) => l.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((x) => x.trim()).filter(Boolean))
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

function VolumeRow({ label, hint, value, onChange, color, muted, onMute }: { label: string; hint?: string; value: number; onChange: (v: number) => void; color: string; muted?: boolean; onMute?: (m: boolean) => void }) {
  const row = (
    <label onPointerDownCapture={holdCardDrag} onDragStart={(e) => { e.preventDefault(); e.stopPropagation() }} style={{ display: 'grid', gridTemplateColumns: onMute ? 'minmax(44px, 150px) minmax(48px, 1fr) 44px' : 'minmax(96px, 150px) 1fr 44px', alignItems: 'center', columnGap: onMute ? 8 : 10, flex: 1, minWidth: 0, opacity: muted ? 0.45 : 1 }}>
      <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.25 }}>
        {label}
        {hint && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
      </span>
      <input type="range" min={0} max={100} step={5} value={muted ? 0 : value} aria-label={`${label} volume`}
        onChange={(e) => {
          const v = Number(e.target.value)
          // Down to 0% is the same as muting, and moving it up again unmutes
          if (onMute) {
            if (v <= 0) { if (!muted) onMute(true); return }
            if (muted) onMute(false)
          }
          onChange(v)
        }}
        style={{ width: '100%', minWidth: 0, accentColor: color, cursor: 'pointer' }} />
      <span style={{ fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: value === 0 || muted ? 'var(--text-muted)' : 'var(--ink)' }}>{muted || value === 0 ? 'Muted' : `${value}%`}</span>
    </label>
  )
  if (!onMute) return row
  // A clip's own mute: keeps the volume it was set to, ready for when it is unmuted
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {row}
      <button type="button" aria-pressed={!!muted} aria-label={muted ? `Unmute ${label.toLowerCase()}` : `Mute ${label.toLowerCase()}`} title={muted ? 'Unmute this clip' : 'Mute this clip'}
        onPointerDownCapture={holdCardDrag} onClick={() => { if (muted && value <= 0) onChange(100); onMute(!muted) }}
        style={{ flexShrink: 0, width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: muted ? '1px solid var(--coral)' : '1px solid var(--line)', background: muted ? 'rgba(255,106,77,0.12)' : 'var(--card-bg)', color: muted ? 'var(--coral)' : 'var(--ink)', cursor: 'pointer', padding: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5 6 9H2v6h4l5 4V5z" />
          {muted ? <path d="m23 9-6 6M17 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
        </svg>
      </button>
    </div>
  )
}

// Audio section: the original sound of the clips, then voiceover, then music, each with its own
// volume. Recording itself happens under the preview so it can start wherever the preview was paused.
function AudioPanel({ takes, onAddFile, onRemoveTake, onTakeVolume, statuses, onRetry, originalVol, onOriginalVol, hasMusic, musicVol, onMusicVol, scriptLabel, noScriptFor, scriptSpeed, onScriptSpeed, scriptOpen, onToggleScript, onPickLibraryAudio, musicPicker, section }: {
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
  noScriptFor?: string
  scriptSpeed: number
  onScriptSpeed: (v: number) => void
  scriptOpen: boolean
  onToggleScript: () => void
  onPickLibraryAudio: () => void
  section?: 'voiceover' | 'rest'
  musicPicker: React.ReactNode
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  // Moves smoothly while dragging; the page only updates when you let go
  const [speedDraft, setSpeedDraft] = useState(scriptSpeed)
  const speedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The script speed is applied a moment after the slider stops, and also when the finger or mouse lets go (touch screens can cancel the release)
  const commitSpeed = (v: number) => { if (speedTimer.current) clearTimeout(speedTimer.current); speedTimer.current = null; onScriptSpeed(v) }
  const slideSpeed = (v: number) => { setSpeedDraft(v); if (speedTimer.current) clearTimeout(speedTimer.current); speedTimer.current = setTimeout(() => commitSpeed(v), 250) }
  const card = { border: '1px solid var(--line)', borderRadius: 4, padding: 14, background: 'rgba(128,128,128,0.06)' } as const
  const heading = (title: string, hint: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>{title}</p>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>
    </div>
  )
  const divider = { borderTop: '1px solid var(--line)', paddingTop: 18 } as const
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* 1. Original audio */}
      {section !== 'voiceover' && <div>
        {heading('Master audio', 'The sound recorded in your clips.')}
        <VolumeRow label="Master volume" value={originalVol} onChange={onOriginalVol} color="var(--coral)" />
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
          {takes.length > 0 ? 'Turned down under your voiceover. ' : 'Drag to Off to mute all your clips. '}Each clip also has its own volume, under it in your clips list.
        </p>
      </div>}

      {/* 2. Voiceover */}
      {section !== 'rest' && <div style={section === 'voiceover' ? undefined : divider}>
        {section !== 'voiceover' && heading('Voiceover', 'Talk over your clips.')}
        <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onAddFile(f); e.target.value = '' }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {scriptLabel && (
            <button type="button" aria-pressed={scriptOpen} style={{ ...choiceBtn(scriptOpen), whiteSpace: 'nowrap' }} onClick={onToggleScript}>
              {scriptOpen ? 'Hide script' : 'Show script'}
            </button>
          )}
          <button type="button" style={{ ...choiceBtn(), whiteSpace: 'nowrap' }} onClick={() => fileRef.current?.click()}>Upload a recording</button>
          <button type="button" style={{ ...choiceBtn(), whiteSpace: 'nowrap' }} onClick={onPickLibraryAudio}>Pick audio from library</button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
          {scriptLabel
            ? <>Show script puts your script, <strong style={{ color: 'var(--ink)' }}>{scriptLabel}</strong>, on the preview to read from. Hide it to see the whole video. To record, drag the line on the timeline to where you want to start, then press Record voiceover under the preview. You get a 2 second countdown. Recordings you upload are saved to your library.</>
            : noScriptFor
              ? <>There is no script for <strong style={{ color: 'var(--ink)' }}>{noScriptFor}</strong>. Add one in the Film tab or the script writer to read it on the preview. To record, drag the line on the timeline to where you want to start, then press Record voiceover under the preview. Recordings you upload are saved to your library.</>
              : 'To record, drag the line on the timeline to where you want it to start, then press Record voiceover under the preview. You get a 2 second countdown. Recordings you upload are saved to your library.'}
        </p>

        {scriptLabel && (
          <label style={{ display: 'grid', gridTemplateColumns: 'auto minmax(100px, 220px) 44px', alignItems: 'center', gap: 12, marginTop: 14, fontSize: 12, color: 'var(--ink)' }}>
            <span>Script speed <span style={{ color: 'var(--text-muted)' }}>(1x is a relaxed talking pace)</span></span>
            <input type="range" min={SCRIPT_SPEED_MIN} max={SCRIPT_SPEED_MAX} step={0.25} value={speedDraft} aria-label="Script scroll speed" style={{ width: '100%', minWidth: 0, accentColor: 'var(--coral)' }}
              onChange={(e) => slideSpeed(Number(e.target.value))}
              onPointerUp={() => commitSpeed(speedDraft)} onPointerCancel={() => commitSpeed(speedDraft)} onTouchEnd={() => commitSpeed(speedDraft)} onKeyUp={() => commitSpeed(speedDraft)} onBlur={() => commitSpeed(speedDraft)} />
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', textAlign: 'right' }}>{speedDraft}x</span>
          </label>
        )}

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
                    style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>Remove</button>
                </div>
                <div style={{ marginTop: 10 }}>
                  <VolumeRow label="Volume" value={t.volume} onChange={(v) => onTakeVolume(t.id, v)} color={takeColor(i)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* 3. Music */}
      {section !== 'voiceover' && <div style={divider}>
        {musicPicker}
        {hasMusic && (
          <div style={{ marginTop: 12 }}>
            <VolumeRow label="Music volume" value={musicVol} onChange={onMusicVol} color="#3A9D6E" />
          </div>
        )}
      </div>}
    </div>
  )
}

// iPhones and iPads ignore the volume a page sets on video and audio (it always plays at full volume). There the
// preview's sound goes through a volume control of our own instead. Everywhere else the normal volume works.
let mediaVolumeWorksCache: boolean | null = null
const mediaVolumeWorks = () => {
  if (mediaVolumeWorksCache !== null) return mediaVolumeWorksCache
  try { const a = document.createElement('audio'); a.volume = 0.5; mediaVolumeWorksCache = Math.abs(a.volume - 0.5) < 0.01 } catch { mediaVolumeWorksCache = true }
  return mediaVolumeWorksCache
}
type PreviewAudio = { ctx: AudioContext | null; gains: WeakMap<HTMLMediaElement, GainNode> }
const setMediaLevel = (st: PreviewAudio, el: HTMLMediaElement | null | undefined, level: number) => {
  if (!el) return
  const lv = Math.min(1, Math.max(0, level))
  // Off means off: the browser's own mute, which every phone obeys, not just a volume of zero
  if (lv <= 0) { if (!el.muted) el.muted = true; return }
  if (mediaVolumeWorks()) { if (Math.abs(el.volume - lv) > 0.001) el.volume = lv; return }
  let g = st.gains.get(el)
  if (!g) {
    // Only our own files can go through the volume control (anything from another site would go silent),
    // so a sound from elsewhere can only be switched on or off
    const src = el.currentSrc || el.src || ''
    if (!src.startsWith('blob:')) { el.muted = lv === 0; return }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      if (!st.ctx) {
        st.ctx = new Ctx()
        // Keep playing with the ring/silent switch on, like a normal video does
        const nav = navigator as Navigator & { audioSession?: { type: string } }
        if (nav.audioSession) { try { nav.audioSession.type = 'playback' } catch {} }
      }
      const node = st.ctx.createMediaElementSource(el)
      g = st.ctx.createGain()
      node.connect(g).connect(st.ctx.destination)
      st.gains.set(el, g)
    } catch { return }
  }
  if (Math.abs(g.gain.value - lv) > 0.001) g.gain.value = lv
}

type ScreenTextBox = { texts: string[]; x: number; y: number; onMove: (x: number, y: number) => void; onEdit: (clip: number, text: string) => void; onRemove: () => void }

// Plays the user's clips back to back (respecting trims), shows a timeline with the voiceover
// parts, and records new voiceover starting wherever the preview was paused.
function EditorPreviewInner({ mobile, panelOpen, onClipIndex, screenText, clipOps, cropRequest, addSources, tlOps, segments, takes, originalVol, musicUrl, musicVol, scriptLines, captionStyle, onAddTake, onRemoveTake, onMoveTake, onReorderClip, onDropFiles, captions, onCaptions, onTrimClip, onSpeedClip, overlays, selOverlay, onSelOverlay, onOverlayPatch, appearance, showScript, scriptSpeed = 1, selCap, onSelCap, onPlayhead, autoCap, onAutoCapMove, onAutoCapRemove, onAutoCapSize, autoCapFont, clipMenu, onPickLibrary, badge, onBadge }: {
  // Phone layout: the video fills the space it is given, and clip settings live in the Edit clip panel instead
  mobile?: boolean
  // A tool panel is open on the phone, so the timeline makes way for it
  panelOpen?: boolean
  // Tells the editor which clip is under the line, for the Edit clip panel
  onClipIndex?: (i: number) => void
  // The on-screen text box: one text per clip, where it sits, and what happens when it is moved, typed in or removed
  screenText?: ScreenTextBox | null
  clipOps?: ClipOps
  // Asks the preview to start cropping a clip (from the phone's Edit clip panel); n changes on every ask
  cropRequest?: { clip: number; n: number } | null
  addSources?: AddSources
  tlOps?: TimelineOps
  // The "Made with Reelezy" badge: shown in the corner while on, with an x to take it off
  badge?: boolean
  onBadge?: (on: boolean) => void
  autoCapFont?: string
  segments: VoiceoverSegment[]
  takes: VoiceTake[]
  originalVol: number
  musicUrl: string | null
  musicVol: number
  scriptLines: string[]
  showScript?: boolean
  scriptSpeed?: number
  selCap?: string | null
  onSelCap?: (id: string | null) => void
  onPlayhead?: (t: number, total: number) => void
  autoCap?: { x: number; y: number } | null
  onAutoCapMove?: (x: number, y: number) => void
  onAutoCapRemove?: () => void
  onAutoCapSize?: (size: number) => void
  // The extra settings for the clip being looked at, shown under the three dots next to its speed
  clipMenu?: (index: number) => React.ReactNode
  onPickLibrary?: () => void
  onAddTake: (blob: Blob, start: number, duration: number) => void
  onRemoveTake: (id: string) => void
  onMoveTake: (id: string, start: number) => void
  captionStyle?: PreviewCaptionStyle
  onReorderClip?: (from: number, to: number) => void
  onDropFiles?: (files: File[]) => void
  captions?: CustomCaption[]
  onCaptions?: (c: CustomCaption[]) => void
  onTrimClip?: (index: number, start: number, end: number, total: number) => void
  onSpeedClip?: (index: number, speed: number) => void
  overlays?: OverlayItem[]
  selOverlay?: string | null
  onSelOverlay?: (id: string | null) => void
  onOverlayPatch?: (id: string, patch: Partial<OverlayItem>) => void
  appearance?: AppearanceSettings
}) {
  const [durations, setDurations] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    segments.forEach((s) => { const d = previewDurations.get(previewFileKey(s.file)); if (d) init[previewFileKey(s.file)] = d })
    return init
  })
  const [dims, setDims] = useState<Record<string, { w: number; h: number }>>(() => {
    const init: Record<string, { w: number; h: number }> = {}
    segments.forEach((s) => { const d = previewDims.get(previewFileKey(s.file)); if (d) init[previewFileKey(s.file)] = d })
    return init
  })
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [localTime, setLocalTime] = useState(0)
  const [recording, setRecording] = useState(false)
  const [recFrom, setRecFrom] = useState(0)
  const [micError, setMicError] = useState('')
  // 1x is a slow walking pace (SCRIPT_WORDS_PER_SEC); the script scrolls at this many times that pace
  const ovDragRef = useRef<string | null>(null)
  const ovVideosRef = useRef<Record<string, HTMLVideoElement | null>>({})
  // Resizing an overlay: the corner or edge being dragged moves, the opposite one stays put. Cropping is its own mode.
  type OvHandle = 'tl' | 'tr' | 'bl' | 'br' | 'l' | 'r' | 't' | 'b'
  const ovResizeRef = useRef<{ id: string; mode: OvHandle; size: number; w: number; h: number; ax: number; ay: number; dist: number; bx: number; by: number; bw: number; bh: number } | null>(null)
  const [ovCrop, setOvCrop] = useState<string | null>(null)
  // Two players take turns: while one plays a clip, the next clip loads in the other, so moving between clips never flashes black
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const vidA = useRef<HTMLVideoElement | null>(null)
  const vidB = useRef<HTMLVideoElement | null>(null)
  const slotRef = useRef<0 | 1>(0)
  const [slot, setSlot] = useState<0 | 1>(0)
  const loadSeqRef = useRef(0)
  const volRef = useRef(1)
  const playerOf = (n: 0 | 1) => (n === 0 ? vidA.current : vidB.current)
  const prime = (v: HTMLVideoElement | null) => primeVideo(v, () => !!latest.current.playing && videoRef.current === v, () => videoRef.current === v && volRef.current > 0 && !latest.current.recording)
  const audioEls = useRef<Record<string, HTMLAudioElement | null>>({})
  const trackRef = useRef<HTMLDivElement | null>(null)
  const scriptBoxRef = useRef<HTMLDivElement | null>(null)
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
  const [holdF, setHoldF] = useState<number | null>(null)
  // After a recording the script stays up where it stopped, so it can be scrolled to where the next take starts.
  // It goes away when the video is played.
  const [holdScript, setHoldScript] = useState(false)
  const scriptFRef = useRef(0)
  // The teleprompter keeps its own steady clock while recording, so it glides through the whole script without
  // pausing when one clip hands over to the next or the video stops to load
  const [promptClock, setPromptClock] = useState<{ start: number; now: number } | null>(null)
  // The on-screen text box: a press that does not move opens it for typing, a press that moves drags it
  const textPressRef = useRef<{ sx: number; sy: number; dx: number; dy: number; moved: boolean } | null>(null)
  // The little pop-up over a clip tapped on the timeline, with an arrow pointing at the clip
  const [actionClip, setActionClip] = useState<number | null>(null)
  const [delConfirm, setDelConfirm] = useState(false)
  const [popView, setPopView] = useState<'menu' | 'speed' | 'audio'>('menu')
  const [popPos, setPopPos] = useState<{ left: number; top: number; arrow: number; below: boolean } | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  // The + on the video or audio line, and where its choices pop up
  const [addMenu, setAddMenu] = useState<{ kind: 'video' | 'audio'; left: number; top: number; arrow: number; below: boolean } | null>(null)
  const addMenuRef = useRef<HTMLDivElement | null>(null)
  const addPhotoRef = useRef<HTMLInputElement | null>(null)
  const addFileRef = useRef<HTMLInputElement | null>(null)
  // The clip being cropped on the crop page
  const [cropEdit, setCropEdit] = useState<{ clip: number } | null>(null)
  // Moving and zooming a clip right on the preview: drag it, pinch it (or ctrl + scroll on a computer)
  const [placeDraft, setPlaceDraft] = useState<{ clip: number; place: ClipPlace } | null>(null)
  const placeGesture = useRef<{ idx: number; p0: ClipPlace; last: ClipPlace; pts: Map<number, { x: number; y: number }>; start: Map<number, { x: number; y: number }>; d0: number; moved: boolean } | null>(null)
  // The pop-up for a voiceover, the music, an overlay or a caption tapped on the timeline
  const [elPop, setElPop] = useState<{ kind: 'take' | 'music' | 'overlay' | 'caption'; id: string } | null>(null)
  const [elPos, setElPos] = useState<{ left: number; top: number; arrow: number; below: boolean } | null>(null)
  const [elConfirm, setElConfirm] = useState(false)
  const elRef = useRef<HTMLDivElement | null>(null)
  const elTapRef = useRef<{ x: number; y: number } | null>(null)
  // The music line can be dragged along the timeline like a voiceover
  const [musicDur, setMusicDur] = useState(0)
  const musicDragRef = useRef<{ sx: number; s0: number; moved: boolean } | null>(null)
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const [textEdit, setTextEdit] = useState<{ clip: number; draft: string } | null>(null)
  const capDragRef = useRef<{ id: string; mode: 'move' | 'l' | 'r'; startX: number; start: number; end: number } | null>(null)
  const capPosRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const grabRef = useRef({ dx: 0, dy: 0 })
  const frac = (e: { clientX: number; clientY: number }) => { const r = stageRef.current?.getBoundingClientRect(); return r && r.width > 0 ? { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } : { x: 0.5, y: 0.5 } }
  const trimDragRef = useRef<{ i: number; side: 'l' | 'r'; startX: number; scale: number; start: number; end: number; dur: number } | null>(null)
  // While a clip end is being dragged, that clip is shown at its full length with the cut parts faded, so there is
  // always room to drag an end back out. dispTotal is the length of the timeline drawn that way.
  const [trimView, setTrimView] = useState<{ i: number; side: 'l' | 'r'; start: number; end: number; dur: number; sp: number; before: number; dispTotal: number } | null>(null)
  // Playback bookkeeping that must not wait for a re-render (this is what kept the voiceover from glitching)
  const indexRef = useRef(0)
  const switchingRef = useRef(false)
  const advancingRef = useRef(false)
  const lastSyncRef = useRef<Record<string, number>>({})
  // Our own volume control, used where the browser ignores the normal one (see setMediaLevel)
  const audioRef = useRef<PreviewAudio>({ ctx: null, gains: new WeakMap() })
  const setLevel = (el: HTMLMediaElement | null | undefined, level: number) => setMediaLevel(audioRef.current, el, level)
  // The volume control only makes sound once a tap has woken it, so every tap wakes it
  useEffect(() => {
    const wake = () => { const c = audioRef.current.ctx; if (c && c.state !== 'running') void c.resume().catch(() => {}) }
    document.addEventListener('pointerdown', wake, true)
    document.addEventListener('touchend', wake, true)
    // The control is left running when the preview goes: a video wired to it can never be wired to another one
    return () => { document.removeEventListener('pointerdown', wake, true); document.removeEventListener('touchend', wake, true) }
  }, [])

  // Read each clip's length once so the timeline knows the total
  useEffect(() => {
    segments.forEach((s) => {
      const k = previewFileKey(s.file)
      if (previewDurations.has(k) && previewDims.has(k)) return
      const probe = document.createElement('video')
      probe.preload = 'metadata'
      probe.muted = true
      probe.onloadedmetadata = () => {
        whenDurationKnown(probe, (d) => {
          previewDurations.set(k, d)
          setDurations((prev) => ({ ...prev, [k]: d }))
        })
        if (probe.videoWidth > 0 && probe.videoHeight > 0) {
          previewDims.set(k, { w: probe.videoWidth, h: probe.videoHeight })
          setDims((prev) => ({ ...prev, [k]: { w: probe.videoWidth, h: probe.videoHeight } }))
        }
      }
      probe.src = previewUrlFor(s.file)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  const lengths = segments.map((s) => {
    const d = durations[previewFileKey(s.file)] || 0
    const end = s.end != null ? Math.min(s.end, d || s.end) : d
    return Math.max(0, end - s.start) / (s.speed && s.speed > 0 ? s.speed : 1)
  })
  const total = lengths.reduce((a, b) => a + b, 0)
  const before = lengths.slice(0, index).reduce((a, b) => a + b, 0)
  const globalTime = Math.min(total, before + localTime)

  // Gets the other player ready on the next clip so it can take over straight away
  const preloadNext = (i: number) => {
    const next = segments[i + 1]
    const cur = playerOf(slotRef.current)
    const other = playerOf(slotRef.current === 0 ? 1 : 0)
    if (!next || !cur || !other) return
    const src = previewUrlFor(next.file)
    if (cur.getAttribute('data-src') === src) return
    other.muted = true
    if (!other.paused) other.pause()
    if (other.getAttribute('data-src') === src && other.readyState >= 1) {
      try { if (Math.abs(other.currentTime - next.start) > 0.05) other.currentTime = Math.max(FIRST_FRAME, next.start) } catch {}
      return
    }
    other.setAttribute('data-src', src)
    other.onloadedmetadata = () => { other.onloadedmetadata = null; try { other.currentTime = Math.max(FIRST_FRAME, next.start) } catch {}; if (!latest.current.playing) prime(other) }
    other.src = src
    other.preload = 'auto'
  }

  const load = (i: number, offset: number, autoplay: boolean) => {
    const cur = playerOf(slotRef.current)
    const seg = segments[i]
    if (!cur || !seg) return
    indexRef.current = i
    setIndex(i)
    const src = previewUrlFor(seg.file)
    const sp = seg.speed || 1
    const target = Math.max(FIRST_FRAME, seg.start + offset * sp)
    const seq = ++loadSeqRef.current
    if (cur.getAttribute('data-src') === src) {
      // Same file: just move within it. Also make sure this player is the one on top: a quick drag back and forth
      // can cancel the earlier swap before it is shown, which left a frozen picture over the playing one.
      setSlot(slotRef.current)
      cur.style.zIndex = '1'
      const under = playerOf(slotRef.current === 0 ? 1 : 0)
      if (under) { under.style.zIndex = '0'; if (!under.paused) under.pause(); under.muted = true }
      cur.playbackRate = sp
      try { if (Math.abs(cur.currentTime - target) > 0.04) cur.currentTime = target } catch {}
      if (!autoplay) prime(cur)
      setLocalTime(offset)
      switchingRef.current = false
      advancingRef.current = false
      // Set the sound as part of the Play press itself
      if (autoplay) { cur.muted = volRef.current <= 0; void cur.play().catch(() => {}) }
      preloadNext(i)
      return
    }
    const nextSlot: 0 | 1 = slotRef.current === 0 ? 1 : 0
    const nv = playerOf(nextSlot)
    if (!nv) return
    switchingRef.current = true
    // Hold the last frame of the old clip (instead of going black) until the new one is ready
    if (!cur.paused) cur.pause()
    let shown = false
    const show = () => {
      if (shown || seq !== loadSeqRef.current) return
      shown = true
      cur.pause()
      cur.muted = true
      nv.muted = volRef.current <= 0
      setLevel(nv, volRef.current)
      nv.playbackRate = sp
      slotRef.current = nextSlot
      videoRef.current = nv
      setLocalTime(offset)
      switchingRef.current = false
      advancingRef.current = false
      if (autoplay) void nv.play().catch(() => {})
      // Only swap which player is on top once the new one has a picture to show, so there is never a black flash
      let revealed = false
      const reveal = () => { if (revealed || seq !== loadSeqRef.current) return; revealed = true; setSlot(nextSlot); window.setTimeout(() => { if (seq === loadSeqRef.current) preloadNext(i) }, 50) }
      const rvfc = (nv as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback
      if (rvfc) rvfc.call(nv, reveal)
      else if (nv.readyState >= 2) reveal()
      else nv.addEventListener('loadeddata', reveal, { once: true })
      window.setTimeout(reveal, 300)
    }
    const seekThenShow = () => {
      nv.playbackRate = sp
      if (nv.readyState >= 2 && Math.abs(nv.currentTime - target) < 0.04) { show(); return }
      const onSeeked = () => { nv.removeEventListener('seeked', onSeeked); show() }
      nv.addEventListener('seeked', onSeeked)
      try { nv.currentTime = target } catch { show() }
    }
    if (nv.getAttribute('data-src') === src && nv.readyState >= 1) seekThenShow()
    else {
      nv.setAttribute('data-src', src)
      nv.onloadedmetadata = () => { nv.onloadedmetadata = null; if (!autoplay) prime(nv); seekThenShow() }
      nv.src = src
    }
    // Never get stuck if the browser does not report the seek
    window.setTimeout(show, 2500)
  }

  // Show the first frame straight away, and get the second clip ready in the other player
  useEffect(() => {
    const v = vidA.current
    const first = segments[0]
    if (!v || !first) return
    videoRef.current = v
    const src = previewUrlFor(first.file)
    v.setAttribute('data-src', src)
    v.src = src
    v.onloadedmetadata = () => { v.onloadedmetadata = null; v.currentTime = Math.max(FIRST_FRAME, first.start); prime(v); preloadNext(0) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    setHoldF(scriptFRef.current)
    setHoldScript(true)
    setPromptClock(null)
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
  const musicStart = tlOps?.musicStart ?? 0
  const latest = useRef({ segments, lengths, index, takes, recording, playing, before, advance, musicVol, musicStart })
  useEffect(() => { latest.current = { segments, lengths, index, takes, recording, playing, before, advance, musicVol, musicStart } })

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
        const sp = seg.speed || 1
        if (v.playbackRate !== sp) v.playbackRate = sp
        setLocalTime(Math.max(0, v.currentTime - seg.start) / sp)
        if (seg.end != null && v.currentTime >= seg.end - 0.03) {
          L.advance()
          raf = requestAnimationFrame(tick)
          return
        }
        const g = L.lengths.slice(0, idx).reduce((a, b) => a + b, 0) + Math.max(0, v.currentTime - seg.start) / sp
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
          setLevel(el, level)
          const hidden = L.takes.slice(i + 1).some((o) => g >= o.start && g < (o.duration > 0 ? o.start + o.duration : Infinity))
          if (el.muted !== hidden) el.muted = hidden
          if (L.recording || g < t.start || g >= end) { if (!el.paused) el.pause(); return }
          sync(el, t.id, g - t.start)
        })
        // Music is the third layer: it plays from the start of the video, under everything else
        const mus = audioEls.current['music']
        if (mus) {
          const level = Math.min(1, Math.max(0, L.musicVol / 100))
          if (level > 0 && mus.muted) mus.muted = false
          setLevel(mus, level)
          // It starts where it was dragged to on the timeline, and stops when the song runs out
          const want = g - L.musicStart
          const md = mus.duration
          if (L.recording || want < 0 || (Number.isFinite(md) && md > 0 && want >= md)) { if (!mus.paused) mus.pause() }
          else sync(mus, 'music', want)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const vol = recording ? 0 : (originalVol / 100) * ((segments[index]?.volume ?? 100) / 100)
  useEffect(() => {
    volRef.current = vol
    const v = videoRef.current
    if (v) { v.muted = vol <= 0; setLevel(v, vol) }
    const other = playerOf(slotRef.current === 0 ? 1 : 0)
    if (other) other.muted = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vol, index, slot])

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
    // Always play from where the line is on the timeline
    seekGlobal(total > 0 && globalTime >= total - 0.1 ? 0 : globalTime, true)
    setPlaying(true)
    setHoldScript(false)
  }

  const startRecording = async () => {
    setMicError('')
    if (segments.length === 0 || recording || countdown !== null) return
    // The voiceover goes exactly where the line is now, so stop the preview moving while the countdown runs
    const lineAt = total > 0 && globalTime >= total - 0.2 ? 0 : globalTime
    if (playing) { videoRef.current?.pause(); pauseTakes(); setPlaying(false) }
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
      // Recording starts where the line was when Record was pressed (or at the start if it was at the very end)
      const startAt = lineAt
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
      setHoldF(null)
      setRecFrom(startAt)
      setRecording(true)
      setPlaying(true)
      // Start the microphone at the moment the video actually starts moving so they line up
      let began = false
      const begin = () => {
        if (began || rec.state !== 'inactive' || !stream.active) return
        began = true
        recWallRef.current = uploadStamp()
        const t0 = performance.now()
        setPromptClock({ start: t0, now: t0 })
        rec.start()
      }
      ;[vidA.current, vidB.current].forEach((p) => p?.addEventListener('playing', begin, { once: true }))
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

  const scaleTotal = trimView ? trimView.dispTotal : total
  // Where a moment of the video sits on the drawn timeline. Normally that is just the time, but while a clip end is
  // being dragged the cut parts of that clip are drawn too, so everything after them shifts along.
  const dispAt = (t: number) => {
    if (!trimView) return t
    const { before, start, end, sp, dur } = trimView
    const kept = Math.max(0, end - start) / sp
    if (t <= before) return t
    if (t <= before + kept) return before + start / sp + (t - before)
    return t + dur / sp - kept
  }
  const pct = (t: number) => `${scaleTotal > 0 ? Math.min(100, Math.max(0, (dispAt(t) / scaleTotal) * 100)) : 0}%`
  const timeAt = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect()
    if (!r || total <= 0 || r.width <= 0) return 0
    return Math.min(total, Math.max(0, ((clientX - r.left) / r.width) * total))
  }

  // Dragging along the timeline moves the line, and the video with it. A tap does not move it: taps are for
  // opening a clip's or a voiceover's pop-up. Playback pauses while dragging and carries on when let go.
  const scrubRef = useRef<{ wasPlaying: boolean; sx: number; moved: boolean } | null>(null)
  const startScrub = (e: React.PointerEvent) => {
    if (recording || total <= 0) return
    e.stopPropagation()
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    scrubRef.current = { wasPlaying: playing, sx: e.clientX, moved: false }
  }
  const moveScrub = (e: React.PointerEvent) => {
    const sc = scrubRef.current
    if (!sc) return
    if (e.pointerType === 'mouse' && e.buttons === 0) { endScrub(); return }
    if (!sc.moved) {
      if (Math.abs(e.clientX - sc.sx) < 6) return
      sc.moved = true
      if (sc.wasPlaying) { videoRef.current?.pause(); pauseTakes(); setPlaying(false) }
    }
    seekGlobal(timeAt(e.clientX), false)
  }
  const endScrub = (e?: React.PointerEvent) => {
    const sc = scrubRef.current
    scrubRef.current = null
    if (!sc || !sc.moved || !sc.wasPlaying) return
    seekGlobal(e ? timeAt(e.clientX) : globalTime, true)
    setPlaying(true)
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

  // ---- Tapping a clip on the timeline, crop
  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setStageSize({ w: r.width, h: r.height }) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const tapClip = (i: number) => {
    if (!clipOps) return
    setDelConfirm(false)
    setPopView('menu')
    setAddMenu(null)
    setElPop(null)
    setActionClip((cur) => (cur === i ? null : i))
  }
  const closePop = () => { setActionClip(null); setDelConfirm(false); setPopView('menu') }
  const startCrop = (i: number) => {
    const seg = segments[i]
    if (!seg || !clipOps) return
    videoRef.current?.pause(); pauseTakes(); setPlaying(false)
    closePop()
    setCropEdit({ clip: i })
  }
  // Pop-ups sit just above what they point at (or below, if there is no room), kept on the screen
  const placeOver = (r: DOMRect, width: number, height: number, x?: number) => {
    const vw = window.innerWidth
    const cx = x ?? r.left + r.width / 2
    const left = Math.min(vw - width - 8, Math.max(8, cx - width / 2))
    const below = r.top - height - 12 < 8
    return { left, top: below ? r.bottom + 12 : r.top - height - 12, arrow: Math.min(width - 16, Math.max(16, cx - left)), below }
  }
  // Keep the clip pop-up pointing at its clip while the page moves or the clip changes size
  useEffect(() => {
    if (actionClip === null) { setPopPos(null); return }
    const place = () => {
      const el = trackRef.current?.querySelector(`[data-clip-block="${actionClip}"]`) as HTMLElement | null
      const pop = popRef.current
      if (!el) { setPopPos(null); return }
      const r = el.getBoundingClientRect()
      const w = pop?.offsetWidth || 300, h = pop?.offsetHeight || 84
      // Point at the middle of the part of the clip that is on screen
      const vis = Math.max(r.left, 0), vis2 = Math.min(r.right, window.innerWidth)
      setPopPos(placeOver(r, w, h, (vis + vis2) / 2))
    }
    place()
    const raf = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionClip, popView, delConfirm, lengths.join(','), mobile])
  // Close pop-ups when tapping somewhere else, or with Escape
  useEffect(() => {
    if (actionClip === null && !addMenu && !elPop) return
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t) || addMenuRef.current?.contains(t) || elRef.current?.contains(t)) return
      if ((t as HTMLElement).closest?.('[data-clip-block],[data-add-line],[data-tl-el]')) return
      closePop(); setAddMenu(null); setElPop(null)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { closePop(); setAddMenu(null); setElPop(null) } }
    document.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key) }
  }, [actionClip, addMenu, elPop])
  // Keep the timeline pop-up pointing at the thing it is about
  useEffect(() => {
    if (!elPop) { setElPos(null); return }
    const place = () => {
      const el = trackRef.current?.querySelector(`[data-tl-el="${elPop.kind}:${elPop.id}"]`) as HTMLElement | null
      if (!el) { setElPop(null); return }
      const r = el.getBoundingClientRect()
      const vis = Math.max(r.left, 0), vis2 = Math.min(r.right, window.innerWidth)
      setElPos(placeOver(r, elRef.current?.offsetWidth || 280, elRef.current?.offsetHeight || 110, (vis + vis2) / 2))
    }
    place()
    const raf = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elPop, elConfirm, takes.length, (overlays || []).length, (captions || []).length])
  // A press that does not move is a tap: it opens that thing's pop-up. A press that moves still drags it.
  const tapEl = (kind: 'take' | 'music' | 'overlay' | 'caption', id: string) => ({
    'data-tl-el': `${kind}:${id}`,
    onPointerDownCapture: (e: React.PointerEvent) => { elTapRef.current = { x: e.clientX, y: e.clientY } },
    onPointerUpCapture: (e: React.PointerEvent) => {
      const t = elTapRef.current
      elTapRef.current = null
      if (!t || Math.abs(e.clientX - t.x) + Math.abs(e.clientY - t.y) > 6 || recording) return
      closePop(); setAddMenu(null); setElConfirm(false)
      setElPop((cur) => (cur && cur.kind === kind && cur.id === id ? null : { kind, id }))
    },
  })
  // A clip that is removed takes its pop-up with it
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- closing a pop-up whose clip is gone
    if (actionClip !== null && !segments[actionClip]) closePop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.length])
  const openAdd = (kind: 'video' | 'audio', e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    closePop()
    if (addMenu?.kind === kind) { setAddMenu(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    setAddMenu({ kind, ...placeOver(r, 240, kind === 'audio' ? 224 : 168) })
  }
  // The phone's Edit clip panel asks for a crop through cropRequest
  const [seenCropN, setSeenCropN] = useState(cropRequest?.n ?? 0)
  useEffect(() => {
    if (!cropRequest || cropRequest.n === seenCropN) return
    setSeenCropN(cropRequest.n)
    startCrop(cropRequest.clip)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropRequest?.n])
  // Where the clip's whole picture shows on the preview (it is fitted inside without stretching)
  const frameOf = (seg: VoiceoverSegment | undefined) => {
    const d = seg ? dims[previewFileKey(seg.file)] : undefined
    if (!d || stageSize.w <= 0 || stageSize.h <= 0) return null
    const sc = Math.min(stageSize.w / d.w, stageSize.h / d.h)
    return { left: (stageSize.w - d.w * sc) / 2, top: (stageSize.h - d.h * sc) / 2, w: d.w * sc, h: d.h * sc, d }
  }
  // A cropped clip: the kept part is fitted inside the preview the same way the finished video does it
  // A cropped, moved or zoomed clip: drawn exactly as the finished video will have it, with only the kept part
  // showing and black everywhere else
  const cropStyle = (segIdx: number): React.CSSProperties | null => {
    const seg = segments[segIdx]
    const place = placeDraft && placeDraft.clip === segIdx ? placeDraft.place : seg?.place
    const c = seg?.crop ?? (placeIsPlain(place) ? undefined : { x: 0, y: 0, w: 1, h: 1 })
    const d = seg ? dims[previewFileKey(seg.file)] : undefined
    if (!c || !d || stageSize.w <= 0) return null
    const p = place ?? { x: 0, y: 0, s: 1 }
    const cw = c.w * d.w, ch = c.h * d.h
    const sc = Math.min(stageSize.w / cw, stageSize.h / ch) * p.s
    const pc = (n: number) => `${(Math.max(0, n) * 100).toFixed(3)}%`
    return {
      inset: 'auto', left: stageSize.w / 2 + p.x * stageSize.w - (c.x * d.w + cw / 2) * sc, top: stageSize.h / 2 + p.y * stageSize.h - (c.y * d.h + ch / 2) * sc,
      width: d.w * sc, height: d.h * sc, objectFit: 'fill', maxWidth: 'none', background: 'transparent',
      clipPath: `inset(${pc(c.y)} ${pc(1 - c.x - c.w)} ${pc(1 - c.y - c.h)} ${pc(c.x)})`,
    }
  }
  const placeOf = (i: number): ClipPlace => segments[i]?.place ?? { x: 0, y: 0, s: 1 }
  const clampPlace = (p: ClipPlace): ClipPlace => {
    let { x, y, s: z } = p
    x = Math.min(1, Math.max(-1, x)); y = Math.min(1, Math.max(-1, y)); z = Math.min(5, Math.max(0.2, z))
    // Clicks into place at the middle and at the normal size
    if (Math.abs(x) < 0.015) x = 0
    if (Math.abs(y) < 0.015) y = 0
    if (Math.abs(z - 1) < 0.04) z = 1
    return { x, y, s: z }
  }
  const canPlace = !!clipOps?.onPlace && !recording && !cropEdit && segments.length > 0
  const placeDown = (e: React.PointerEvent) => {
    if (!canPlace || e.target !== e.currentTarget) return
    let g = placeGesture.current
    if (!g) { const p0 = placeOf(index); g = { idx: index, p0, last: p0, pts: new Map(), start: new Map(), d0: 0, moved: false }; placeGesture.current = g }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    g.pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    // A new finger starts a fresh step from where the clip is now
    g.p0 = g.last
    g.start = new Map(g.pts)
    if (g.pts.size >= 2) { const [a, b] = Array.from(g.pts.values()); g.d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1 }
  }
  const placeMove = (e: React.PointerEvent) => {
    const g = placeGesture.current
    if (!g || !g.pts.has(e.pointerId) || stageSize.w <= 0) return
    g.pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const cur = Array.from(g.pts.values()), st = Array.from(g.start.values())
    const mid = (l: { x: number; y: number }[]) => ({ x: l.reduce((n, q) => n + q.x, 0) / l.length, y: l.reduce((n, q) => n + q.y, 0) / l.length })
    const m1 = mid(cur), m0 = mid(st)
    if (!g.moved && Math.hypot(m1.x - m0.x, m1.y - m0.y) < 6 && g.pts.size < 2) return
    g.moved = true
    const z = g.pts.size >= 2 && g.d0 > 0 ? g.p0.s * (Math.hypot(cur[0].x - cur[1].x, cur[0].y - cur[1].y) / g.d0) : g.p0.s
    // Kept here as well as on screen: the finger can lift before the screen has caught up
    g.last = clampPlace({ x: g.p0.x + (m1.x - m0.x) / stageSize.w, y: g.p0.y + (m1.y - m0.y) / stageSize.h, s: z })
    setPlaceDraft({ clip: g.idx, place: g.last })
  }
  const placeUp = (e: React.PointerEvent) => {
    const g = placeGesture.current
    if (!g) return
    g.pts.delete(e.pointerId)
    if (g.pts.size > 0) {
      // One finger lifted: carry on with the other from here
      g.p0 = g.last
      g.start = new Map(g.pts)
      return
    }
    placeGesture.current = null
    if (g.moved && clipOps?.onPlace) clipOps.onPlace(g.idx, placeIsPlain(g.last) ? null : g.last)
    setPlaceDraft(null)
  }
  // ctrl + scroll (and pinching on a laptop trackpad) zooms the clip on a computer
  const placeLive = useRef({ canPlace, index, place: placeOf(index), onPlace: clipOps?.onPlace })
  useEffect(() => { placeLive.current = { canPlace, index, place: placeOf(index), onPlace: clipOps?.onPlace } })
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      const L = placeLive.current
      if (!e.ctrlKey || !L.canPlace || !L.onPlace) return
      e.preventDefault()
      const next = clampPlace({ ...L.place, s: L.place.s * Math.exp(-e.deltaY * 0.01) })
      L.onPlace(L.index, placeIsPlain(next) ? null : next)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { onClipIndex?.(index) }, [onClipIndex, index])

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
  const ovTop = musicUrl ? 94 : 64
  const ovCount = overlays?.length ?? 0
  const capTop = ovTop + ovCount * 28
  const trackHeight = caps.length > 0 ? capTop + rowEnds.length * 26 : (musicUrl ? 92 : 62) + ovCount * 28
  // Overlay bars: drag to move, drag the white ends to change when each one starts and stops
  const ovDragTimeRef = useRef<{ id: string; mode: 'move' | 'l' | 'r'; startX: number; start: number; end: number } | null>(null)
  const moveOvTime = (e: React.PointerEvent) => {
    const d = ovDragTimeRef.current
    if (!d || total <= 0 || !onOverlayPatch) return
    const w = trackRef.current?.getBoundingClientRect().width || 1
    const delta = (e.clientX - d.startX) * (total / w)
    let st = d.start, en = d.end
    if (d.mode === 'move') { const len = d.end - d.start; st = Math.min(Math.max(0, total - len), Math.max(0, d.start + delta)); en = st + len }
    else if (d.mode === 'l') st = Math.min(d.end - 0.3, Math.max(0, d.start + delta))
    else en = Math.max(d.start + 0.3, Math.min(total, d.end + delta))
    onOverlayPatch(d.id, { start: st, end: en >= total - 0.05 ? null : en })
  }
  const startOvTime = (e: React.PointerEvent, mode: 'move' | 'l' | 'r', ov: OverlayItem) => {
    if (recording || !onOverlayPatch) return
    e.stopPropagation()
    onSelOverlay?.(ov.id)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    ovDragTimeRef.current = { id: ov.id, mode, startX: e.clientX, start: ov.start, end: ov.end ?? total }
  }
  const updateCap = (id: string, patch: Partial<CustomCaption>) => onCaptions?.(caps.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  // Pinch to resize: two fingers on a caption (touch), or a trackpad pinch over it
  const ptrsRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ id: string; dist: number; size: number } | null>(null)
  // Side handles change only that side of the caption box (the other side stays put). Corner handles make the
  // whole caption bigger or smaller while the opposite corner stays where it is. Nothing else changes the text size.
  type CapHandle = 'l' | 'r' | 'tl' | 'tr' | 'bl' | 'br'
  const resizeRef = useRef<{ id: string; mode: CapHandle; size: number; w: number; left: number; right: number; top: number; bottom: number; ax: number; ay: number; dist: number } | null>(null)
  const startResize = (e: React.PointerEvent, c: CustomCaption, mode: CapHandle) => {
    const box = stageRef.current?.getBoundingClientRect()
    const el = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect()
    if (!box || !el || !captionStyle || box.width <= 0 || box.height <= 0) return
    e.stopPropagation()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    const w = Math.min(1, Math.max(0.1, c.w ?? 0.88))
    const left = c.x - w / 2, right = c.x + w / 2
    const top = (el.top - box.top) / box.height, bottom = (el.bottom - box.top) / box.height
    // The corner that stays still while a corner is dragged
    const ax = mode === 'tl' || mode === 'bl' ? right : left
    const ay = mode === 'tl' || mode === 'tr' ? bottom : top
    const pf = frac(e)
    resizeRef.current = { id: c.id, mode, size: c.size ?? captionStyle.size, w, left, right, top, bottom, ax, ay, dist: Math.max(0.01, Math.hypot((pf.x - ax) * box.width, (pf.y - ay) * box.height)) }
  }
  const moveResize = (e: React.PointerEvent) => {
    const r = resizeRef.current
    const box = stageRef.current?.getBoundingClientRect()
    if (!r || !box) return
    if (mouseUp(e)) { dropAll(); return }
    const pf = frac(e)
    if (r.mode === 'l') {
      const left = Math.min(r.right - 0.1, Math.max(Math.max(0, r.right - 1), pf.x))
      updateCap(r.id, { w: r.right - left, x: (left + r.right) / 2 })
      return
    }
    if (r.mode === 'r') {
      const right = Math.max(r.left + 0.1, Math.min(Math.min(1, r.left + 1), pf.x))
      updateCap(r.id, { w: right - r.left, x: (r.left + right) / 2 })
      return
    }
    const d = Math.hypot((pf.x - r.ax) * box.width, (pf.y - r.ay) * box.height)
    let scale = d / r.dist
    // Keep the text between 16 and 200. The box grows with it but never past the width of the video.
    scale = Math.min(scale, 200 / r.size)
    scale = Math.max(scale, 16 / r.size, 0.1 / r.w)
    const w = Math.min(1, r.w * scale)
    const h = (r.bottom - r.top) * scale
    const x = r.mode === 'tl' || r.mode === 'bl' ? r.ax - w / 2 : r.ax + w / 2
    const y = r.mode === 'tl' || r.mode === 'tr' ? r.ay - h / 2 : r.ay + h / 2
    updateCap(r.id, { size: Math.round(r.size * scale), w, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) })
  }
  const endResize = () => { resizeRef.current = null }
  // A mouse that is not being pressed must never drag or resize anything
  const mouseUp = (e: React.PointerEvent) => e.pointerType === 'mouse' && e.buttons === 0
  const dropAll = () => { capPosRef.current = null; resizeRef.current = null; ovDragRef.current = null; ovResizeRef.current = null; ovCropRef.current = null; pinchRef.current = null; ptrsRef.current.clear() }
  const autoDragRef = useRef(false)
  const [clipMenuOpen, setClipMenuOpen] = useState(false)
  const autoSizeRef = useRef<{ size: number; dist: number; cx: number; cy: number; axis: 'x' | 'y' | 'xy'; h: number; boxTop: number; boxH: number } | null>(null)
  const ovCropRef = useRef<{ id: string; edge: 'l' | 'r' | 't' | 'b'; sx: number; sy: number; x: number; y: number; size: number; cl: number; cr: number; ct: number; cb: number; ar: number; w: number; h: number } | null>(null)
  const latestRef = useRef<{ caps: CustomCaption[]; size: number; update: (id: string, p: Partial<CustomCaption>) => void }>({ caps: [], size: 60, update: () => {} })
  useEffect(() => { latestRef.current = { caps, size: captionStyle?.size ?? 60, update: updateCap } })
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      const id = (e.target as HTMLElement).closest('[data-capid]')?.getAttribute('data-capid')
      const cap = id ? latestRef.current.caps.find((c) => c.id === id) : undefined
      if (!cap) return
      e.preventDefault()
      const next = Math.round((cap.size ?? latestRef.current.size) * Math.exp(-Math.max(-25, Math.min(25, e.deltaY)) * 0.01))
      latestRef.current.update(cap.id, { size: Math.min(200, Math.max(16, next)) })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
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
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
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
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    videoRef.current?.pause()
    pauseTakes()
    setPlaying(false)
    const w = trackRef.current?.getBoundingClientRect().width || 1
    const end0 = seg.end != null ? Math.min(seg.end, dur) : dur
    const sp = seg.speed || 1
    // The timeline is drawn with this whole clip showing, so the finger moves over the clip's full length
    const dispTotal = total - (lengths[i] || 0) + dur / sp
    trimDragRef.current = { i, side, startX: e.clientX, scale: (dispTotal / w) * sp, start: seg.start, end: end0, dur }
    // Show the clip being trimmed in the preview right away
    load(i, 0, false)
    setTrimView({ i, side, start: seg.start, end: end0, dur, sp, before: lengths.slice(0, i).reduce((a, b) => a + b, 0), dispTotal })
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
    setTrimView((prev) => (prev ? { ...prev, start: ns, end: ne } : prev))
    // The preview shows the exact frame under the end being dragged
    const v = videoRef.current
    const seg = segments[d.i]
    if (v && seg && v.getAttribute('data-src') === previewUrlFor(seg.file)) {
      try { v.currentTime = d.side === 'l' ? ns : Math.max(ns, ne - 0.05) } catch {}
    }
  }
  const endTrim = () => {
    const d = trimDragRef.current
    if (!d) return
    trimDragRef.current = null
    setTrimView(null)
    if (d) load(d.i, 0, false)
  }

  // Video overlays play while the preview plays
  useEffect(() => {
    Object.values(ovVideosRef.current).forEach((v) => {
      if (!v) return
      if (playing || recording) { v.play().catch(() => {}) } else { v.pause() }
    })
  }, [playing, recording, overlays])

  // While a voiceover is being recorded the script shows one line at a time, with the next line smaller and faded.
  // 1x moves at a slow walking pace (SCRIPT_WORDS_PER_SEC).
  const scriptStarts = (() => {
    let t = 0
    return scriptLines.map((l) => { const st = t; t += Math.max(1.2, l.split(/\s+/).filter(Boolean).length / VOICE_WORDS_PER_SEC); return st })
  })()
  const spokenSecs = recording && promptClock ? Math.max(0, promptClock.now - promptClock.start) / 1000 * clampScriptSpeed(scriptSpeed) : 0
  let scriptIdx = 0
  scriptStarts.forEach((st, i) => { if (spokenSecs >= st) scriptIdx = i })
  const scriptDur = (i: number) => (scriptStarts[i + 1] ?? scriptStarts[i] + Math.max(1.2, (scriptLines[i] || '').split(/\s+/).filter(Boolean).length / VOICE_WORDS_PER_SEC)) - scriptStarts[i]
  // Where the script has got to. It carries on until the last line has scrolled right past the reading line,
  // then stays there after recording ends.
  const lineF = scriptLines.length === 0 ? 0 : Math.min(scriptLines.length, scriptIdx + Math.min(1, Math.max(0, (spokenSecs - scriptStarts[scriptIdx]) / scriptDur(scriptIdx))))
  // The teleprompter glides at one steady speed: the whole script's height over the whole script's reading time,
  // so long and short lines move at the same pace and it never jerks from one line to the next
  const [promptMetrics, setPromptMetrics] = useState<{ tops: number[]; total: number } | null>(null)
  const scriptSecs = scriptLines.length === 0 ? 0 : scriptStarts[scriptLines.length - 1] + scriptDur(scriptLines.length - 1)
  const promptLiveRef = useRef({ total: 0, secs: 0, speed: 1 })
  const lastYRef = useRef(0)
  // Where the next recording's script starts: where the last one stopped, or where it was scrolled to
  const promptStartRef = useRef(0)
  const [promptStart, setPromptStart] = useState(0)
  useEffect(() => { promptLiveRef.current = { total: promptMetrics?.total ?? 0, secs: scriptSecs, speed: clampScriptSpeed(scriptSpeed) } })
  const promptY = promptMetrics && scriptSecs > 0 ? Math.min(promptMetrics.total, promptStart + (spokenSecs / scriptSecs) * promptMetrics.total) : 0
  const liveF = (() => {
    if (!promptMetrics || promptMetrics.tops.length === 0) return lineF
    const { tops, total } = promptMetrics
    if (promptY >= total) return scriptLines.length
    let i = 0
    while (i + 1 < tops.length && tops[i + 1] <= promptY) i++
    const next = i + 1 < tops.length ? tops[i + 1] : total
    return i + Math.min(1, Math.max(0, (promptY - tops[i]) / Math.max(1, next - tops[i])))
  })()
  useEffect(() => {
    if (!recording || !promptClock) return
    const start = promptClock.start
    const L = promptLiveRef.current
    const el = promptInnerRef.current
    const from = promptStartRef.current
    const yAt = (ts: number) => (L.secs > 0 ? Math.min(L.total, from + (Math.max(0, (ts - start) / 1000) * L.speed / L.secs) * L.total) : from)
    // The whole scroll is one steady animation run by the browser's graphics side, so it keeps gliding even while
    // the page is busy (like the moment one clip hands over to the next). React only follows along for the highlighting.
    if (el && L.secs > 0 && L.total > 0) {
      el.style.transition = 'none'
      el.style.transform = `translate3d(0, ${(-yAt(performance.now())).toFixed(2)}px, 0)`
      void el.offsetHeight
      const left = Math.max(0, ((L.total - yAt(performance.now())) / L.total) * (L.secs / L.speed))
      el.style.transition = `transform ${left.toFixed(3)}s linear`
      el.style.transform = `translate3d(0, ${(-L.total).toFixed(2)}px, 0)`
    }
    let raf = 0
    const step = (ts: number) => {
      lastYRef.current = yAt(ts)
      setPromptClock((c) => (c ? { ...c, now: ts } : c))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      // Stop exactly where it had got to
      const y = yAt(performance.now())
      lastYRef.current = y
      if (el) { el.style.transition = 'none'; el.style.transform = `translate3d(0, ${(-y).toFixed(2)}px, 0)` }
    }
  }, [recording, promptClock !== null]) // eslint-disable-line react-hooks/exhaustive-deps
  const scriptF = recording ? liveF : countdown !== null ? 0 : (holdF ?? 0)
  useEffect(() => { scriptFRef.current = scriptF })
  const prompterRef = useRef<HTMLDivElement | null>(null)
  const lineEls = useRef<(HTMLParagraphElement | null)[]>([])
  // Measures where each line sits, whenever the script or the size of the preview changes
  const promptInnerRef = useRef<HTMLDivElement | null>(null)
  const scriptKey = scriptLines.join('\n')
  useEffect(() => {
    const inner = promptInnerRef.current
    if (!inner || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const els = lineEls.current.slice(0, scriptLines.length).filter(Boolean) as HTMLParagraphElement[]
      if (els.length === 0) return
      const first = els[0].offsetTop
      const tops = els.map((el) => el.offsetTop - first)
      const last = els[els.length - 1]
      setPromptMetrics({ tops, total: last.offsetTop - first + last.offsetHeight + 18 })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [scriptKey, scriptLines.length, showScript, recording, countdown !== null]) // eslint-disable-line react-hooks/exhaustive-deps
  // When recording stops, leave the script where it got to, so it can be scrolled from there
  const live = recording || countdown !== null
  useEffect(() => {
    const box = prompterRef.current
    const inner = promptInnerRef.current
    if (live) {
      // Carry on from where it stopped (or was scrolled to). If it had reached the end, start again from the top.
      const total = promptMetrics?.total ?? 0
      const from = total > 0 && lastYRef.current < total - 30 ? lastYRef.current : 0
      promptStartRef.current = from
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the start point is fixed when recording begins
      setPromptStart(from)
      if (box) box.scrollTop = 0
      if (inner) { inner.style.transition = 'none'; inner.style.transform = `translate3d(0, ${(-from).toFixed(2)}px, 0)` }
      return
    }
    if (inner) { inner.style.transition = ''; inner.style.transform = '' }
    if (box) box.scrollTop = lastYRef.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live])

  return (
    <div className={mobile ? 'ed-pin' : undefined}>
      <div className={mobile ? 'ed-stagebox' : undefined}>
      <div ref={stageRef} onPointerDown={placeDown} onPointerMove={placeMove} onPointerUp={placeUp} onPointerCancel={placeUp}
        title={canPlace ? 'Drag the video to move it. Pinch, or ctrl and scroll, to zoom.' : undefined}
        style={{ width: 'min(100%, calc((100vh - 330px) * 0.5625))', minWidth: 180, aspectRatio: '9 / 16', margin: '0 auto', background: '#000', borderRadius: 4, overflow: 'hidden', position: 'relative', containerType: 'inline-size', touchAction: canPlace ? 'none' : undefined, cursor: canPlace ? (placeDraft ? 'grabbing' : 'grab') : undefined }}>
        {/* Both players are always drawn; the one in use sits on top, so the other has its first frame ready underneath */}
        {([0, 1] as const).map((n) => (
          <video key={n} ref={n === 0 ? vidA : vidB} playsInline preload="auto"
            onEnded={(e) => { if (e.currentTarget === videoRef.current && !switchingRef.current) advance() }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000', zIndex: n === slot ? 1 : 0, opacity: n === slot ? 1 : 0, pointerEvents: 'none', filter: n === slot ? appearanceCss(segments[index]?.appearance ?? appearance) : undefined, ...(cropStyle(n === slot ? index : index + 1) ?? {}) }} />
        ))}
        {captionStyle && caps.filter((c) => globalTime >= c.start && globalTime < c.end).map((c) => {
          const unit = ((c.size ?? captionStyle.size) / 1080) * 100
          const sel = selCap === c.id
          const cFont = CAPTION_TEXT_FONTS.find((f) => f.name === c.font)
          const cBg = c.bg !== undefined ? c.bg : captionStyle.background
          const boldPick = c.bold ?? captionStyle.bold
          const italic = c.italic ?? captionStyle.italic ?? false
          const underline = c.underline ?? captionStyle.underline ?? false
          const weight = boldPick === undefined ? (cFont ? cFont.weight : 900) : boldPick ? Math.max(700, cFont ? cFont.weight : 900) : 400
          const family = cFont ? cFont.css : boldPick === false ? 'Arial, Helvetica, sans-serif' : "Arial Black, 'Poppins', sans-serif"
          const boxW = Math.min(1, Math.max(0.1, c.w ?? 0.88))
          const handle = (style: React.CSSProperties, mode: CapHandle, cursor: string, label: string, hidden = false) => (
            <span role="slider" aria-label={label} aria-valuenow={Math.round(boxW * 100)}
              onPointerDown={(e) => { setSelCap(c.id); startResize(e, c, mode) }} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}
              style={{ position: 'absolute', background: hidden ? 'transparent' : '#fff', border: hidden ? 'none' : '1.5px solid #222', borderRadius: mode === 'l' || mode === 'r' ? 4 : 2, cursor, touchAction: 'none', zIndex: hidden ? 3 : 4, boxSizing: 'border-box', ...style }} />
          )
          return (
            <div key={c.id} aria-label={`Caption: ${c.text}`}
              data-capid={c.id}
              onPointerDown={(e) => {
                if (recording || !onCaptions) return
                e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}; setSelCap(c.id)
                // The first finger or the mouse starts fresh, so a finger that lifted somewhere else can never turn a move into a resize
                if (e.isPrimary) { ptrsRef.current.clear(); pinchRef.current = null }
                ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
                if (ptrsRef.current.size === 1) { const pf = frac(e); capPosRef.current = { id: c.id, dx: c.x - pf.x, dy: c.y - pf.y } }
                else if (ptrsRef.current.size === 2 && e.pointerType === 'touch') {
                  const [a, b] = Array.from(ptrsRef.current.values())
                  pinchRef.current = { id: c.id, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, size: c.size ?? captionStyle.size }
                  capPosRef.current = null
                }
              }}
              onPointerMove={(e) => {
                if (mouseUp(e)) { dropAll(); return }
                if (ptrsRef.current.has(e.pointerId)) ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
                const pin = pinchRef.current
                if (pin && e.pointerType === 'touch' && ptrsRef.current.size >= 2) {
                  const [a, b] = Array.from(ptrsRef.current.values())
                  const d = Math.hypot(a.x - b.x, a.y - b.y)
                  updateCap(pin.id, { size: Math.min(200, Math.max(16, Math.round(pin.size * (d / pin.dist)))) })
                  return
                }
                const p = capPosRef.current
                const box = stageRef.current?.getBoundingClientRect()
                if (!p || !box) return
                updateCap(p.id, { x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width + p.dx)), y: Math.min(0.97, Math.max(0.03, (e.clientY - box.top) / box.height + p.dy)) })
              }}
              onPointerUp={(e) => { ptrsRef.current.delete(e.pointerId); if (ptrsRef.current.size < 2) pinchRef.current = null; capPosRef.current = null }}
              onPointerCancel={(e) => { ptrsRef.current.delete(e.pointerId); if (ptrsRef.current.size < 2) pinchRef.current = null; capPosRef.current = null }}
              style={{ position: 'absolute', left: `${c.x * 100}%`, top: `${c.y * 100}%`, transform: 'translate(-50%, -50%)', width: `${boxW * 100}%`, textAlign: 'center', zIndex: 3, cursor: onCaptions ? 'grab' : 'default', touchAction: 'none', outline: sel ? '1.5px dashed rgba(255,255,255,0.85)' : 'none', outlineOffset: 4, fontFamily: family, fontWeight: weight, fontStyle: italic ? 'italic' : 'normal', textDecoration: underline ? 'underline' : 'none', lineHeight: 1.15, fontSize: `${unit}cqw`, color: c.color ?? captionStyle.color, WebkitTextStroke: `${Math.max(0.25, unit * 0.12)}cqw ${captionStyle.border}`, paintOrder: 'stroke fill', textShadow: '0 2px 8px rgba(0,0,0,0.35)', overflowWrap: 'anywhere' }}>
              {cBg ? <span style={{ background: cBg, padding: '0.25em 0.5em', borderRadius: 4, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>{c.text}</span> : c.text}
              {sel && onCaptions && !recording && (
                <>
                  {handle({ left: -6, top: '50%', width: 12, height: 26, marginTop: -13 }, 'l', 'ew-resize', 'Drag to move the left side of the caption box')}
                  {handle({ right: -6, top: '50%', width: 12, height: 26, marginTop: -13 }, 'r', 'ew-resize', 'Drag to move the right side of the caption box')}
                  {handle({ left: -6, top: -6, width: 12, height: 12 }, 'tl', 'nwse-resize', 'Drag to make the caption bigger or smaller')}
                  {handle({ right: -6, top: -6, width: 12, height: 12 }, 'tr', 'nesw-resize', 'Drag to make the caption bigger or smaller')}
                  {handle({ left: -6, bottom: -6, width: 12, height: 12 }, 'bl', 'nesw-resize', 'Drag to make the caption bigger or smaller')}
                  {handle({ right: -6, bottom: -6, width: 12, height: 12 }, 'br', 'nwse-resize', 'Drag to make the caption bigger or smaller')}
                </>
              )}
            </div>
          )
        })}
        {cropEdit && segments[cropEdit.clip] && clipOps && (
          <CropPage
            key={cropEdit.clip}
            src={previewUrlFor(segments[cropEdit.clip].file)}
            start={segments[cropEdit.clip].start}
            end={segments[cropEdit.clip].end}
            aspect={stageSize.w > 0 && stageSize.h > 0 ? stageSize.w / stageSize.h : 9 / 16}
            initial={segments[cropEdit.clip].crop ?? null}
            title={`Crop clip ${cropEdit.clip + 1}`}
            onCancel={() => setCropEdit(null)}
            onSave={(crop) => { const i = cropEdit.clip; setCropEdit(null); clipOps.onCrop(i, crop); seekGlobal(lengths.slice(0, i).reduce((x, y) => x + y, 0) + 0.001, false) }}
          />
        )}
        {screenText && hasClips && !recording && !cropEdit && (() => {
          const text = screenText.texts[index] || ''
          const editing = textEdit && textEdit.clip === index
          const commit = () => { if (textEdit) screenText.onEdit(textEdit.clip, textEdit.draft.trim()); setTextEdit(null) }
          return (
            <div aria-label="On-screen text"
              onPointerDown={(e) => {
                if (editing) return
                e.stopPropagation()
                try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
                const pf = frac(e)
                textPressRef.current = { sx: e.clientX, sy: e.clientY, dx: screenText.x - pf.x, dy: screenText.y - pf.y, moved: false }
              }}
              onPointerMove={(e) => {
                const p = textPressRef.current
                if (!p) return
                if (e.pointerType === 'mouse' && e.buttons === 0) { textPressRef.current = null; return }
                if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 6) return
                p.moved = true
                const pf = frac(e)
                screenText.onMove(Math.min(0.9, Math.max(0.1, pf.x + p.dx)), Math.min(0.95, Math.max(0.05, pf.y + p.dy)))
              }}
              onPointerUp={() => {
                const p = textPressRef.current
                textPressRef.current = null
                if (p && !p.moved) { videoRef.current?.pause(); pauseTakes(); setPlaying(false); setTextEdit({ clip: index, draft: text }) }
              }}
              onPointerCancel={() => { textPressRef.current = null }}
              style={{ position: 'absolute', left: `${screenText.x * 100}%`, top: `${screenText.y * 100}%`, transform: 'translate(-50%, -50%)', zIndex: 3, maxWidth: '88%', width: editing ? '84%' : 'max-content', boxSizing: 'border-box', padding: '6px 10px', border: '1.5px dashed rgba(255,255,255,0.9)', borderRadius: 4, background: text || editing ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.35)', cursor: editing ? 'text' : 'grab', touchAction: 'none', userSelect: editing ? 'text' : 'none', textAlign: 'center' }}>
              {editing ? (
                <textarea autoFocus value={textEdit!.draft} rows={2} maxLength={140} aria-label={`On-screen text for clip ${index + 1}`} placeholder="Type the on-screen text"
                  onChange={(e) => setTextEdit({ clip: index, draft: e.target.value })}
                  onBlur={commit}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() } if (e.key === 'Escape') setTextEdit(null) }}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', color: '#fff', fontWeight: 700, fontSize: 'clamp(12px, 6cqw, 22px)', lineHeight: 1.25, textAlign: 'center', fontFamily: 'inherit', textShadow: '0 1px 4px rgba(0,0,0,0.7)' }} />
              ) : (
                <span style={{ display: 'block', color: '#fff', fontWeight: text ? 700 : 600, fontSize: text ? 'clamp(12px, 6cqw, 22px)' : 'clamp(11px, 4.2cqw, 15px)', lineHeight: 1.25, textShadow: '0 1px 4px rgba(0,0,0,0.7)', overflowWrap: 'break-word', opacity: text ? 1 : 0.85 }}>
                  {text || 'Tap to add on-screen text'}
                </span>
              )}
              {!editing && (
                <button type="button" aria-label="Turn on-screen text off" title="Turn on-screen text off"
                  onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); screenText.onRemove() }}
                  style={{ position: 'absolute', right: -10, top: -10, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 13, lineHeight: 1, cursor: 'pointer', padding: 0 }}>×</button>
              )}
            </div>
          )
        })()}
        {autoCap && hasClips && !recording && (() => {
          const sizeNow = captionStyle?.size ?? 60
          const unit = (sizeNow / 1080) * 100
          // Only the corners change the size. The opposite edge stays where it is, so dragging a top corner up grows the captions upwards.
          const startAutoSize = (e: React.PointerEvent, corner: 'tl' | 'tr' | 'bl' | 'br') => {
            // eslint-disable-next-line react-hooks/refs -- only runs when a corner is pressed
            const box = stageRef.current?.getBoundingClientRect()
            const el = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect()
            if (!box || !el || !onAutoCapSize) return
            e.stopPropagation()
            try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
            const top = corner === 'tl' || corner === 'tr'
            const ax = corner === 'tl' || corner === 'bl' ? el.right : el.left
            const ay = top ? el.bottom : el.top
            autoSizeRef.current = { size: sizeNow, dist: Math.max(8, Math.hypot(e.clientX - ax, e.clientY - ay)), cx: ax, cy: ay, axis: top ? 'y' : 'xy', h: el.height, boxTop: box.top, boxH: box.height }
          }
          const moveAutoSize = (e: React.PointerEvent) => {
            const r = autoSizeRef.current
            if (!r || !onAutoCapSize) return
            if (e.pointerType === 'mouse' && e.buttons === 0) { autoSizeRef.current = null; return }
            const next = Math.min(200, Math.max(16, Math.round(r.size * (Math.hypot(e.clientX - r.cx, e.clientY - r.cy) / r.dist))))
            onAutoCapSize(next)
            if (onAutoCapMove && r.boxH > 0) {
              const h = r.h * (next / r.size)
              const centre = r.axis === 'y' ? r.cy - h / 2 : r.cy + h / 2
              onAutoCapMove(autoCap.x, Math.min(0.95, Math.max(0.05, (centre - r.boxTop) / r.boxH)))
            }
          }
          const endAutoSize = () => { autoSizeRef.current = null }
          const edge = (style: React.CSSProperties, cursor: string, label: string, corner: 'tl' | 'tr' | 'bl' | 'br') => onAutoCapSize ? (
            <span role="slider" aria-label={label} aria-valuenow={sizeNow} onPointerDown={(e) => startAutoSize(e, corner)} onPointerMove={moveAutoSize} onPointerUp={endAutoSize} onPointerCancel={endAutoSize}
              style={{ position: 'absolute', background: '#fff', border: '1.5px solid #222', borderRadius: 3, cursor, touchAction: 'none', zIndex: 4, boxSizing: 'border-box', ...style }} />
          ) : null
          const autoFont = CAPTION_TEXT_FONTS.find((f) => f.name === autoCapFont) ?? CAPTION_TEXT_FONTS.find((f) => f.name === 'Sans Bold')!
          return (
          <div aria-label="Auto captions position"
            onPointerDown={(e) => { if (!onAutoCapMove) return; e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}; autoDragRef.current = true; const pf = frac(e); grabRef.current = { dx: autoCap.x - pf.x, dy: autoCap.y - pf.y } }}
            onPointerMove={(e) => {
              if (!autoDragRef.current || !onAutoCapMove) return
              if (e.pointerType === 'mouse' && e.buttons === 0) { autoDragRef.current = false; return }
              const box = stageRef.current?.getBoundingClientRect()
              if (!box) return
              onAutoCapMove(Math.min(0.9, Math.max(0.1, (e.clientX - box.left) / box.width + grabRef.current.dx)), Math.min(0.95, Math.max(0.05, (e.clientY - box.top) / box.height + grabRef.current.dy)))
            }}
            onPointerUp={() => { autoDragRef.current = false }}
            onPointerCancel={() => { autoDragRef.current = false }}
            style={{ position: 'absolute', left: `${autoCap.x * 100}%`, top: `${autoCap.y * 100}%`, transform: 'translate(-50%, -50%)', zIndex: 3, cursor: 'grab', touchAction: 'none', userSelect: 'none', maxWidth: '100%', width: 'max-content', boxSizing: 'border-box', textAlign: 'center', padding: '4px 10px', outline: '1.5px solid rgba(255,255,255,0.95)', background: 'rgba(0,0,0,0.12)' }}>
            <span style={{ display: 'inline-block', fontFamily: autoFont.css, fontWeight: captionStyle?.bold === undefined ? autoFont.weight : captionStyle.bold ? Math.max(700, autoFont.weight) : 400, fontStyle: captionStyle?.italic ? 'italic' : 'normal', textDecoration: captionStyle?.underline ? 'underline' : 'none', lineHeight: 1.15, fontSize: `${unit}cqw`, color: captionStyle?.color ?? '#fff', WebkitTextStroke: `${Math.max(0.25, unit * 0.12)}cqw ${captionStyle?.border ?? '#000'}`, paintOrder: 'stroke fill', background: captionStyle?.background ?? 'transparent', padding: captionStyle?.background ? '0.25em 0.5em' : 0, borderRadius: 4 }}>The words you speak</span>
            {onAutoCapRemove && (
              <button type="button" aria-label="Remove auto captions" title="Turn auto captions off"
                onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onAutoCapRemove() }}
                style={{ position: 'absolute', right: -2, top: -30, zIndex: 5, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 14, lineHeight: 1, cursor: 'pointer', padding: 0 }}>×</button>
            )}
            {edge({ left: -6, top: -6, width: 11, height: 11 }, 'nwse-resize', 'Drag the corner to change the auto caption size', 'tl')}
            {edge({ right: -6, top: -6, width: 11, height: 11 }, 'nesw-resize', 'Drag the corner to change the auto caption size', 'tr')}
            {edge({ left: -6, bottom: -6, width: 11, height: 11 }, 'nesw-resize', 'Drag the corner to change the auto caption size', 'bl')}
            {edge({ right: -6, bottom: -6, width: 11, height: 11 }, 'nwse-resize', 'Drag the corner to change the auto caption size', 'br')}
          </div>
          )
        })()}
        {(overlays || []).map((ov, oi) => {
          if (!(globalTime >= ov.start && (ov.end === null || globalTime < ov.end))) return null
          const selected = selOverlay === ov.id && !recording
          const vw = Math.max(0.1, 1 - ov.cl - ov.cr)
          const vh = Math.max(0.1, 1 - ov.ct - ov.cb)
          const cropping = ovCrop === ov.id
          const sizer = (mode: OvHandle, pos: React.CSSProperties, cursor: string) => (
            <span key={mode} aria-label="Drag to resize" role="slider" aria-valuenow={Math.round(ov.size * 100)}
              onPointerDown={(e) => {
                if (!onOverlayPatch) return
                e.stopPropagation()
                const box = stageRef.current?.getBoundingClientRect()
                const el = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect()
                if (!box || !el || box.width <= 0) return
                try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
                // The point that stays still: the opposite corner, or the middle of the opposite edge
                const ax = mode === 'l' || mode === 'tl' || mode === 'bl' ? el.right : mode === 'r' || mode === 'tr' || mode === 'br' ? el.left : el.left + el.width / 2
                const ay = mode === 't' || mode === 'tl' || mode === 'tr' ? el.bottom : mode === 'b' || mode === 'bl' || mode === 'br' ? el.top : el.top + el.height / 2
                const dist = mode === 'l' || mode === 'r' ? el.width : mode === 't' || mode === 'b' ? el.height : Math.max(8, Math.hypot(e.clientX - ax, e.clientY - ay))
                ovResizeRef.current = { id: ov.id, mode, size: ov.size, w: el.width, h: el.height, ax, ay, dist, bx: box.left, by: box.top, bw: box.width, bh: box.height }
              }}
              onPointerMove={(e) => {
                const r = ovResizeRef.current
                if (!r || r.id !== ov.id || !onOverlayPatch) return
                if (mouseUp(e)) { dropAll(); return }
                const raw = r.mode === 'l' ? r.ax - e.clientX : r.mode === 'r' ? e.clientX - r.ax : r.mode === 't' ? r.ay - e.clientY : r.mode === 'b' ? e.clientY - r.ay : Math.hypot(e.clientX - r.ax, e.clientY - r.ay)
                const size = Math.min(1, Math.max(0.05, r.size * (Math.max(1, raw) / r.dist)))
                const k = size / r.size
                const w = r.w * k, h = r.h * k
                // Where the middle of the overlay ends up so the still point does not move
                const sx = r.mode === 'l' || r.mode === 'tl' || r.mode === 'bl' ? -1 : r.mode === 'r' || r.mode === 'tr' || r.mode === 'br' ? 1 : 0
                const sy = r.mode === 't' || r.mode === 'tl' || r.mode === 'tr' ? -1 : r.mode === 'b' || r.mode === 'bl' || r.mode === 'br' ? 1 : 0
                const cx = r.ax + sx * (w / 2), cy = r.ay + sy * (h / 2)
                onOverlayPatch(ov.id, { size, x: Math.min(1, Math.max(0, (cx - r.bx) / r.bw)), y: Math.min(1, Math.max(0, (cy - r.by) / r.bh)) })
              }}
              onPointerUp={() => { ovResizeRef.current = null }} onPointerCancel={() => { ovResizeRef.current = null }}
              style={{ position: 'absolute', background: '#fff', border: '2px solid var(--coral)', borderRadius: mode.length === 2 ? '50%' : 4, boxSizing: 'border-box', cursor, touchAction: 'none', zIndex: 3, ...pos }} />
          )
          // Edge handles trim the picture. The part that is left stays where it was, so the edge follows the mouse.
          const cropEdge = (edge: 'l' | 'r' | 't' | 'b', pos: React.CSSProperties, cursor: string) => (
            <span aria-label="Drag to crop this edge" role="slider" aria-valuenow={0}
              onPointerDown={(e) => {
                if (!onOverlayPatch) return
                e.stopPropagation()
                const box = stageRef.current?.getBoundingClientRect()
                if (!box) return
                try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
                ovCropRef.current = { id: ov.id, edge, sx: e.clientX, sy: e.clientY, x: ov.x, y: ov.y, size: ov.size, cl: ov.cl, cr: ov.cr, ct: ov.ct, cb: ov.cb, ar: ov.ar, w: box.width, h: box.height }
              }}
              onPointerMove={(e) => {
                const r = ovCropRef.current
                if (!r || r.id !== ov.id || !onOverlayPatch) return
                if (mouseUp(e)) { dropAll(); return }
                const vw0 = Math.max(0.1, 1 - r.cl - r.cr), vh0 = Math.max(0.1, 1 - r.ct - r.cb)
                const w0 = r.size * r.w
                const h0 = (w0 * vh0 * r.ar) / vw0
                const clamp = (v: number, other: number) => Math.min(Math.min(0.45, 0.9 - other), Math.max(0, v))
                if (r.edge === 'l' || r.edge === 'r') {
                  const delta = ((e.clientX - r.sx) / w0) * vw0
                  const next = r.edge === 'l' ? clamp(r.cl + delta, r.cr) : clamp(r.cr - delta, r.cl)
                  const changed = r.edge === 'l' ? next - r.cl : next - r.cr
                  const w1 = (w0 * (vw0 - changed)) / vw0
                  const shift = ((w0 - w1) / 2 / r.w) * (r.edge === 'l' ? 1 : -1)
                  onOverlayPatch(ov.id, { [r.edge === 'l' ? 'cl' : 'cr']: next, size: Math.min(1, Math.max(0.05, w1 / r.w)), x: Math.min(0.95, Math.max(0.05, r.x + shift)) })
                } else {
                  const delta = ((e.clientY - r.sy) / h0) * vh0
                  const next = r.edge === 't' ? clamp(r.ct + delta, r.cb) : clamp(r.cb - delta, r.ct)
                  const changed = r.edge === 't' ? next - r.ct : next - r.cb
                  const h1 = (h0 * (vh0 - changed)) / vh0
                  const shift = ((h0 - h1) / 2 / r.h) * (r.edge === 't' ? 1 : -1)
                  onOverlayPatch(ov.id, { [r.edge === 't' ? 'ct' : 'cb']: next, y: Math.min(0.95, Math.max(0.05, r.y + shift)) })
                }
              }}
              onPointerUp={() => { ovCropRef.current = null }} onPointerCancel={() => { ovCropRef.current = null }}
              style={{ position: 'absolute', background: '#fff', border: '2px solid var(--coral)', borderRadius: 4, boxSizing: 'border-box', cursor, touchAction: 'none', zIndex: 3, ...pos }} />
          )
          return (
            <div key={ov.id} aria-label="Overlay"
              onPointerDown={(e) => { if (recording || !onOverlayPatch) return; e.stopPropagation(); onSelOverlay?.(ov.id); try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}; ovDragRef.current = ov.id; const pf = frac(e); grabRef.current = { dx: ov.x - pf.x, dy: ov.y - pf.y } }}
              onPointerMove={(e) => {
                if (ovDragRef.current !== ov.id || !onOverlayPatch) return
                if (mouseUp(e)) { dropAll(); return }
                const box = stageRef.current?.getBoundingClientRect()
                if (!box) return
                onOverlayPatch(ov.id, { x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width + grabRef.current.dx)), y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height + grabRef.current.dy)) })
              }}
              onPointerUp={() => { ovDragRef.current = null }}
              onPointerCancel={() => { ovDragRef.current = null }}
              style={{ position: 'absolute', left: `${ov.x * 100}%`, top: `${ov.y * 100}%`, width: `${ov.size * 100}%`, aspectRatio: `${vw} / ${vh * ov.ar}`, transform: 'translate(-50%, -50%)', zIndex: 2 + oi, cursor: onOverlayPatch ? 'grab' : 'default', touchAction: 'none', outline: selected ? '1.5px solid var(--coral)' : 'none' }}>
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                {ov.kind === 'image'
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={ov.url} alt="" draggable={false}
                      onLoad={(e) => { const n = e.currentTarget; if (n.naturalWidth && onOverlayPatch) { const a = n.naturalHeight / n.naturalWidth; if (Math.abs(a - ov.ar) > 0.001) onOverlayPatch(ov.id, { ar: a }) } }}
                      style={{ position: 'absolute', width: `${100 / vw}%`, left: `${-(ov.cl / vw) * 100}%`, top: `${-(ov.ct / vh) * 100}%`, display: 'block' }} />
                  : <video ref={(el) => { ovVideosRef.current[ov.id] = el }} src={ov.url} muted loop playsInline
                      onLoadedMetadata={(e) => { const n = e.currentTarget; if (n.videoWidth && onOverlayPatch) { const a = n.videoHeight / n.videoWidth; if (Math.abs(a - ov.ar) > 0.001) onOverlayPatch(ov.id, { ar: a }) } }}
                      style={{ position: 'absolute', width: `${100 / vw}%`, left: `${-(ov.cl / vw) * 100}%`, top: `${-(ov.ct / vh) * 100}%`, display: 'block' }} />}
              </div>
              {selected && onOverlayPatch && (
                <>
                  <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setOvCrop(cropping ? null : ov.id) }}
                    aria-pressed={cropping} title={cropping ? 'Finish cropping' : 'Crop: drag the edges to trim the picture'}
                    style={{ position: 'absolute', left: '50%', top: -34, transform: 'translateX(-50%)', zIndex: 4, background: cropping ? 'var(--coral)' : 'rgba(0,0,0,0.75)', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{cropping ? 'Done cropping' : 'Crop'}</button>
                  {cropping ? (
                    <>
                      {cropEdge('l', { left: -6, top: '50%', width: 12, height: 28, marginTop: -14 }, 'ew-resize')}
                      {cropEdge('r', { right: -6, top: '50%', width: 12, height: 28, marginTop: -14 }, 'ew-resize')}
                      {cropEdge('t', { top: -6, left: '50%', width: 28, height: 12, marginLeft: -14 }, 'ns-resize')}
                      {cropEdge('b', { bottom: -6, left: '50%', width: 28, height: 12, marginLeft: -14 }, 'ns-resize')}
                    </>
                  ) : (
                    <>
                      {sizer('tl', { left: -7, top: -7, width: 14, height: 14 }, 'nwse-resize')}
                      {sizer('tr', { right: -7, top: -7, width: 14, height: 14 }, 'nesw-resize')}
                      {sizer('bl', { left: -7, bottom: -7, width: 14, height: 14 }, 'nesw-resize')}
                      {sizer('br', { right: -7, bottom: -7, width: 14, height: 14 }, 'nwse-resize')}
                      {sizer('l', { left: -6, top: '50%', width: 12, height: 28, marginTop: -14 }, 'ew-resize')}
                      {sizer('r', { right: -6, top: '50%', width: 12, height: 28, marginTop: -14 }, 'ew-resize')}
                      {sizer('t', { top: -6, left: '50%', width: 28, height: 12, marginLeft: -14 }, 'ns-resize')}
                      {sizer('b', { bottom: -6, left: '50%', width: 28, height: 12, marginLeft: -14 }, 'ns-resize')}
                    </>
                  )}
                </>
              )}
            </div>
          )
        })}
        {hasClips && badge && (() => {
          const b = BADGE_SPOT.portrait
          return (
            <div aria-label="Made with Reelezy badge" style={{ position: 'absolute', left: `${(b.x - b.size / 2) * 100}%`, top: `${b.y * 100}%`, transform: 'translateY(-50%)', width: `${b.size * 100}%`, aspectRatio: `${BADGE_RATIO}`, zIndex: 3, pointerEvents: 'none' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BADGE_SRC} alt="Made with Reelezy" draggable={false} style={{ width: '100%', display: 'block' }} />
              {onBadge && !recording && (
                <button type="button" aria-label="Remove the Made with Reelezy badge" title="Remove the badge from this video"
                  onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onBadge(false) }}
                  style={{ position: 'absolute', top: -9, right: -9, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 13, lineHeight: 1, cursor: 'pointer', padding: 0, pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon n="close" /></button>
              )}
            </div>
          )
        })()}
        {scriptLines.length > 0 && (recording || countdown !== null || showScript || (holdScript && !playing)) && (() => {
          // A teleprompter: every line shows in full, the text glides up at reading pace and the line being read sits on a fixed reading line.
          // When you are not recording you can scroll the script yourself.
          const f = scriptF
          const live = recording || countdown !== null
          return (
            <div aria-label="Your script" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '58%', zIndex: 2, pointerEvents: 'none', background: 'linear-gradient(rgba(8,6,24,0.88) 70%, rgba(8,6,24,0))', WebkitMaskImage: 'linear-gradient(#000 80%, transparent)', maskImage: 'linear-gradient(#000 80%, transparent)' }}>
              <span aria-hidden style={{ position: 'absolute', left: 8, top: 44 + 8, width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '9px solid var(--coral)' }} />
              <div ref={(el) => { prompterRef.current = el; if (el && !live && Math.abs(el.scrollTop - lastYRef.current) > 2) el.scrollTop = lastYRef.current }}
                onScroll={(e) => { if (!live) lastYRef.current = e.currentTarget.scrollTop }}
                style={{ position: 'absolute', inset: 0, overflowY: live ? 'hidden' : 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'none', pointerEvents: live ? 'none' : 'auto', touchAction: 'pan-y' }}>
                <div ref={promptInnerRef} style={{ position: 'relative', padding: '44px 16px 400px 26px', willChange: live ? 'transform' : undefined }}>
                  {scriptLines.map((l, i) => {
                    const d = Math.abs(i - f)
                    return (
                      <p key={i} ref={(el) => { lineEls.current[i] = el }} style={{ margin: '0 0 18px', fontSize: 'clamp(14px, 8cqw, 22px)', fontWeight: 700, lineHeight: 1.35, color: '#fff', opacity: live ? Math.max(0.2, 1 - d * 0.5) : 1, overflowWrap: 'break-word', hyphens: 'manual', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>{l}</p>
                    )
                  })}
                </div>
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
            style={{ position: 'absolute', inset: 0, margin: 'auto', width: 56, height: 56, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 22, cursor: 'pointer', paddingLeft: 4 }}><Icon n="play" /></button>
        )}
        {recording && (
          <span style={{ position: 'absolute', top: 10, left: 10, zIndex: 3, background: 'rgba(217,45,32,0.9)', color: '#fff', fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '3px 10px' }}>Recording</span>
        )}
        {!hasClips && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '0 24px', textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5 }}>
            <p style={{ margin: 0 }}>Add a clip to see your video here.</p>
            {onDropFiles && (
              <>
                <input ref={pickRef} type="file" accept="video/*" multiple style={{ display: 'none' }}
                  onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) onDropFiles(files); e.target.value = '' }} />
                <button type="button" onClick={() => pickRef.current?.click()} data-tour="choose-clip"
                  style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Choose clip</button>
                {onPickLibrary && (
                  <button type="button" onClick={onPickLibrary}
                    style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.45)', borderRadius: 4, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Pick from library</button>
                )}
                <p className="dnd-hint" style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>or drag and drop a video onto this phone</p>
              </>
            )}
          </div>
        )}
      </div>
      </div>
      {takes.map((t) => (
        <audio key={t.id} ref={(el) => { audioEls.current[t.id] = el }} src={t.url} preload="auto" />
      ))}
      {musicUrl && <audio ref={(el) => { audioEls.current['music'] = el }} src={musicUrl} preload="auto" onLoadedMetadata={(e) => whenDurationKnown(e.currentTarget, setMusicDur)} />}

      <div className={mobile ? 'ed-ctrl' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: mobile ? 8 : 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={toggle} disabled={!hasClips || recording || countdown !== null} aria-label={playing ? 'Pause' : 'Play'}
          style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 12, cursor: !hasClips || recording ? 'default' : 'pointer', opacity: !hasClips || recording ? 0.4 : 1, flexShrink: 0 }}>
          {playing ? <Icon n="pause" /> : <Icon n="play" />}
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmtClock(globalTime)} / {fmtClock(total)}</span>
        <span style={{ flex: 1 }} />
        {!mobile && onBadge && hasClips && !badge && !recording && (
          <button type="button" onClick={() => onBadge(true)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--coral)', textDecoration: 'underline', cursor: 'pointer' }}>Add Made with Reelezy badge</button>
        )}
        {!recording ? (
          <button type="button" onClick={startRecording} disabled={!hasClips || countdown !== null}
            style={{ ...choiceBtn(false, !hasClips || countdown !== null), display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap', padding: '9px 20px', margin: 2 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#d92d20', display: 'inline-block' }} />
            {countdown !== null ? 'Get ready' : 'Record voiceover'}
          </button>
        ) : (
          <button type="button" onClick={stopRecording}
            style={{ ...choiceBtn(), background: '#d92d20', border: '1px solid #d92d20', color: '#fff', flexShrink: 0, whiteSpace: 'nowrap', padding: '9px 20px', margin: 2 }}>Stop recording</button>
        )}
      </div>

      <div className={mobile ? 'ed-tl' : undefined} style={{ marginTop: mobile ? 6 : 12, display: mobile && panelOpen ? 'none' : undefined }}>
        <style>{`.tl-vo,.tl-clip{container-type:inline-size}.tl-short{display:none}
@container (max-width:100px){.tl-vo .tl-x{display:none}}
@container (max-width:74px){.tl-vo .tl-full{display:none}.tl-vo .tl-short{display:inline}}
@container (max-width:58px){.tl-clip .tl-full{display:none}}`}</style>
        {/* The strip above the timeline: press or drag anywhere on it to move the line, which has a handle here */}
        <div aria-hidden="true" onPointerDown={startScrub} onPointerMove={moveScrub} onPointerUp={endScrub} onPointerCancel={() => endScrub()} onLostPointerCapture={() => endScrub()}
          style={{ position: 'relative', height: 18, marginBottom: 4, marginRight: addSources ? PLUS_COL : 0, cursor: recording || total <= 0 ? 'default' : 'ew-resize', touchAction: 'none', userSelect: 'none' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 8, height: 2, borderRadius: 1, background: 'rgba(128,128,128,0.25)' }} />
          {hasClips && (
            <div style={{ position: 'absolute', top: 0, left: pct(globalTime), width: 14, height: 18, marginLeft: -7, pointerEvents: 'none' }}>
              <div style={{ width: 14, height: 12, borderRadius: 3, background: 'var(--ink)' }} />
              <div style={{ width: 0, height: 0, margin: '0 auto', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid var(--ink)' }} />
            </div>
          )}
        </div>
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Video timeline"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(globalTime)}
          onKeyDown={(e) => {
            if (recording || total <= 0) return
            const step = e.shiftKey ? 5 : 1
            const to = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? globalTime - step : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? globalTime + step : e.key === 'Home' ? 0 : e.key === 'End' ? total - 0.05 : null
            if (to === null) return
            e.preventDefault()
            seekGlobal(Math.max(0, Math.min(total - 0.05, to)), playing)
          }}
          onPointerDown={(e) => {
            if (recording || total <= 0) return
            const top = e.currentTarget.getBoundingClientRect().top
            if ((clipOps || (onReorderClip && segments.length > 1)) && e.clientY - top <= 24) {
              // A press on a clip block: tap to jump there and open its menu, or drag it to a new place
              const at = clipIndexAt(e.clientX)
              clipPressRef.current = { from: at, to: at, startX: e.clientX, dragging: false }
              try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
              return
            }
            startScrub(e)
          }}
          onPointerMove={(e) => {
            const press = clipPressRef.current
            if (press) {
              if (!press.dragging && Math.abs(e.clientX - press.startX) < 8) return
              // With nothing to reorder, dragging along the clips moves the line instead
              if (!(onReorderClip && segments.length > 1)) {
                clipPressRef.current = null
                const wasPlaying = playing
                if (wasPlaying) { videoRef.current?.pause(); pauseTakes(); setPlaying(false) }
                scrubRef.current = { wasPlaying, sx: e.clientX, moved: true }
                seekGlobal(timeAt(e.clientX), false)
                return
              }
              press.dragging = true
              press.to = clipIndexAt(e.clientX)
              setClipDrag({ from: press.from, to: press.to })
              return
            }
            moveScrub(e)
          }}
          onPointerUp={(e) => {
            const press = clipPressRef.current
            clipPressRef.current = null
            if (!press) { endScrub(e); return }
            setClipDrag(null)
            if (press.dragging) { if (press.from !== press.to) onReorderClip?.(press.from, press.to) }
            else tapClip(press.from)
          }}
          onPointerCancel={() => { endScrub(); clipPressRef.current = null; setClipDrag(null) }}
          onLostPointerCapture={() => { endScrub(); if (clipPressRef.current && !clipPressRef.current.dragging) clipPressRef.current = null }}
          style={{ position: 'relative', height: trackHeight, marginRight: addSources ? PLUS_COL : 0, touchAction: 'none', cursor: recording ? 'default' : 'pointer', userSelect: 'none', outlineOffset: 3 }}
        >
          {/* A + at the end of the video line and the audio line, to add a clip or some sound */}
          {addSources && !recording && (['video', 'audio'] as const).filter((k) => addSources[k]).map((k) => (
            <button key={k} type="button" data-add-line={k} aria-label={k === 'video' ? 'Add a video' : 'Add audio'} aria-expanded={addMenu?.kind === k}
              onPointerDown={(e) => e.stopPropagation()} onClick={(e) => openAdd(k, e)}
              style={{ position: 'absolute', right: -PLUS_COL, top: k === 'video' ? 0 : 32, width: PLUS_COL - 6, height: k === 'video' ? 24 : 26, borderRadius: 4, border: '1.5px dashed var(--line)', background: addMenu?.kind === k ? 'rgba(255,106,77,0.12)' : 'var(--card-bg)', color: 'var(--coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, touchAction: 'manipulation' }}>
              <LineIcon n="plus" size={16} />
            </button>
          ))}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 24, display: 'flex', borderRadius: 4, overflow: 'hidden', background: 'rgba(128,128,128,0.15)' }}>
            {/* eslint-disable-next-line react-hooks/refs -- the handlers only touch refs when the user drags */}
            {lengths.map((len, i) => {
              const moving = clipDrag?.from === i
              const landing = !!clipDrag && clipDrag.to === i && clipDrag.from !== i
              const edge = landing && clipDrag ? (clipDrag.to > clipDrag.from ? 'inset -3px 0 0 #fff' : 'inset 3px 0 0 #fff') : 'none'
              // The clip having an end dragged is drawn at its full length: the parts cut off are faded, and the
              // white ends sit where the cut is, so they can be dragged back out at any time
              const tv = trimView && trimView.i === i ? trimView : null
              const shown = tv ? tv.dur / tv.sp : len
              const keptL = tv && tv.dur > 0 ? (tv.start / tv.dur) * 100 : 0
              const keptR = tv && tv.dur > 0 ? (1 - tv.end / tv.dur) * 100 : 0
              const handle = (side: 'l' | 'r') => (
                <span key={side} role="separator" aria-label={side === 'l' ? `Trim the start of clip ${i + 1}` : `Trim the end of clip ${i + 1}`}
                  onPointerDown={(e) => startTrim(e, i, side)} onPointerMove={(e) => moveTrim(e)} onPointerUp={() => endTrim()} onPointerCancel={() => endTrim()} onLostPointerCapture={() => endTrim()}
                  style={{ position: 'absolute', top: 0, bottom: 0, zIndex: 2, ...(side === 'l' ? { left: `${keptL}%` } : { right: `${keptR}%` }), width: 14, background: '#fff', cursor: 'ew-resize', touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: side === 'l' ? '6px 0 0 6px' : '0 6px 6px 0' }}>
                  <span style={{ width: 2, height: 12, background: 'rgba(0,0,0,0.45)', borderRadius: 1, pointerEvents: 'none' }} />
                </span>
              )
              return (
                <div key={i} className="tl-clip" data-clip-block={i} aria-label={`Clip ${i + 1}. Tap for speed, audio, crop and delete.`} style={{ position: 'relative', flex: shown > 0 ? '0 0 auto' : 1, width: shown > 0 ? `${scaleTotal > 0 ? (shown / scaleTotal) * 100 : 0}%` : undefined, minWidth: onTrimClip ? 28 : undefined, background: tv ? 'transparent' : clipShade(i), borderRight: '1px solid rgba(0,0,0,0.25)', boxSizing: 'border-box', fontSize: 11, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', paddingLeft: onTrimClip ? 18 : 6, overflow: 'hidden', whiteSpace: 'nowrap', opacity: moving ? 0.45 : 1, boxShadow: actionClip === i ? 'inset 0 0 0 2px #fff' : edge, cursor: onReorderClip && segments.length > 1 && !recording ? 'grab' : 'pointer' }}>
                  {tv && (
                    <>
                      {/* The cut parts, faded, then the part that stays */}
                      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: clipShade(i), opacity: 0.3 }} />
                      <span aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: `${keptL}%`, right: `${keptR}%`, background: clipShade(i) }} />
                    </>
                  )}
                  <span style={{ position: 'relative', pointerEvents: 'none', overflow: 'hidden', textOverflow: 'ellipsis', paddingLeft: tv ? `${keptL}%` : 0 }}><span className="tl-full">Clip </span>{i + 1}</span>
                  {onTrimClip && !recording && handle('l')}
                  {onTrimClip && !recording && handle('r')}
                </div>
              )
            })}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 32, height: 26, borderRadius: 4, background: 'rgba(128,128,128,0.08)', overflow: 'hidden' }}>
            {takes.map((t, ti) => (
              <div key={t.id} {...tapEl('take', t.id)} title={`Voiceover ${ti + 1} from ${fmtClock(t.start)}. Tap for its volume, drag to move it, or drag it down to the bin to delete it.`}
                onPointerDown={(e) => { if (recording || total <= 0) return; e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}; dragTakeRef.current = { id: t.id, grab: timeAt(e.clientX) - t.start, sx: e.clientX, sy: e.clientY, moved: false } }}
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
                className="tl-vo" style={{ position: 'absolute', top: 0, bottom: 0, left: pct(t.start), width: t.duration > 0 ? `${scaleTotal > 0 ? Math.min(100, Math.max(0, ((dispAt(Math.min(total, t.start + t.duration)) - dispAt(t.start)) / scaleTotal) * 100)) : 0}%` : `calc(100% - ${pct(t.start)})`, background: `${takeColor(ti)}B3`, border: `1.5px solid ${takeColor(ti)}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box', overflow: 'hidden', cursor: recording ? 'default' : 'grab', touchAction: 'none' }}>
                <span className="tl-full" style={{ color: '#fff', pointerEvents: 'none', fontSize: 11, fontWeight: 600, paddingLeft: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>Voiceover {ti + 1}</span>
                <span className="tl-short" style={{ color: '#fff', pointerEvents: 'none', fontSize: 11, fontWeight: 600, paddingLeft: 5, whiteSpace: 'nowrap' }}>VO {ti + 1}</span>
                <button type="button" className="tl-x" aria-label={`Remove voiceover ${ti + 1}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onRemoveTake(t.id) }}
                  style={{ background: 'none', border: 'none', color: '#fff', fontSize: 14, lineHeight: 1, cursor: 'pointer', padding: '0 6px', flexShrink: 0 }}><Icon n="close" /></button>
              </div>
            ))}
            {recording && (
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: pct(recFrom), width: pct(Math.max(0, globalTime - recFrom)), background: 'rgba(217,45,32,0.9)', borderRadius: 4 }} />
            )}
          </div>
          {musicUrl && (
            (() => {
              const from = Math.max(0, musicStart)
              const to = musicDur > 0 ? Math.min(total, musicStart + musicDur) : total
              const canDrag = !!tlOps?.onMusicStart && !recording && total > 0
              return (
                <div {...tapEl('music', 'm')} role="button" aria-label={`Music from ${fmtClock(from)}. Drag to move it, tap for its volume.`}
                  onPointerDown={(e) => { e.stopPropagation(); if (!canDrag) return; try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}; musicDragRef.current = { sx: e.clientX, s0: musicStart, moved: false } }}
                  onPointerMove={(e) => {
                    const d = musicDragRef.current
                    if (!d || !tlOps?.onMusicStart) return
                    if (!d.moved && Math.abs(e.clientX - d.sx) < 6) return
                    d.moved = true
                    // Drag right to start it later in the video, drag left to skip the start of the song
                    const lo = musicDur > 1 ? -(musicDur - 1) : 0
                    const next = Math.min(Math.max(0, total - 0.5), Math.max(lo, d.s0 + (timeAt(e.clientX) - timeAt(d.sx))))
                    tlOps.onMusicStart(Math.round(next * 100) / 100)
                  }}
                  onPointerUp={() => { musicDragRef.current = null }} onPointerCancel={() => { musicDragRef.current = null }}
                  style={{ position: 'absolute', left: pct(from), width: pct(Math.max(0.3, to - from)), top: 64, height: 22, borderRadius: 4, background: 'rgba(58,157,110,0.55)', border: `1.5px solid ${elPop?.kind === 'music' ? '#fff' : '#3A9D6E'}`, boxSizing: 'border-box', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', paddingLeft: 8, cursor: canDrag ? 'grab' : 'pointer', touchAction: 'none', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <span style={{ pointerEvents: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>Music{musicStart < -0.05 ? ` (from ${fmtClock(-musicStart)} into the song)` : ''}</span>
                </div>
              )
            })()
          )}
          {/* eslint-disable-next-line react-hooks/refs -- the handlers only touch refs when the user drags */}
          {total > 0 && (overlays || []).map((ov, oi) => (
            <div key={ov.id} {...tapEl('overlay', ov.id)} title="Overlay. Tap for options, drag to move it, drag the white ends to change when it shows."
              onPointerDown={(e) => startOvTime(e, 'move', ov)} onPointerMove={moveOvTime} onPointerUp={() => { ovDragTimeRef.current = null }} onPointerCancel={() => { ovDragTimeRef.current = null }}
              style={{ position: 'absolute', top: ovTop + oi * 28, height: 22, left: pct(Math.min(ov.start, total)), width: pct(Math.max(0, Math.min(total, ov.end ?? total) - Math.min(ov.start, total))), minWidth: 22, boxSizing: 'border-box', borderRadius: 4, background: selOverlay === ov.id ? 'rgba(74,111,165,0.9)' : 'rgba(74,111,165,0.55)', border: `1.5px solid ${selOverlay === ov.id ? '#fff' : '#4a6fa5'}`, color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', padding: '0 12px', overflow: 'hidden', whiteSpace: 'nowrap', cursor: recording ? 'default' : 'grab', touchAction: 'none' }}>
              <span style={{ pointerEvents: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ov.isLogo ? 'Logo' : ov.file.name}</span>
              {!recording && (['l', 'r'] as const).map((side) => (
                <span key={side} aria-label={side === 'l' ? 'Change when the overlay starts' : 'Change when the overlay ends'}
                  onPointerDown={(e) => startOvTime(e, side, ov)} onPointerMove={moveOvTime} onPointerUp={() => { ovDragTimeRef.current = null }} onPointerCancel={() => { ovDragTimeRef.current = null }}
                  style={{ position: 'absolute', top: 0, bottom: 0, [side === 'l' ? 'left' : 'right']: 0, width: 8, background: '#fff', cursor: 'ew-resize', touchAction: 'none', borderRadius: side === 'l' ? '4px 0 0 4px' : '0 4px 4px 0' }} />
              ))}
            </div>
          ))}
          {/* eslint-disable-next-line react-hooks/refs -- the handlers only touch refs when the user drags */}
          {caps.map((c) => {
            const sel = selCap === c.id
            const grip = (side: 'l' | 'r') => (
              <span key={side} aria-label={side === 'l' ? 'Change when the caption starts' : 'Change when the caption ends'}
                onPointerDown={(e) => startCapDrag(e, c, side)} onPointerMove={(e) => moveCap(e)} onPointerUp={() => { capDragRef.current = null }} onPointerCancel={() => { capDragRef.current = null }}
                style={{ position: 'absolute', top: 0, bottom: 0, [side === 'l' ? 'left' : 'right']: 0, width: 8, background: '#fff', cursor: 'ew-resize', touchAction: 'none', borderRadius: side === 'l' ? '4px 0 0 4px' : '0 4px 4px 0' }} />
            )
            return (
              <div key={c.id} {...tapEl('caption', c.id)} title={`Caption: ${c.text}. Tap for options, drag to move it, drag the white ends to change how long it shows.`}
                onPointerDown={(e) => startCapDrag(e, c, 'move')} onPointerMove={(e) => moveCap(e)} onPointerUp={() => { capDragRef.current = null }} onPointerCancel={() => { capDragRef.current = null }}
                style={{ position: 'absolute', top: capTop + (capRows[c.id] ?? 0) * 26, height: 22, left: pct(c.start), width: pct(Math.max(0, c.end - c.start)), minWidth: 22, boxSizing: 'border-box', borderRadius: 4, background: sel ? 'var(--coral)' : 'rgba(255,106,77,0.55)', border: `1.5px solid ${sel ? '#fff' : 'var(--coral)'}`, color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', padding: '0 12px', overflow: 'hidden', whiteSpace: 'nowrap', cursor: recording ? 'default' : 'grab', touchAction: 'none' }}>
                <span style={{ pointerEvents: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.text}</span>
                {!recording && grip('l')}
                {!recording && grip('r')}
              </div>
            )
          })}
          <div style={{ position: 'absolute', top: -3, bottom: -3, left: pct(globalTime), width: 2, marginLeft: -1, background: 'var(--ink)', borderRadius: 1, pointerEvents: 'none', zIndex: 4 }} />
          {/* Grab the line anywhere under the clips to drag it (on the clips themselves a press trims or moves a clip) */}
          {!recording && total > 0 && !trimView && (
            <div aria-hidden="true" onPointerDown={startScrub} onPointerMove={moveScrub} onPointerUp={endScrub} onPointerCancel={() => endScrub()} onLostPointerCapture={() => endScrub()}
              style={{ position: 'absolute', top: 26, bottom: -3, left: pct(globalTime), width: 18, marginLeft: -9, cursor: 'ew-resize', touchAction: 'none', zIndex: 5 }} />
          )}
        </div>
        {!mobile && <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span>Drag the line to move through the video</span>
          <span>Clips{onTrimClip ? ' (drag the white ends to trim)' : ''}</span>
          <span>Voiceover</span>
          {musicUrl && <span>Music</span>}
          {ovCount > 0 && <span>{ovCount === 1 ? 'Overlay' : 'Overlays'}</span>}
          {caps.length > 0 && <span>Your captions</span>}
        </div>}
        {!mobile && hasClips && !recording && segments[index] && (clipOps || clipMenu) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{clipOps ? 'Click a clip on the timeline for its speed, audio, crop and delete. Drag the video on the preview to move it, and ctrl + scroll to zoom.' : `Clip ${index + 1}`}</span>
            {clipMenu && (
              <button type="button" aria-label={`More settings for clip ${index + 1}`} aria-expanded={clipMenuOpen} title="Appearance and more for this clip" onClick={() => setClipMenuOpen((o) => !o)}
                style={{ padding: '2px 10px', borderRadius: 4, border: clipMenuOpen ? '1px solid var(--coral)' : '1px solid var(--line)', background: clipMenuOpen ? 'rgba(255,106,77,0.12)' : 'var(--card-bg)', color: 'var(--ink)', fontSize: 18, fontWeight: 700, lineHeight: 1.2, cursor: 'pointer' }}>⋯</button>
            )}
          </div>
        )}
        {!mobile && clipMenu && clipMenuOpen && hasClips && !recording && segments[index] && (
          <div role="region" aria-label={`Settings for clip ${index + 1}`} style={{ marginTop: 10, background: 'var(--sand)', borderRadius: 4, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {clipMenu(index)}
          </div>
        )}
        {clipOps && actionClip !== null && segments[actionClip] && !recording && !cropEdit && typeof document !== 'undefined' && createPortal((() => {
          const i = actionClip
          const lv = clipOps.level(i)
          const sp = segments[i].speed || 1
          const item = (n: string, label: string, onClick: () => void, danger = false) => (
            <button key={n} type="button" onClick={onClick}
              style={{ flex: '1 1 0', minWidth: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', borderRadius: 4, border: 'none', background: 'transparent', color: danger ? '#ff6b5e' : '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              <LineIcon n={n} size={22} />
              {label}
            </button>
          )
          const wide = popView !== 'menu'
          return (
            <div ref={popRef} role="dialog" aria-label={`Clip ${i + 1}`}
              style={{ position: 'fixed', zIndex: 1100, left: popPos?.left ?? -9999, top: popPos?.top ?? -9999, width: wide ? 300 : undefined, maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box', background: 'rgba(28,28,32,0.97)', color: '#fff', borderRadius: 6, padding: 6, boxShadow: '0 6px 24px rgba(0,0,0,0.28)', visibility: popPos ? 'visible' : 'hidden', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif" }}>
              {/* The arrow pointing at the clip */}
              <span aria-hidden="true" style={{ position: 'absolute', left: (popPos?.arrow ?? 20) - 8, [popPos?.below ? 'top' : 'bottom']: -8, width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', [popPos?.below ? 'borderBottom' : 'borderTop']: '8px solid rgba(28,28,32,0.97)' }} />
              {popView === 'menu' && !delConfirm && (
                <div style={{ display: 'flex', gap: 2 }}>
                  {onSpeedClip && item('speed', sp === 1 ? 'Speed' : `${Number(sp.toFixed(2))}x`, () => { if (clipOps.onOpen) { clipOps.onOpen('speed', i); closePop() } else setPopView('speed') })}
                  {item('audio', lv.muted || lv.vol <= 0 ? 'Muted' : 'Audio', () => { if (clipOps.onOpen) { clipOps.onOpen('audio', i); closePop() } else setPopView('audio') })}
                  {item('crop', segments[i].crop ? 'Cropped' : 'Crop', () => startCrop(i))}
                  {!placeIsPlain(segments[i].place) && clipOps.onPlace && item('fit', 'Fit', () => { clipOps.onPlace!(i, null); closePop() })}
                  {clipOps.onDuplicate && item('copy', 'Copy', () => { clipOps.onDuplicate!(i); setActionClip(i + 1) })}
                  {item('bin', 'Delete', () => setDelConfirm(true), true)}
                </div>
              )}
              {popView === 'menu' && delConfirm && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Delete clip {i + 1}?</span>
                  <button type="button" onClick={() => setDelConfirm(false)} style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Keep</button>
                  <button type="button" onClick={() => { clipOps.onDelete(i); closePop() }} style={{ padding: '8px 14px', borderRadius: 4, border: 'none', background: '#D92D20', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                </div>
              )}
              {popView !== 'menu' && (
                <div style={{ padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button type="button" aria-label="Back" onClick={() => setPopView('menu')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex' }}><Icon n="back" /></button>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Clip {i + 1} {popView === 'speed' ? 'speed' : 'audio'}</span>
                  </div>
                  {popView === 'speed' && onSpeedClip && <SpeedSlider value={sp} onChange={(v) => onSpeedClip(i, v)} label="Speed" dark />}
                  {popView === 'audio' && (
                    <>
                      <PopVolume label="Clip audio" value={lv.muted ? 0 : lv.vol} onChange={(v) => { if (v <= 0) { if (!lv.muted) clipOps.onMute(i, true); return } if (lv.muted) clipOps.onMute(i, false); clipOps.onVolume(i, v) }} />
                      <button type="button" onClick={() => { if (lv.muted && lv.vol <= 0) clipOps.onVolume(i, 100); clipOps.onMute(i, !lv.muted) }} style={{ alignSelf: 'flex-start', padding: '7px 12px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.35)', background: lv.muted ? 'var(--coral)' : 'transparent', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{lv.muted ? 'Unmute' : 'Mute'}</button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })(), document.body)}
        {elPop && !recording && typeof document !== 'undefined' && createPortal((() => {
          const dark = { padding: '8px 12px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const
          const red = { ...dark, border: 'none', background: '#D92D20', fontWeight: 700 } as const
          const del = (label: string, run: () => void) => elConfirm
            ? <><button type="button" onClick={() => setElConfirm(false)} style={dark}>Keep</button><button type="button" onClick={() => { run(); setElPop(null); setElConfirm(false) }} style={red}>{label}</button></>
            : <button type="button" onClick={() => setElConfirm(true)} style={{ ...dark, color: '#ff6b5e', borderColor: 'rgba(255,107,94,0.6)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><LineIcon n="bin" size={16} />{label}</button>
          let title = '', body: React.ReactNode = null
          if (elPop.kind === 'take') {
            const ti = takes.findIndex((t) => t.id === elPop.id)
            const t = takes[ti]
            if (!t) return null
            title = `Voiceover ${ti + 1}`
            body = <>
              {tlOps?.onTakeVolume && <PopVolume value={t.volume} onChange={(v) => tlOps.onTakeVolume!(t.id, v)} />}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>{del('Delete', () => onRemoveTake(t.id))}</div>
            </>
          } else if (elPop.kind === 'music') {
            title = 'Music'
            body = <>
              {tlOps?.onMusicVol && <PopVolume value={musicVol} onChange={tlOps.onMusicVol} />}
              {tlOps?.onRemoveMusic && <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>{del('Remove music', tlOps.onRemoveMusic)}</div>}
            </>
          } else if (elPop.kind === 'overlay') {
            const ov = (overlays || []).find((o) => o.id === elPop.id)
            if (!ov) return null
            title = ov.isLogo ? 'Logo' : 'Overlay'
            body = <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {onSelOverlay && !elConfirm && <button type="button" onClick={() => { onSelOverlay(ov.id); setElPop(null) }} style={dark}>Move and resize</button>}
              {tlOps?.onRemoveOverlay && del('Delete', () => tlOps.onRemoveOverlay!(ov.id))}
            </div>
          } else {
            const c = caps.find((x) => x.id === elPop.id)
            if (!c) return null
            title = 'Caption'
            body = <>
              <input value={c.text} aria-label="Caption text" onChange={(e) => onCaptions?.(caps.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, padding: '8px 10px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)', color: '#fff' }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {onSelCap && !elConfirm && <button type="button" onClick={() => { onSelCap(c.id); setElPop(null) }} style={dark}>Move on the video</button>}
                {onCaptions && del('Delete', () => onCaptions(caps.filter((x) => x.id !== c.id)))}
              </div>
            </>
          }
          return (
            <div ref={elRef} role="dialog" aria-label={title}
              style={{ position: 'fixed', zIndex: 1100, left: elPos?.left ?? -9999, top: elPos?.top ?? -9999, width: 300, maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box', background: 'rgba(28,28,32,0.97)', color: '#fff', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.28)', visibility: elPos ? 'visible' : 'hidden', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif" }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: (elPos?.arrow ?? 20) - 8, [elPos?.below ? 'top' : 'bottom']: -8, width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', [elPos?.below ? 'borderBottom' : 'borderTop']: '8px solid rgba(28,28,32,0.97)' }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
              {body}
            </div>
          )
        })(), document.body)}
        {addMenu && addSources?.[addMenu.kind] && typeof document !== 'undefined' && createPortal((() => {
          const src = addSources[addMenu.kind]!
          const row = (n: React.ReactNode, label: string, sub: string, onClick: () => void) => (
            <button type="button" onClick={onClick}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 4, border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
              <span style={{ width: 22, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
              <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{sub}</span></span>
            </button>
          )
          const box = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
          const folder = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
          const lib = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19V5M9 19V5M14 19 18 5M3 19h18" /></svg>
          return (
            <div ref={addMenuRef} role="dialog" aria-label={addMenu.kind === 'video' ? 'Add a video from' : 'Add audio from'}
              style={{ position: 'fixed', zIndex: 1100, left: addMenu.left, top: addMenu.top, width: 240, boxSizing: 'border-box', background: 'rgba(28,28,32,0.97)', borderRadius: 6, padding: 4, boxShadow: '0 6px 24px rgba(0,0,0,0.28)', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif" }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: addMenu.arrow - 8, [addMenu.below ? 'top' : 'bottom']: -8, width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', [addMenu.below ? 'borderBottom' : 'borderTop']: '8px solid rgba(28,28,32,0.97)' }} />
              {addMenu.kind === 'audio' && row(<LineIcon n="mic" size={20} />, 'Record a voiceover', 'Starts where the line is', () => { setAddMenu(null); void startRecording() })}
              {row(lib, 'Library', src.libraryLabel || 'Saved in Reelezy', () => { setAddMenu(null); src.library() })}
              {row(box, 'Photo library', src.photoLabel || 'Videos on this device', () => addPhotoRef.current?.click())}
              {row(folder, 'Files', addMenu.kind === 'video' ? 'A video file' : 'An audio file', () => addFileRef.current?.click())}
            </div>
          )
        })(), document.body)}
        {addSources && (
          <>
            <input ref={addPhotoRef} type="file" hidden accept={addSources[addMenu?.kind ?? 'video']?.photoAccept ?? 'video/*'} multiple={!!addSources[addMenu?.kind ?? 'video']?.multiple}
              onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; const src = addMenu && addSources[addMenu.kind]; setAddMenu(null); if (f.length && src) src.photos(f) }} />
            <input ref={addFileRef} type="file" hidden accept={addSources[addMenu?.kind ?? 'video']?.fileAccept ?? 'video/*'} multiple={!!addSources[addMenu?.kind ?? 'video']?.multiple}
              onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; const src = addMenu && addSources[addMenu.kind]; setAddMenu(null); if (f.length && src) src.files(f) }} />
          </>
        )}
      {takeDrag && (
        <div ref={binRef} aria-label="Bin: drop a voiceover here to delete it"
          style={{ position: 'fixed', left: '50%', bottom: 'calc(6px + env(safe-area-inset-bottom))', transform: `translateX(-50%) scale(${takeDrag.over ? 1.08 : 1})`, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 26px', borderRadius: 4, background: takeDrag.over ? '#d92d20' : 'rgba(30,30,34,0.92)', border: `1.5px dashed ${takeDrag.over ? '#fff' : 'rgba(255,255,255,0.5)'}`, color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: 'none', transition: 'background 0.12s, transform 0.12s', pointerEvents: 'none' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>
          {takeDrag.over ? 'Release to delete' : 'Drop here to delete'}
        </div>
      )}
      </div>

      {micError && <p style={{ fontSize: 11, color: 'var(--coral)', margin: '6px 0 0' }}>{micError}</p>}
    </div>
  )
}

function EditorPreview({ mobile, panelOpen, onClipIndex, screenText, clipOps, cropRequest, addSources, tlOps, segments, takes, originalVol, musicUrl, musicVol, scriptLines, captionStyle, onAddTake, onRemoveTake, onMoveTake, onReorderClip, onDropFiles, captions, onCaptions, onTrimClip, onSpeedClip, overlays, selOverlay, onSelOverlay, onOverlayPatch, appearance, showScript, scriptSpeed = 1, selCap, onSelCap, onPlayhead, autoCap, onAutoCapMove, onAutoCapRemove, onAutoCapSize, autoCapFont, clipMenu, onPickLibrary, below, badge, onBadge }: {
  mobile?: boolean
  panelOpen?: boolean
  onClipIndex?: (i: number) => void
  screenText?: ScreenTextBox | null
  clipOps?: ClipOps
  cropRequest?: { clip: number; n: number } | null
  addSources?: AddSources
  tlOps?: TimelineOps
  below?: React.ReactNode
  badge?: boolean
  onBadge?: (on: boolean) => void
  autoCapFont?: string
  segments: VoiceoverSegment[]
  takes: VoiceTake[]
  originalVol: number
  musicUrl: string | null
  musicVol: number
  scriptLines: string[]
  showScript?: boolean
  scriptSpeed?: number
  selCap?: string | null
  onSelCap?: (id: string | null) => void
  onPlayhead?: (t: number, total: number) => void
  autoCap?: { x: number; y: number } | null
  onAutoCapMove?: (x: number, y: number) => void
  onAutoCapRemove?: () => void
  onAutoCapSize?: (size: number) => void
  // The extra settings for the clip being looked at, shown under the three dots next to its speed
  clipMenu?: (index: number) => React.ReactNode
  onPickLibrary?: () => void
  onAddTake: (blob: Blob, start: number, duration: number) => void
  onRemoveTake: (id: string) => void
  onMoveTake: (id: string, start: number) => void
  onReorderClip?: (from: number, to: number) => void
  captionStyle?: PreviewCaptionStyle
  onDropFiles?: (files: File[]) => void
  captions?: CustomCaption[]
  onCaptions?: (c: CustomCaption[]) => void
  onTrimClip?: (index: number, start: number, end: number, total: number) => void
  onSpeedClip?: (index: number, speed: number) => void
  overlays?: OverlayItem[]
  selOverlay?: string | null
  onSelOverlay?: (id: string | null) => void
  onOverlayPatch?: (id: string, patch: Partial<OverlayItem>) => void
  appearance?: AppearanceSettings
}) {
  const [fileOver, setFileOver] = useState(false)
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files')
  // Start fresh when the clips or trims change (voiceover changes keep the playhead where it is)
  const key = segments.map((s) => previewFileKey(s.file)).join('|')
  return (
    <div
      className={mobile ? 'ed-preview ed-pm' : 'ed-preview'}
      onDragOver={onDropFiles ? (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (!fileOver) setFileOver(true) } : undefined}
      onDragLeave={onDropFiles ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileOver(false) } : undefined}
      onDrop={onDropFiles ? (e) => { if (!hasFiles(e)) return; e.preventDefault(); setFileOver(false); onDropFiles(Array.from(e.dataTransfer.files)) } : undefined}
      style={{ background: 'var(--sand)', borderRadius: 4, padding: 20, position: 'relative', outline: fileOver ? '2px dashed var(--coral)' : 'none', outlineOffset: -2 }}
    >
      {!mobile && <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 12px' }}>Preview</p>}
      {fileOver && (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 5, borderRadius: 4, background: 'rgba(255,106,77,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: 'var(--coral)', fontSize: 16, fontWeight: 700 }}>Drop a video to add it as a clip</div>
      )}
      <EditorPreviewInner key={key} mobile={mobile} panelOpen={panelOpen} onClipIndex={onClipIndex} screenText={screenText} clipOps={clipOps} cropRequest={cropRequest} addSources={addSources} tlOps={tlOps} onDropFiles={onDropFiles} captions={captions} onCaptions={onCaptions} onTrimClip={onTrimClip} onSpeedClip={onSpeedClip} showScript={showScript} scriptSpeed={scriptSpeed} selCap={selCap} onSelCap={onSelCap} onPlayhead={onPlayhead} autoCap={autoCap} onAutoCapMove={onAutoCapMove} onAutoCapRemove={onAutoCapRemove} onAutoCapSize={onAutoCapSize} autoCapFont={autoCapFont} badge={badge} onBadge={onBadge} clipMenu={clipMenu} onPickLibrary={onPickLibrary} overlays={overlays} selOverlay={selOverlay} onSelOverlay={onSelOverlay} onOverlayPatch={onOverlayPatch} appearance={appearance} captionStyle={captionStyle} segments={segments} takes={takes} originalVol={originalVol} musicUrl={musicUrl} musicVol={musicVol} scriptLines={scriptLines} onAddTake={onAddTake} onRemoveTake={onRemoveTake} onMoveTake={onMoveTake} onReorderClip={onReorderClip} />
      {below}
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
  border: active ? '1px solid var(--coral)' : '1px solid var(--line)',
  borderRadius: 4,
  padding: '9px 14px',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--ink)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
}) as const

function MusicPicker({ libraryName, musicFile, extractedPath, extracting, extractError, uploadStatus, onOpenLibrary, onOpenPicker, onClear, onRetry }: {
  libraryName: string | null
  musicFile: File | null
  extractedPath: string | null
  extracting: boolean
  extractError: string
  uploadStatus: ClipUploadState | undefined
  onOpenLibrary: () => void
  onOpenPicker: () => void
  onClear: () => void
  onRetry: () => void
}) {
  const chosen = libraryName ? `${libraryName} (from the music library)` : musicFile ? musicFile.name : extractedPath ? 'Sound taken from your video' : null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>Music</p>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Optional.</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onOpenPicker} disabled={extracting} style={choiceBtn(!!(musicFile || extractedPath) && !libraryName, extracting)}>Pick from the library</button>
        <button type="button" onClick={onOpenLibrary} style={choiceBtn(!!libraryName)}>Browse the music library</button>
      </div>
      {extracting ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 0', display: 'flex', alignItems: 'center' }}><span className="rly-spinner rly-spinner-coral" />Getting the sound from your video...</p>
      ) : chosen ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>Using: {chosen}</span>
          {musicFile && !libraryName && <ClipUploadBadge status={uploadStatus} onRetry={onRetry} />}
          <button type="button" onClick={onClear} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Remove</button>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
          Pick from the library has your saved sounds, a file from your device, or the sound from a video. Skip this to keep your clips&apos; own sound.
        </p>
      )}
      {extractError && <p role="alert" style={{ fontSize: 11, color: 'var(--coral)', margin: '8px 0 0' }}>{extractError}</p>}
    </div>
  )
}

// The tabs over the editor when several filmed videos are open, one per video
// ---- Phone editor ----------------------------------------------------------------------------------------------
// Under 1024px wide the editors open full screen like a phone video app: a top bar, the video, the timeline and a
// row of tools along the bottom that scrolls sideways. Each tool opens its own panel. Desktop is not affected.
const PHONE_EDITOR_QUERY = '(max-width: 1023px)'
function usePhoneEditor() {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(PHONE_EDITOR_QUERY); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => window.matchMedia(PHONE_EDITOR_QUERY).matches,
    () => false,
  )
}

type PhoneTool = { id: string; label: string }
const PHONE_TOOL_ICONS: Record<string, React.ReactNode> = {
  idea: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></>,
  clips: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M8 5v14M16 5v14M3 10h5M3 14h5M16 10h5M16 14h5" /></>,
  crop: <><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></>,
  speed: <><path d="M3.5 15.5a7.5 6.5 0 0 1 15 0z" /><path d="M8.5 9.6 11 15.5M13.5 9.6 11 15.5M3.5 13h15" /><path d="M18.5 13.5h1.8a1.8 1.8 0 0 0 0-3.6h-.6c-.6 0-1.2.6-1.2 1.2" /><path d="M6 15.5 5 18M16 15.5l1 2.5M3.5 15.5 2 16.5" /></>,
  clip: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M8.6 7.6 20 18M8.6 16.4 20 6" /></>,
  audio: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  extract: <><path d="M2 12h2M6 8v8M10 5v14M14 9v6M18 7v10M22 12h-2" /></>,
  voiceover: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  captions: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M7 12h4M13 12h4M7 15.5h7" /></>,
  overlay: <><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
}

function PhoneEditorTop({ title, onBack, action, actionLabel, actionDisabled }: { title: string; onBack: () => void; action: () => void; actionLabel: string; actionDisabled: boolean }) {
  return (
    <div className="ed-mtop" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'calc(8px + env(safe-area-inset-top)) 12px 8px', borderBottom: '1px solid var(--line)', background: 'var(--card-bg)' }}>
      <button type="button" onClick={onBack} aria-label="Leave the editor" style={{ width: 38, height: 38, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 16 }}><Icon n="back" /></button>
      <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
      <button type="button" onClick={action} disabled={actionDisabled} data-tour="create-video"
        style={{ flexShrink: 0, height: 38, padding: '0 16px', borderRadius: 4, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: actionDisabled ? 'default' : 'pointer', opacity: actionDisabled ? 0.5 : 1, whiteSpace: 'nowrap' }}>{actionLabel}</button>
    </div>
  )
}

function PhoneEditorNav({ tools, active, onPick }: { tools: PhoneTool[]; active: string | null; onPick: (id: string | null) => void }) {
  return (
    <nav className="ed-mnav" aria-label="Editing tools" style={{ display: 'flex', gap: 4, overflowX: 'auto', padding: '6px 8px calc(6px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--line)', background: 'var(--card-bg)', scrollbarWidth: 'none' }}>
      {tools.map((t, ti) => {
        const on = active === t.id
        // The auto margins on the first and last buttons centre the row when it fits, and still let it scroll when it does not
        return (
          <button key={t.id} type="button" aria-pressed={on} onClick={() => onPick(on ? null : t.id)}
            style={{ flex: '0 0 auto', minWidth: 64, marginLeft: ti === 0 ? 'auto' : undefined, marginRight: ti === tools.length - 1 ? 'auto' : undefined, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 8px', borderRadius: 4, border: 'none', background: on ? 'rgba(255,106,77,0.12)' : 'transparent', color: on ? 'var(--coral)' : 'var(--ink)', fontSize: 11, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PHONE_TOOL_ICONS[t.id]}</svg>
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}

// The title strip at the top of an open tool panel, with Done to close it
function PhonePanelHead({ title, onDone }: { title: string; onDone: () => void }) {
  return (
    <div className="ed-mhead" style={{ position: 'sticky', top: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--sand)', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
      <button type="button" onClick={onDone} style={{ background: 'none', border: 'none', color: 'var(--coral)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}>Done</button>
    </div>
  )
}

function EditorTabsBar({ tabs, active, note, onSwitch, onClose }: { tabs: { key: string; title: string; status: string }[]; active: number; note: string; onSwitch: (i: number) => void; onClose: () => void }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div role="tablist" aria-label="Your filmed videos" style={{ display: 'flex', alignItems: 'stretch', gap: 2, borderBottom: '1px solid var(--line)', overflowX: 'auto', scrollbarWidth: 'thin' }}>
        {tabs.map((t, i) => {
          const on = i === active
          return (
            <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => onSwitch(i)} title={t.title}
              style={{ background: on ? 'var(--sand)' : 'none', border: 'none', borderBottom: on ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 18px', fontSize: 13, fontWeight: on ? 700 : 500, color: on ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', maxWidth: 260, display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Video {i + 1}: {t.title}</span>
              {t.status && <span style={{ fontSize: 11, fontWeight: 700, color: t.status === 'Ready' ? '#1a7f37' : t.status === 'Failed' ? '#d92d20' : 'var(--coral)' }}>{t.status}</span>}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, flex: 1, minWidth: 200 }}>Each video has its own clips, audio, captions and overlays. Render renders only the video you are looking at.</p>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>Close the other videos</button>
      </div>
      {note && <p role="alert" style={{ fontSize: 12, color: 'var(--coral)', margin: '6px 0 0' }}>{note}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const carouselInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [libraryPicker, setLibraryPicker] = useState<null | 'any' | 'ai' | 'film' | 'slot' | 'step'>(null)
  // The Audio section's Pick from the library pop-up (saved sounds, a file, or the sound from a video)
  const [musicPicker, setMusicPicker] = useState(false)
  // The "Made with Reelezy" badge in the corner of the video. On unless the person removes it in the preview.
  const [madeWithBadge, setMadeWithBadge] = useState(true)
  // Which clip spot the library picker is filling (an upload slot id, or an AI step number)
  const [libraryTarget, setLibraryTarget] = useState<number>(0)
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
  // Scripts page: which saved script is open, copy feedback, and the confirm step for deleting
  const [openScriptId, setOpenScriptId] = useState<string | null>(null)
  const [scriptCopied, setScriptCopied] = useState<string | null>(null)
  const [confirmScriptDelete, setConfirmScriptDelete] = useState<string | null>(null)
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
  const [tourRun, setTourRun] = useState(0)
  // The Take the tour button is only shown to people who have not finished the tour
  const [tourDone, setTourDone] = useState(false)
  useEffect(() => {
    if (!userId) return
    const t = setTimeout(() => {
      let local = false
      try { local = localStorage.getItem(`reelly-tour-v1:${userId}`) === 'done' } catch { /* no storage: ask the account instead */ }
      if (local) { setTourDone(true); return }
      supabase.auth.getUser().then(({ data }) => { if (data.user?.user_metadata?.reelezy_tour === 'done') setTourDone(true) }).catch(() => {})
    }, 0)
    return () => clearTimeout(t)
  }, [userId])
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
  // Ideas whose video was made or whose filming card was cleared. Kept so they can be filmed again.
  const [archivedFilming, setArchivedFilming] = useState<ArchivedFilmingItem[]>([])
  const [showArchive, setShowArchive] = useState(false)
  const [archiveOpenId, setArchiveOpenId] = useState<string | null>(null)
  const [archiveQuery, setArchiveQuery] = useState('')
  const filmingItemsRef = useRef<FilmingItem[]>([])
  useEffect(() => { filmingItemsRef.current = filmingItems }, [filmingItems])
  const archiveFilming = (items: FilmingItem[]) => {
    if (!items.length) return
    setArchivedFilming((prev) => {
      const ids = new Set(items.map((i) => i.id))
      return [...items.map((i) => ({ ...i, createdAt: (i as ArchivedFilmingItem).createdAt || new Date().toISOString() })), ...prev.filter((a) => !ids.has(a.id))]
    })
  }
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
  const [appearance, setAppearance] = useState<AppearanceSettings>({ touchUp: 0, light: 0, look: 'none' })
  // What is sent to the render, or nothing when every setting is off
  const appearancePayload = appearance.touchUp > 0 || appearance.light > 0 || appearance.look !== 'none' ? appearance : null
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
  const [filmClipDraft, setFilmClipDraft] = useState<string | null>(null)
  const [filmOriginal, setFilmOriginal] = useState<{ script: string; actions: string } | null>(null)
  const [filmScrollSpeed, setFilmScrollSpeed] = useState(1)
  const filmScrollSpeedRef = useRef(1)
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
  // Scenes the person asked for with the number box. Only the filming instructions are reshaped to it; the script is never touched.
  const [filmSceneCount, setFilmSceneCount] = useState<number | null>(null)
  const [filmSceneNote, setFilmSceneNote] = useState('')
  const [filmDurations, setFilmDurations] = useState<(number | null)[]>([])
  const [filmClips, setFilmClips] = useState<{ blob: Blob; ext: string; type: string; url: string }[]>([])
  const filmSegFiles = useMemo(() => filmClips.map((c, i) => new File([c.blob], `film-${i}.${c.ext}`, { type: c.type })), [filmClips])
  const [filmPending, setFilmPending] = useState<{ blob: Blob; ext: string; type: string; url: string } | null>(null)
  const [uploadSlots, setUploadSlots] = useState<number[]>([0])
  const [uploadSlotFiles, setUploadSlotFiles] = useState<Record<number, File>>({})
  const [uploadTrims, setUploadTrims] = useState<Record<number, ClipTrimRange>>({})
  const [aiTrims, setAiTrims] = useState<Record<number, ClipTrimRange>>({})
  const [uploadSpeeds, setUploadSpeeds] = useState<Record<number, number>>({})
  // Appearance chosen for one clip. A clip with none here uses the setting for every clip.
  const [uploadLooks, setUploadLooks] = useState<Record<number, AppearanceSettings>>({})
  const [aiLooks, setAiLooks] = useState<Record<number, AppearanceSettings>>({})
  const [aiSpeeds, setAiSpeeds] = useState<Record<number, number>>({})
  // Each clip's own volume (0 to 100). A clip with none here plays at full volume, then the master volume applies on top.
  const [uploadVols, setUploadVols] = useState<Record<number, number>>({})
  const [aiVols, setAiVols] = useState<Record<number, number>>({})
  // Clips switched to silent with their mute button (their volume is kept for when they are unmuted)
  const [uploadMuted, setUploadMuted] = useState<Record<number, boolean>>({})
  // On-screen text typed into the box on the preview, per clip. It replaces the text from the filming instructions.
  const [uploadScreenTexts, setUploadScreenTexts] = useState<Record<number, string>>({})
  const [aiScreenTexts, setAiScreenTexts] = useState<Record<number, string>>({})
  // The part of each clip's picture to keep, set with Crop
  const [uploadCrops, setUploadCrops] = useState<Record<number, ClipCrop>>({})
  const [aiCrops, setAiCrops] = useState<Record<number, ClipCrop>>({})
  const [uploadPlaces, setUploadPlaces] = useState<Record<number, ClipPlace>>({})
  const [aiPlaces, setAiPlaces] = useState<Record<number, ClipPlace>>({})
  // The phone's Edit clip panel asks the preview to start cropping
  const [cropRequest, setCropRequest] = useState<{ clip: number; n: number } | null>(null)
  const [aiMuted, setAiMuted] = useState<Record<number, boolean>>({})
  const muteUploadClip = (id: number, on: boolean) => setUploadMuted((prev) => { const n = { ...prev }; if (on) n[id] = true; else delete n[id]; return n })
  const muteAiClip = (id: number, on: boolean) => setAiMuted((prev) => { const n = { ...prev }; if (on) n[id] = true; else delete n[id]; return n })
  const filmSpeedRef = useRef(1)
  const filmClipSpeedsRef = useRef<Record<string, number>>({})
  const [filmSpeed, setFilmSpeed] = useState(1)
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
  const [overlays, setOverlays] = useState<OverlayItem[]>([])
  const [selOverlay, setSelOverlay] = useState<string | null>(null)
  const [overlayError, setOverlayError] = useState('')
  const overlayUploadRef = useRef(new Map<File, string>())
  const overlaySeq = useRef(0)
  const [overlayPicker, setOverlayPicker] = useState(false)
  // The logo saved in Settings (undefined while loading, null when there is none)
  const [bizLogoUrl, setBizLogoUrl] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    if (!userId) return
    let off = false
    supabase.from('business_profiles').select('logo_url').eq('user_id', userId).maybeSingle().then(({ data }) => { if (!off) setBizLogoUrl((data?.logo_url as string | null | undefined) || null) })
    return () => { off = true }
  }, [userId])
  // How many scenes the filming instructions should have. null means let the AI decide.
  const [sceneCount, setSceneCount] = useState<number | null>(null)
  const [aiSingleClipMode, setAiSingleClipMode] = useState(false)
  const [uploadSpeechSlots, setUploadSpeechSlots] = useState<Set<number>>(new Set())
  const [uploadLandscapeSlots, setUploadLandscapeSlots] = useState<Set<number>>(new Set())
  const [uploadAddCaptions, setUploadAddCaptions] = useState(true)
  const [cutDeadSpace, setCutDeadSpace] = useState(true)
  // A voiceover switches Cut silences off, unless the person has switched it back on while they had a voiceover
  const [trimKeptOn, setTrimKeptOn] = useState(false)
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
  // Where the music starts in the video, in seconds (below 0 skips the start of the song). Dragged on the timeline.
  const [musicStart, setMusicStart] = useState(0)
  const [voiceScript, setVoiceScript] = useState<{ id: string; label: string; lines: string[] } | null>(null)
  // Opened from Audio > Record voiceover: shows the script on the preview before recording starts
  const [scriptOpen, setScriptOpen] = useState(false)
  const [audioPicker, setAudioPicker] = useState(false)
  const [scriptSpeed, setScriptSpeed] = useState(1)
  const [selCap, setSelCap] = useState<string | null>(null)
  // Several filmed videos open in the editor at once: one tab each. The tab being looked at lives in the normal editor state,
  // the others wait in their snapshots.
  const [editorTabs, setEditorTabs] = useState<{ key: string; title: string; snap: EditorSnap | null }[]>([])
  const [editorTab, setEditorTab] = useState(0)
  const [editorTabNote, setEditorTabNote] = useState('')
  const [capDraft, setCapDraft] = useState('')
  // One look for every caption the person types: picking a style or changing the font, size or colours changes all of them
  const [ownLook, setOwnLook] = useState<{ font: string; size: number; color: string; bg: string | null; bold?: boolean; italic: boolean; underline: boolean }>({ font: 'Sans Bold', size: 60, color: '#FFFFFF', bg: null, italic: false, underline: false })
  const playheadRef = useRef({ t: 0, total: 0 })
  // Phone editor: which tool panel is open, and the clip the Edit clip panel is showing
  const phone = usePhoneEditor()
  const [mTool, setMTool] = useState<string | null>(null)
  const [mClip, setMClip] = useState(0)
  const extractInputRef = useRef<HTMLInputElement | null>(null)
  const handlePlayhead = useCallback((t: number, total: number) => { playheadRef.current = { t, total } }, [])
  // Original sound stays full volume on its own and drops under a voiceover until the user picks a level
  const originalVol = originalVolPick ?? (voiceTakes.length > 0 ? 35 : 100)
  const [assetPaths, setAssetPaths] = useState<Record<string, string>>({})
  const [landscapeHandling, setLandscapeHandling] = useState<'crop' | 'blur' | 'landscape'>('blur')
  const [extractedMusicPath, setExtractedMusicPath] = useState<string | null>(null)
  const [captionColor, setCaptionColor] = useState('#FFFFFF')
  const [captionBold, setCaptionBold] = useState<boolean | null>(null)
  const [captionItalic, setCaptionItalic] = useState(false)
  const [captionUnderline, setCaptionUnderline] = useState(false)
  // Optional coloured box behind the captions. null means transparent.
  const [captionBg, setCaptionBg] = useState<string | null>(null)
  const [captionPosition, setCaptionPosition] = useState<'bottom' | 'top' | 'center'>('center')
  const [captionLayers, setCaptionLayers] = useState<CaptionLayers>(DEFAULT_CAPTION_LAYERS)
  const moveAutoCap = useCallback((x: number, y: number) => setCaptionLayers((l) => ({ ...l, speech: { ...l.speech, x, y } })), [])

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
        .select('business_name, industry, suburb, target_locations, website, country, tone, target_audience, core_services, custom_guidance, location_type, local_seasonal_context, brand_personality, words_to_avoid, signature_service, common_objections, current_promotions, customer_problem, key_selling_point, on_camera_people, video_people_count, years_in_business, team_size, upcoming_launches, past_content, worst_content, preferred_formats, competitor_content, equipment, community_ties, notes, price_positioning, customer_source, filming_comfort')
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

        const toFilming = (r: Record<string, unknown>): ArchivedFilmingItem => { const c = r.checklist as { steps?: string[]; prep?: string[]; caption?: string; script?: string; directions?: string[] }; return { ...toIdea(r), checklist: c.steps || [], prep: c.prep || [], caption: c.caption || "", script: c.script || "", directions: Array.isArray(c.directions) ? c.directions : [], createdAt: (r.created_at as string) || undefined } }
        const byNewest = (a: Record<string, unknown>, b: Record<string, unknown>) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
        const filmingRows = (allIdeas || []).filter((r) => r.checklist && r.filming_cleared !== true).sort(byNewest)
        if (filmingRows.length > 0) {
          setFilmingItems(filmingRows.map(toFilming))
        }
        const archivedRows = (allIdeas || []).filter((r) => r.checklist && r.filming_cleared === true).sort(byNewest)
        setArchivedFilming(archivedRows.map(toFilming))
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
    const topic = data.clearedScriptTitle
    const done = filmingItemsRef.current.filter((f) => (id && f.id === id) || (topic && f.source === 'script' && f.title === topic))
    if (done.length) archiveFilming(done)
    if (id) {
      setDbSavedIdeas((prev) => prev.filter((i) => i.id !== id))
      setSavedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
      setFilmingItems((prev) => prev.filter((f) => f.id !== id))
      setSelectedIdeaIdsForFilming((prev) => prev.filter((x) => x !== id))
    }
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

  // A render that fails puts the editor back the way it was, so nothing has to be added again
  useEffect(() => {
    const keep = uploadFailRestoreRef.current
    if (!keep || renderStatus === 'queued' || renderStatus === 'rendering' || renderStatus === null) return
    if (keep.id !== renderId) return
    uploadFailRestoreRef.current = null
    if (renderStatus !== 'failed') return
    // Only if they have not started on something new since
    if (uploadSlots.some((id) => uploadSlotFiles[id] || uploadSlotPaths[id]) || voiceTakes.length > 0) return
    const err = renderError
    applyEditor({ ...keep.snap, renderId, renderStatus: 'failed', renderProgress: 0, outputUrl: null, overQuota: renderOverQuota, renderError: err, uploadError: '' })
    if (keep.snap.ctx) filmRenderContextRef.current = keep.snap.ctx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderStatus, renderId])
  useEffect(() => {
    const keep = aiFailRestoreRef.current
    if (!keep || aiRenderStatus === 'queued' || aiRenderStatus === 'rendering' || aiRenderStatus === null) return
    if (keep.id !== aiRenderId) return
    aiFailRestoreRef.current = null
    if (aiRenderStatus !== 'failed' || voiceTakes.length > 0) return
    setVoiceTakes(keep.takes)
    if (keep.musicFile) setMusicFile(keep.musicFile)
    if (keep.extracted) setExtractedMusicPath(keep.extracted)
    const st: Record<string, ClipUploadState> = {}
    Object.entries(keep.assets).forEach(([k, path]) => { if (k === 'm' || k.startsWith('v:')) { clipUploadPromises.set(k, Promise.resolve(path)); st[k] = 'done' } })
    setAssetPaths((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(keep.assets).filter(([k]) => k === 'm' || k.startsWith('v:'))) }))
    setClipUploadStatus((prev) => ({ ...prev, ...st }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiRenderStatus, aiRenderId])


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
  const filmActions = splitActionLines(filmActionsText)
  const filmClipCount = Math.max(filmSceneCount ?? 0, filmLines.length, filmActions.length)
  const filmCurrentLine = filmLines[filmLineIdx] || ''
  const filmDraftKey = userId && filmSelectedId ? `reelezy-film-draft:${userId}:${filmSelectedId}` : null
  // Auto-saves edits to the script and actions, so they are still there next time this idea is picked
  useEffect(() => {
    if (!filmDraftKey || !filmOriginal) return
    const t = setTimeout(() => {
      try {
        if (filmScript !== filmOriginal.script || filmActionsText !== filmOriginal.actions) localStorage.setItem(filmDraftKey, JSON.stringify({ script: filmScript, actions: filmActionsText }))
        else localStorage.removeItem(filmDraftKey)
      } catch { /* storage unavailable */ }
    }, 700)
    return () => clearTimeout(t)
  }, [filmDraftKey, filmOriginal, filmScript, filmActionsText])
  const filmEdited = !!filmOriginal && (filmScript !== filmOriginal.script || filmActionsText !== filmOriginal.actions)
  const applyFilmClipCount = (raw: string) => {
    setFilmClipDraft(null)
    const asked = Math.round(Number(raw))
    if (!Number.isFinite(asked) || asked < 1 || asked > 15 || asked === filmClipCount) return
    // Every script line is its own scene, so the number cannot go below the script's lines
    const n = Math.max(asked, filmLines.length)
    setFilmSceneNote(n > asked ? `Your script has ${filmLines.length} lines, so that is the fewest scenes. Delete script lines to go lower.` : '')
    setFilmSceneCount(n)
    // The script and actions stay exactly as typed. Scenes past the end of either one show "No script" or "No action".
    setFilmDurations([])
    setFilmLineIdx(0)
    setFilmClips([])
    setFilmReview(false)
    setFilmRedoIdx(null)
  }
  const resetFilmEdits = () => {
    if (!filmOriginal) return
    setFilmScript(filmOriginal.script)
    setFilmActionsText(filmOriginal.actions)
    setFilmSceneCount(null)
    setFilmSceneNote('')
    setFilmDurations([])
    setFilmLineIdx(0)
    setFilmClips([])
    setFilmReview(false)
    setFilmRedoIdx(null)
    try { if (filmDraftKey) localStorage.removeItem(filmDraftKey) } catch { /* storage unavailable */ }
  }
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
      const secs = Math.max(2, words / (SCRIPT_WORDS_PER_SEC * clampScriptSpeed(filmScrollSpeedRef.current)))
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
    const first = (t.match(/^[^.!?]+[.!?]?/)?.[0] || t).trim().replace(/[.!?]+$/, '')
    const one = first.split(/,\s+(?:then|and then|while|as|so)\s+/i)[0].trim()
    // Every action ends with a full stop, so the Film tab knows where one scene ends and the next begins
    return one ? `${one}.` : one
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
    return { lines: groupFilmList(lines, n, ' '), actions: groupFilmList(actions, n, ' '), durations: Array.from({ length: n }, (_, i) => actions.length === n ? (durations[i] ?? null) : sumGroup(i)) }
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
    const origScript = lines.join('\n')
    const origActions = actions.join('\n')
    let nextScript = origScript
    let nextActions = origActions
    let nextDurations = durations
    if (id && userId) {
      try {
        const raw = localStorage.getItem(`reelezy-film-draft:${userId}:${id}`)
        const d = raw ? JSON.parse(raw) : null
        if (d && typeof d.script === 'string' && typeof d.actions === 'string') { nextScript = d.script; nextActions = d.actions; nextDurations = [] }
      } catch { /* ignore a bad draft */ }
    }
    setFilmOriginal(id ? { script: origScript, actions: origActions } : null)
    setFilmScript(nextScript)
    setFilmActionsText(nextActions)
    setFilmSceneCount(null)
    setFilmSceneNote('')
    setFilmDurations(nextDurations)
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
        const pendingUrl = URL.createObjectURL(blob)
        filmClipSpeedsRef.current[pendingUrl] = filmSpeedRef.current
        setFilmPending({ blob, ext, type: baseType, url: pendingUrl })
      }
      recorder.onerror = () => { setFilmRecordError('Recording stopped unexpectedly. Please try again.'); setFilmIsRecording(false) }
      // The encoder warms up during the countdown, so the camera does not freeze when recording starts
      const warm = cam.timer > 0 && beginRecorderPaused(recorder, mimeType)
      for (let n = cam.timer; n > 0; n--) {
        setFilmCountdown(n)
        await new Promise(r => setTimeout(r, 1000))
      }
      setFilmCountdown(null)
      if (warm) resumeRecorder(recorder)
      else beginRecorder(recorder, mimeType)
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
    bold: captionBold ?? undefined,
    italic: captionItalic || undefined,
    underline: captionUnderline || undefined,
    size: Number(captionFontSize) || 60,
    onScreen: layerPoint(captionLayers, 'onScreen', captionPosition),
    speech: layerPoint(captionLayers, 'speech', captionPosition),
  }

  // Captions are sent as plain data: text, when it shows and where it sits
  const customCaptionStyle = { fontFamily: captionFontFamily, size: Number(captionFontSize) || 60, color: captionColor, borderColor: captionBorderColor, backgroundColor: captionBg ?? undefined, bold: captionBold ?? undefined, italic: captionItalic || undefined, underline: captionUnderline || undefined }
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

  const setSpeedFor = (setter: React.Dispatch<React.SetStateAction<Record<number, number>>>, key: number | undefined, speed: number) => {
    if (key === undefined) return
    setter((prev) => { const n = { ...prev }; if (speed === 1) delete n[key]; else n[key] = speed; return n })
  }
  const speedUploadClip = (i: number, speed: number) => setSpeedFor(setUploadSpeeds, uploadSlots.filter((slot) => uploadSlotFiles[slot])[i], speed)
  const speedAiClip = (i: number, speed: number) => setSpeedFor(setAiSpeeds, Object.keys(stepUploads).map(Number).sort((a, b) => a - b)[i], speed)
  const changeFilmClipSpeed = (speed: number) => { filmSpeedRef.current = speed; setFilmSpeed(speed) }

  // The Audio section: original sound, voiceover and music in their own card
  const renderAudioSection = (musicTarget: 'upload' | 'ai', scriptLabel?: string, noScriptFor?: string) => (
    <CollapsibleBox title="Audio" summary={[`Master volume ${originalVol === 0 ? 'off' : `${originalVol}%`}`, voiceTakes.length > 0 ? `${voiceTakes.length} voiceover${voiceTakes.length === 1 ? '' : 's'}` : '', extractedMusicPath ? 'Sound from a video' : (libraryMusicName || musicFile?.name) ? 'Music added' : 'No music'].filter(Boolean).join(' · ')}>
      <AudioPanel
        section="rest"
        takes={voiceTakes}
        originalVol={originalVol}
        onOriginalVol={setOriginalVolPick}
        hasMusic={!!(musicFile || libraryMusicUrl || extractedMusicPath)}
        musicVol={musicVol}
        onMusicVol={setMusicVol}
        onTakeVolume={setTakeVolume}
        scriptLabel={scriptLabel}
        noScriptFor={noScriptFor}
        scriptSpeed={scriptSpeed}
        onScriptSpeed={setScriptSpeed}
        scriptOpen={scriptOpen}
        onToggleScript={() => { if (!scriptOpen) document.querySelector('.ed-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setScriptOpen(!scriptOpen) }}
        onPickLibraryAudio={() => setAudioPicker(true)}
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
            onOpenPicker={() => setMusicPicker(true)}
            onClear={clearMusic}
            onRetry={() => { if (musicFile) startAssetUpload('m', musicFile, musicFile.name) }}
          />
        }
      />
    </CollapsibleBox>
  )

  // The voiceover settings have their own box under Audio. Recording itself starts from the button under the preview.
  const renderVoiceoverSection = (scriptLabel?: string, noScriptFor?: string) => (
    <div>
      <CollapsibleBox title="Voiceover" summary={voiceTakes.length > 0 ? `${voiceTakes.length} voiceover${voiceTakes.length === 1 ? '' : 's'}` : 'Record or upload a voiceover'}>
        <AudioPanel
        section="voiceover"
        takes={voiceTakes}
        originalVol={originalVol}
        onOriginalVol={setOriginalVolPick}
        hasMusic={!!(musicFile || libraryMusicUrl || extractedMusicPath)}
        musicVol={musicVol}
        onMusicVol={setMusicVol}
        onTakeVolume={setTakeVolume}
        scriptLabel={scriptLabel}
        noScriptFor={noScriptFor}
        scriptSpeed={scriptSpeed}
        onScriptSpeed={setScriptSpeed}
        scriptOpen={scriptOpen}
        onToggleScript={() => { if (!scriptOpen) document.querySelector('.ed-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setScriptOpen(!scriptOpen) }}
        onPickLibraryAudio={() => setAudioPicker(true)}
        onAddFile={uploadVoiceFile}
        onRemoveTake={removeVoiceTake}
        statuses={clipUploadStatus}
        onRetry={(id) => { const t = voiceTakes.find((x) => x.id === id); if (t) startAssetUpload(`v:${id}`, t.blob, 'voiceover') }}
        musicPicker={null}
      />
      </CollapsibleBox>
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
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: on ? '0 0 12px' : '6px 0 0' }}>
          {on
            ? 'Listens to the voice in your clips and adds the words you say as captions, a few at a time. They are added when your video renders. The preview shows a marker instead: drag it to choose where the captions sit, or press the x on it to turn them off.'
            : 'Off. Turn this on to add the words you speak as captions.'}
        </p>
        {on && (
          <>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>Choose how the words appear:</p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 0 }}>
                            {CAPTION_PRESETS.map((preset) => (
                              <button key={preset.id} title={preset.desc} onClick={() => setPreset(preset.id)}
                                style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 4, border: chosenPreset === preset.id ? '2px solid var(--coral)' : '1px solid var(--line)', background: chosenPreset === preset.id ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', cursor: 'pointer' }}>
                                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, color: chosenPreset === preset.id ? 'var(--coral)' : 'var(--ink)' }}>{preset.label}</p>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.35, margin: 0 }}>{preset.desc}</p>
                              </button>
                            ))}
                          </div>
                          <div style={{ marginTop: 14 }}>{renderCaptionStyle()}</div>
          </>
        )}
      </div>
    )
  }

  // How the auto captions look: font, size, colours. It sits inside the Auto captions box.
  const renderCaptionStyle = () => {
    const font = CAPTION_TEXT_FONTS.find((f) => f.name === toCaptionFont(captionFontFamily))!
    const lab = { fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-muted)' } as const
    const bold = captionBold ?? fontIsBold(font.name)
    return (
      <div>
        <div style={{ background: '#111', borderRadius: 4, height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden', position: 'relative' }}>
          <p style={{ fontFamily: font.css, fontSize: Math.min(Number(captionFontSize) * 0.44, 28), fontWeight: bold ? Math.max(700, font.weight) : 400, fontStyle: captionItalic ? 'italic' : 'normal', textDecoration: captionUnderline ? 'underline' : 'none', color: captionColor, WebkitTextStroke: `2px ${captionBorderColor}`, paintOrder: 'stroke fill', letterSpacing: 1, textAlign: 'center', margin: 0, background: captionBg ?? 'transparent', padding: captionBg ? '4px 12px' : 0, borderRadius: 4 }}>The words you speak</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, alignItems: 'end', background: 'var(--card-bg)', padding: 14, borderRadius: 4 }}>
          <div><label style={lab}>Font</label><Dropdown ariaLabel="Auto caption font" value={font.name} onChange={setCaptionFontFamily} options={FONT_MENU} /></div>
          <div><label style={lab}>Size</label><input type="text" inputMode="numeric" value={captionFontSize} onFocus={(e) => e.target.select()} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); setCaptionFontSize(v || '') }} onBlur={(e) => { const v = Number(e.target.value); setCaptionFontSize(v >= 10 ? v : 36) }} style={{ ...inputStyle, marginBottom: 0, fontSize: 13, height: 40 }} /></div>
          <div><label style={lab}>Colour</label><ColorSelect ariaLabel="Auto caption text colour" value={captionColor} onChange={(v) => setCaptionColor(v ?? '#FFFFFF')} /></div>
          <div><label style={lab}>Text</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {([['B', 'Bold', bold, () => setCaptionBold(!bold), { fontWeight: 800 }],
                ['I', 'Italic', captionItalic, () => setCaptionItalic(!captionItalic), { fontStyle: 'italic' }],
                ['U', 'Underline', captionUnderline, () => setCaptionUnderline(!captionUnderline), { textDecoration: 'underline' }]] as const).map(([ch, name, on, toggle, st]) => (
                <button key={name} type="button" aria-pressed={on} aria-label={name} title={name} onClick={toggle} style={{ ...choiceBtn(on), width: 40, height: 40, padding: 0, fontSize: 15, ...st }}>{ch}</button>
              ))}
            </div></div>
          <div style={{ gridColumn: 'span 2' }}><label style={lab}>Background</label>
            <ColorSelect ariaLabel="Auto caption background colour" allowNone value={captionBg} onChange={setCaptionBg} /></div>
        </div>
      </div>
    )
  }

  // The one style editor for the captions the person types. Every typed caption shares it.
  const renderOwnCaptionStyle = (caps: CustomCaption[], setCaps: (c: CustomCaption[]) => void) => {
    const lab = { fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-muted)' } as const
    const set = (patch: Partial<typeof ownLook>) => {
      const next = { ...ownLook, ...patch }
      setOwnLook(next)
      setCaps(caps.map((c) => ({ ...c, font: next.font, size: 'size' in patch ? next.size : c.size ?? next.size, color: next.color, bg: next.bg, bold: next.bold, italic: next.italic, underline: next.underline })))
    }
    const font = CAPTION_TEXT_FONTS.find((f) => f.name === ownLook.font) ?? CAPTION_TEXT_FONTS[0]
    const bold = ownLook.bold ?? fontIsBold(font.name)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
        <div>
          <label style={lab}>Style</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CAPTION_LOOKS.map((lk) => {
              const f = CAPTION_TEXT_FONTS.find((x) => x.name === lk.font)
              const on = ownLook.font === lk.font && ownLook.color === lk.color && ownLook.bg === lk.bg
              return (
                <button key={lk.name} type="button" aria-pressed={on} title={`${lk.name}: ${f?.label ?? lk.font}, ${lk.bg ? 'on a coloured box' : 'no box'}`} onClick={() => set({ font: lk.font, color: lk.color, bg: lk.bg, bold: undefined, italic: false, underline: false })}
                  style={{ minWidth: 78, padding: '6px 8px', borderRadius: 4, border: on ? '2px solid var(--coral)' : '1px solid var(--line)', background: '#2a2a2f', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontFamily: f?.css, fontWeight: f?.weight, fontSize: 15, color: lk.color, background: lk.bg ?? 'transparent', padding: lk.bg ? '1px 6px' : 0, borderRadius: 2, textShadow: lk.bg ? 'none' : '0 0 2px #000, 0 0 2px #000' }}>Aa</span>
                  <span style={{ fontSize: 10, color: '#ddd' }}>{lk.name}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, alignItems: 'end', background: 'var(--card-bg)', padding: 14, borderRadius: 4 }}>
          <div><label style={lab}>Font</label><Dropdown ariaLabel="Caption font" value={font.name} onChange={(v) => set({ font: v })} options={FONT_MENU} /></div>
          <div><label style={lab}>Size</label>
            <input type="number" min={16} max={200} value={ownLook.size} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && e.target.value !== '') set({ size: Math.min(200, Math.max(16, n)) }) }} style={{ ...inputStyle, marginBottom: 0, fontSize: 13, height: 40 }} /></div>
          <div><label style={lab}>Colour</label><ColorSelect ariaLabel="Caption text colour" value={ownLook.color} onChange={(v) => set({ color: v ?? '#FFFFFF' })} /></div>
          <div><label style={lab}>Text</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {([['B', 'Bold', bold, () => set({ bold: !bold }), { fontWeight: 800 }],
                ['I', 'Italic', ownLook.italic, () => set({ italic: !ownLook.italic }), { fontStyle: 'italic' }],
                ['U', 'Underline', ownLook.underline, () => set({ underline: !ownLook.underline }), { textDecoration: 'underline' }]] as const).map(([ch, name, on, toggle, st]) => (
                <button key={name} type="button" aria-pressed={on} aria-label={name} title={name} onClick={toggle} style={{ ...choiceBtn(on), width: 40, height: 40, padding: 0, fontSize: 15, ...st }}>{ch}</button>
              ))}
            </div></div>
          <div style={{ gridColumn: 'span 2' }}><label style={lab}>Background</label>
            <ColorSelect ariaLabel="Caption background colour" allowNone value={ownLook.bg} onChange={(v) => set({ bg: v })} /></div>
        </div>
      </div>
    )
  }

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
      setCaps([...caps, { id, text: text.slice(0, 140), start, end, x: 0.5, y: Math.max(0.2, 0.72 - stacked * 0.12), font: ownLook.font, size: ownLook.size, color: ownLook.color, bg: ownLook.bg, bold: ownLook.bold, italic: ownLook.italic, underline: ownLook.underline }])
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
            style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13 }} />
          <button type="button" onClick={add} disabled={!canAdd || !capDraft.trim()} style={{ ...choiceBtn(false, !canAdd || !capDraft.trim()), flexShrink: 0 }}>Add caption</button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
          Shows for 3 seconds at the playhead. Drag it on the preview to place it. Select it, then drag a side handle to move that side of the box, or a corner to make the caption bigger or smaller.
        </p>
        {caps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {caps.map((c) => (
              <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" value={c.text} maxLength={140} aria-label="Edit caption" onFocus={() => setSelCap(c.id)}
                  onChange={(e) => setCaps(caps.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))}
                  style={{ flex: 1, minWidth: 0, height: 40, boxSizing: 'border-box', padding: '0 12px', borderRadius: 4, border: `1px solid ${sel?.id === c.id ? 'var(--coral)' : 'rgba(128,128,128,0.3)'}`, background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13 }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{c.start.toFixed(1)}s to {c.end.toFixed(1)}s</span>
                <button type="button" onClick={() => { setCaps(caps.filter((x) => x.id !== c.id)); if (selCap === c.id) setSelCap(null) }} style={{ ...choiceBtn(), flexShrink: 0, height: 40, padding: '0 14px' }}>Delete</button>
              </div>
            ))}
          </div>
        )}
        {renderOwnCaptionStyle(caps, setCaps)}
        {caps.length > 0 && captionTimingNote && <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>{captionTimingNote}</p>}
      </div>
    )
  }

  // The Captions card: auto captions (with their own look), then typed captions (with theirs)
  const renderCaptionsCard = (m: 'upload' | 'ai') => (
    <CollapsibleBox title="Captions" summary={[(m === 'ai' ? aiAddCaptions : uploadAddCaptions) ? `Auto: ${CAPTION_PRESETS.find((p) => p.id === (m === 'ai' ? aiCaptionPreset : captionPreset))?.label ?? 'on'}` : 'Auto captions off', (m === 'ai' ? aiCaps : uploadCaps).length > 0 ? `${(m === 'ai' ? aiCaps : uploadCaps).length} of your own` : ''].filter(Boolean).join(' · ')}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Add words from your voice, type your own, or both.</p>
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}>
        {subHead('1. Auto captions', 'Words from your voice, added for you.')}
        {renderAutoCaptions(m)}
      </div>
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}>
        {subHead('2. Your own captions', 'Type a caption, then drag its bar on the preview timeline to time it. The style below applies to all of your own captions.')}
        {renderOwnCaptions(m)}
      </div>
    </CollapsibleBox>
  )

  // Overlays: pictures or clips laid over the video, such as a logo, a sticker or b-roll
  const renderOverlayCard = () => {
    const sel = overlays.find((o) => o.id === selOverlay) || null
    return (
      <CollapsibleBox title="Overlay" summary={overlays.length === 0 ? 'None' : overlays.length === 1 ? (overlays[0].isLogo ? 'Logo' : overlays[0].file.name) : `${overlays.length} on the video`}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Lay pictures or clips over your video, like a logo or a product shot. Add as many as you like (up to {MAX_OVERLAYS}). Drag one on the preview to place it, drag its corners or edges to resize it, and set when it shows on the timeline.</p>
        </div>
        <input ref={overlayInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => { pickOverlay(e.target.files?.[0] || null); e.target.value = '' }} />
        <label title={bizLogoUrl ? 'Puts the logo from your Settings on the video. Drag it on the preview to move it.' : 'Upload your logo in Settings first'} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: bizLogoUrl ? 'var(--ink)' : 'var(--text-muted)', cursor: bizLogoUrl ? 'pointer' : 'not-allowed' }}>
          <input type="checkbox" checked={overlays.some((o) => o.isLogo) || logoLoading} disabled={!bizLogoUrl || logoLoading} onChange={(e) => { if (e.target.checked) void addLogoOverlay(); else overlays.filter((o) => o.isLogo).forEach((o) => clearOverlay(o.id)) }} style={{ accentColor: 'var(--coral)', width: 16, height: 16 }} />
          {logoLoading ? 'Adding your logo...' : 'Add my logo'}
          {bizLogoUrl === null && <a href="/settings" style={{ fontSize: 12, color: 'var(--coral)' }}>Upload one in Settings</a>}
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={choiceBtn()} onClick={() => setOverlayPicker(true)}>{overlays.length === 0 ? 'Open library' : 'Add another from library'}</button>
          <button type="button" style={choiceBtn()} onClick={() => overlayInputRef.current?.click()}>Upload from device</button>
        </div>
        {overlays.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {overlays.map((o) => (
              <div key={o.id} role="button" tabIndex={0} onClick={() => setSelOverlay(o.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelOverlay(o.id) }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card-bg)', border: o.id === selOverlay ? '1.5px solid var(--coral)' : '1px solid var(--line)', borderRadius: 4, padding: 8, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: 4, overflow: 'hidden', background: '#111', flexShrink: 0 }}>
                  {o.kind === 'image'
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={o.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <video src={o.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <p style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.isLogo ? 'My logo' : o.file.name}</p>
                <button type="button" style={choiceBtn()} onClick={(e) => { e.stopPropagation(); clearOverlay(o.id) }}>Remove</button>
              </div>
            ))}
          </div>
        )}
        {sel && (
          <>
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>On the preview: drag the overlay to move it, drag any corner or edge to resize it. Press Crop above it to trim its edges instead.</p>
              {(sel.cl > 0 || sel.cr > 0 || sel.ct > 0 || sel.cb > 0) && (
                <button type="button" onClick={() => patchOverlay(sel.id, { cl: 0, cr: 0, ct: 0, cb: 0 })} style={{ background: 'none', border: 'none', padding: 0, marginTop: 8, fontSize: 12, color: 'var(--coral)', cursor: 'pointer', textDecoration: 'underline' }}>Reset crop</button>
              )}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>Click an overlay on the preview or in the list to change it. Drag its bar on the preview timeline to choose when it shows, and drag the white ends to make it shorter or longer.</p>
          </>
        )}
        {overlayError && <p role="alert" style={{ fontSize: 12, color: '#d92d20', margin: 0 }}>{overlayError}</p>}
      </CollapsibleBox>
    )
  }

  // Video quality and Smart Trim
  const renderVideoSettingsBody = (m: 'upload' | 'ai') => {
    const resolution = m === 'ai' ? aiResolution : uploadResolution
    const setResolution = m === 'ai' ? setAiResolution : setUploadResolution
    return (
      <div className="vs-grid">
        <p className="vs-q" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>Quality</p>
        <p className="vs-t" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>Smart Trim</p>
        {([['high', '1080p', 'Basic and Pro'], ['4k', '4K', 'Pro only']] as const).map(([val, label, desc]) => (
          <button key={val} type="button" onClick={() => { if (val === '4k' && userPlan !== 'top') { window.location.href = '/plans'; return } setResolution(val) }}
            style={{ minHeight: 64, boxSizing: 'border-box', padding: '10px 14px', borderRadius: 4, border: resolution === val ? '2px solid var(--coral)' : '1px solid var(--line)', background: resolution === val ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: resolution === val ? 'var(--coral)' : 'var(--ink)', margin: 0 }}>{label}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{desc}</p>
          </button>
        ))}
        <label style={{ minHeight: 64, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: cutDeadSpace ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', border: cutDeadSpace ? '2px solid var(--coral)' : '1px solid var(--line)', borderRadius: 4, padding: '10px 14px' }}>
          <input type="checkbox" checked={cutDeadSpace} onChange={(e) => { setCutDeadSpace(e.target.checked); if (e.target.checked && voiceTakes.length > 0) setTrimKeptOn(true) }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: cutDeadSpace ? 'var(--coral)' : 'var(--ink)' }}>
            Cut silences and dead air
            {!cutDeadSpace && voiceTakes.length > 0 && !trimKeptOn && (
              <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>Turned off because you added a voiceover. Turn it on to cut the quiet parts too; it never cuts while you are talking.</span>
            )}
          </span>
        </label>
      </div>
    )
  }
  // Appearance: smoothing, low light lift and a colour look, like the touch up options in Zoom
  const renderAppearanceCard = () => {
    const slider = (label: string, key: 'touchUp' | 'light', on0: number, tip: string) => {
      const on = appearance[key] > 0
      return (
        <div>
          <label title={tip} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            <input type="checkbox" checked={on} onChange={(e) => setAppearance((a) => ({ ...a, [key]: e.target.checked ? on0 : 0 }))} style={{ accentColor: 'var(--coral)', width: 16, height: 16 }} />
            {label}
            {on && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{appearance[key]}%</span>}
          </label>
          {on && <input type="range" min={1} max={100} step={1} value={appearance[key]} onChange={(e) => setAppearance((a) => ({ ...a, [key]: Number(e.target.value) }))} aria-label={label} style={{ width: '100%', accentColor: 'var(--coral)', display: 'block', marginTop: 8 }} />}
        </div>
      )
    }
    const summary = [appearance.touchUp > 0 ? `Touch up ${appearance.touchUp}%` : '', appearance.light > 0 ? `Low light ${appearance.light}%` : '', appearance.look !== 'none' ? (APPEARANCE_LOOKS.find(([v]) => v === appearance.look)?.[1] || '') : ''].filter(Boolean).join(' · ') || 'Off'
    return (
      <CollapsibleBox title="Appearance" summary={summary}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>Make everyone in the video look their best. It applies to every clip, and the preview shows the colours and brightness as you change them.</p>
        {slider('Touch up my appearance', 'touchUp', 50, 'Softens skin while keeping eyes, hair and edges sharp')}
        {slider('Adjust for low light', 'light', 40, 'Brightens dark footage')}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 8px' }}>Look</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {APPEARANCE_LOOKS.map(([val, label]) => (
              <button key={val} type="button" onClick={() => setAppearance((a) => ({ ...a, look: val }))} style={choiceBtn(appearance.look === val)}>{label}</button>
            ))}
          </div>
        </div>
        {appearance.touchUp > 0 && <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>The preview softens the whole picture a little. In the finished video only flat areas like skin are smoothed, so eyes and hair stay sharp.</p>}
      </CollapsibleBox>
    )
  }

  // Appearance for one clip, shown under its three dots
  const renderClipAppearance = (m: 'upload' | 'ai', i: number) => {
    const key = m === 'ai' ? Object.keys(stepUploads).map(Number).sort((a, b) => a - b)[i] : uploadSlots.filter((slot) => uploadSlotFiles[slot])[i]
    if (key === undefined) return null
    const looks = m === 'ai' ? aiLooks : uploadLooks
    const setLooks = m === 'ai' ? setAiLooks : setUploadLooks
    const value: AppearanceSettings = looks[key] ?? appearance
    const set = (patch: Partial<AppearanceSettings>) => setLooks((prev) => ({ ...prev, [key]: { ...(prev[key] ?? appearance), ...patch } }))
    const slider = (label: string, field: 'touchUp' | 'light', on0: number, tip: string) => {
      const on = value[field] > 0
      return (
        <div>
          <label title={tip} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            <input type="checkbox" checked={on} onChange={(e) => set({ [field]: e.target.checked ? on0 : 0 })} style={{ accentColor: 'var(--coral)', width: 16, height: 16 }} />
            {label}
            {on && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{value[field]}%</span>}
          </label>
          {on && <input type="range" min={1} max={100} step={1} value={value[field]} onChange={(e) => set({ [field]: Number(e.target.value) })} aria-label={label} style={{ width: '100%', accentColor: 'var(--coral)', display: 'block', marginTop: 8 }} />}
        </div>
      )
    }
    return (
      <>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Appearance for clip {i + 1}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>Make everyone in this clip look their best. The preview shows the colours and brightness as you change them.</p>
        {slider('Touch up my appearance', 'touchUp', 50, 'Softens skin while keeping eyes, hair and edges sharp')}
        {slider('Adjust for low light', 'light', 40, 'Brightens dark footage')}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 8px' }}>Look</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {APPEARANCE_LOOKS.map(([val, label]) => (
              <button key={val} type="button" onClick={() => set({ look: val })} style={choiceBtn(value.look === val)}>{label}</button>
            ))}
          </div>
        </div>
        {value.touchUp > 0 && <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>The preview softens the whole picture a little. In the finished video only flat areas like skin are smoothed, so eyes and hair stay sharp.</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={choiceBtn()} onClick={() => { setAppearance(value); setUploadLooks({}); setAiLooks({}) }}>Use this for all clips</button>
          {looks[key] && <button type="button" style={choiceBtn()} onClick={() => setLooks((prev) => { const n = { ...prev }; delete n[key]; return n })}>Back to the setting for all clips</button>}
        </div>
      </>
    )
  }

  // Phone editor: each settings card sits in a tool wrapper that only shows while its tool is open.
  // 'always' shows all the time (progress and errors), 'never' only exists on a computer (the big Create button).
  const edT = (on: boolean, t: string, node: React.ReactNode) => (on ? (t === 'never' ? null : <div className={`ed-tool${t === 'always' || mTool === t ? ' on' : ''}`}>{node}</div>) : node)
  const PHONE_TOOL_NAMES: Record<string, string> = { idea: 'Idea', clips: 'Clips', clip: 'Edit clip', crop: 'Crop', speed: 'Speed', audio: 'Audio', extract: 'Extract audio', voiceover: 'Voiceover', captions: 'Captions', overlay: 'Overlay', settings: 'Settings' }
  const phoneTools = (ids: string[]): PhoneTool[] => ids.map((id) => ({ id, label: PHONE_TOOL_NAMES[id] }))
  // On a phone the AI editor goes full screen once an idea is picked; picking the idea is a normal page
  const phoneAi = phone && !!selectedFilmingId
  const aiPhoneTitle = filmingItems.find((f) => f.id === selectedFilmingId)?.title || 'AI editor'

  // The on-screen text box on the preview. Hidden while "write my own" captions are on, as those use the spoken layer.
  const aiStepText = (step: number) => {
    const it = filmingItems.find((f) => f.id === selectedFilmingId)
    const fromActions = extractOnScreenText(it?.directions?.[step] || '')
    return (fromActions.length > 0 ? fromActions : extractOnScreenText(it?.checklist?.[step] || '')).join(' ')
  }
  const screenTextBox = (m: 'upload' | 'ai'): ScreenTextBox | null => {
    const own = m === 'upload' ? uploadAddCaptions && uploadCaptionOwn : aiAddCaptions && aiCaptionOwn
    if (!captionLayers.onScreen.on || own) return null
    const pt = layerPoint(captionLayers, 'onScreen', captionPosition)
    const keys = m === 'upload' ? uploadSlots.filter((id) => uploadSlotFiles[id]) : Object.keys(stepUploads).map(Number).sort((a, b) => a - b)
    const edits = m === 'upload' ? uploadScreenTexts : aiScreenTexts
    return {
      texts: keys.map((k) => edits[k] ?? (m === 'upload' ? (uploadSlotTexts[k] || []).join(' ') : aiStepText(k))),
      x: pt.x,
      y: pt.y,
      onMove: (x, y) => setCaptionLayers((l) => ({ ...l, onScreen: { ...l.onScreen, x, y } })),
      onEdit: (clip, text) => { const k = keys[clip]; if (k === undefined) return; (m === 'upload' ? setUploadScreenTexts : setAiScreenTexts)((prev) => ({ ...prev, [k]: text })) },
      onRemove: () => setCaptionLayers((l) => ({ ...l, onScreen: { ...l.onScreen, on: false } })),
    }
  }

  // Phone editor: the Made with Reelezy badge switch sits in Settings (on a computer it is a link under the preview)
  const renderPhoneBadgeToggle = () => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px 20px', fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>
      <input type="checkbox" checked={madeWithBadge} onChange={(e) => setMadeWithBadge(e.target.checked)} style={{ accentColor: 'var(--coral)', width: 16, height: 16 }} />
      Show the Made with Reelezy badge
    </label>
  )

  // Phone editor: Extract audio gets its own page. On a computer it is under Audio > Pick from the library.
  const renderPhoneExtractPanel = () => (
    <div style={{ padding: '14px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>Take the sound from any video on your phone, like a trending sound you saved, and use it as the music for this video.</p>
      <input ref={extractInputRef} type="file" accept="video/*" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleExtractAudio(f) }} />
      <button type="button" disabled={extractingAudio} onClick={() => extractInputRef.current?.click()}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px', borderRadius: 4, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: extractingAudio ? 'default' : 'pointer', opacity: extractingAudio ? 0.7 : 1 }}>
        {extractingAudio ? <><span className="rly-spinner" />Taking the sound from your video...</> : extractedMusicPath ? 'Use a different video' : 'Choose a video'}
      </button>
      {extractAudioError && <p role="alert" style={{ fontSize: 13, color: 'var(--coral)', margin: 0 }}>{extractAudioError}</p>}
      {extractedMusicPath && !extractingAudio && (
        <>
          <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, margin: 0 }}>The sound from your video is now this video&apos;s music.</p>
          <VolumeRow label="Music volume" value={musicVol} onChange={setMusicVol} color="var(--coral)" />
          <button type="button" onClick={clearMusic} style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Remove this sound</button>
        </>
      )}
    </div>
  )

  // What tapping a clip on the timeline can do. i is the clip's place on the timeline.
  const clipKeys = (m: 'upload' | 'ai') => (m === 'upload' ? uploadSlots.filter((id) => uploadSlotFiles[id]) : Object.keys(stepUploads).map(Number).sort((a, b) => a - b))
  const deleteClipAt = (m: 'upload' | 'ai', i: number) => {
    const k = clipKeys(m)[i]
    if (k === undefined) return
    const drop = <T,>(prev: Record<number, T>) => { const n = { ...prev }; delete n[k]; return n }
    if (m === 'upload') {
      // The last clip leaves an empty slot behind to pick a new one into
      if (uploadSlots.length > 1) setUploadSlots((prev) => prev.filter((x) => x !== k))
      setUploadSlotFiles(drop); setUploadSlotPaths(drop); setUploadTrims(drop); setUploadSpeeds(drop); setUploadVols(drop); setUploadMuted(drop); setUploadCrops(drop); setUploadPlaces(drop); setUploadScreenTexts(drop)
      forgetClipUpload('u', k)
      setUploadSpeechSlots((prev) => { const n = new Set(prev); n.delete(k); return n })
      setUploadLandscapeSlots((prev) => { const n = new Set(prev); n.delete(k); return n })
    } else {
      setStepUploads(drop); setStepUploadPaths(drop); setStepUploadNames(drop); setAiTrims(drop); setAiSpeeds(drop); setAiVols(drop); setAiMuted(drop); setAiCrops(drop); setAiPlaces(drop)
      forgetClipUpload('a', k)
      void authFetch('/api/delete-draft-clip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, editorType: 'ai', slotIndex: k }) })
    }
  }
  // A copy straight after the clip, with all its settings. It uses the same uploaded file, so nothing uploads twice.
  const duplicateUploadClip = (i: number) => {
    const id = clipKeys('upload')[i]
    if (id === undefined) return
    const nid = Math.max(...uploadSlots) + 1
    const copy = <T,>(prev: Record<number, T>) => (prev[id] === undefined ? prev : { ...prev, [nid]: prev[id] })
    setUploadSlots((prev) => { const n = [...prev]; n.splice(n.indexOf(id) + 1, 0, nid); return n })
    setUploadSlotFiles(copy); setUploadSlotPaths(copy); setUploadTrims(copy); setUploadSpeeds(copy); setUploadVols(copy); setUploadMuted(copy); setUploadLooks(copy); setUploadScreenTexts(copy); setUploadCrops(copy); setUploadPlaces(copy); setUploadSlotTexts(copy)
    const pr = clipUploadPromises.get(`u${id}`)
    if (pr) clipUploadPromises.set(`u${nid}`, pr)
    setClipUploadStatus((prev) => (prev[`u${id}`] ? { ...prev, [`u${nid}`]: prev[`u${id}`] } : prev))
    if (uploadSpeechSlots.has(id)) setUploadSpeechSlots((prev) => new Set(prev).add(nid))
    if (uploadLandscapeSlots.has(id)) setUploadLandscapeSlots((prev) => new Set(prev).add(nid))
  }
  const clipOpsFor = (m: 'upload' | 'ai', onPhone: boolean): ClipOps => {
    const keys = clipKeys(m)
    const vols = m === 'upload' ? uploadVols : aiVols
    const muted = m === 'upload' ? uploadMuted : aiMuted
    return {
      level: (i) => ({ vol: vols[keys[i]] ?? 100, muted: !!muted[keys[i]] }),
      onVolume: (i, v) => { const k = keys[i]; if (k !== undefined) (m === 'upload' ? setUploadVols : setAiVols)((prev) => ({ ...prev, [k]: v })) },
      onMute: (i, on) => { const k = keys[i]; if (k !== undefined) (m === 'upload' ? muteUploadClip(k, on) : muteAiClip(k, on)) },
      onCrop: (i, crop) => {
        const k = keys[i]
        if (k === undefined) return
        ;(m === 'upload' ? setUploadCrops : setAiCrops)((prev) => { const n = { ...prev }; if (crop) n[k] = crop; else delete n[k]; return n })
      },
      onPlace: (i, place) => {
        const k = keys[i]
        if (k === undefined) return
        ;(m === 'upload' ? setUploadPlaces : setAiPlaces)((prev) => { const n = { ...prev }; if (place) n[k] = place; else delete n[k]; return n })
      },
      onDelete: (i) => deleteClipAt(m, i),
      // AI editor clips belong to a step of the shot list, so they are not copied
      onDuplicate: m === 'upload' ? duplicateUploadClip : undefined,
      onOpen: onPhone ? (kind, i) => { setMClip(i); setMTool(kind) } : undefined,
    }
  }
  const [phoneDelConfirm, setPhoneDelConfirm] = useState(false)
  // What the + on each timeline line adds
  const addSourcesFor = (m: 'upload' | 'ai'): AddSources => ({
    video: {
      library: () => setLibraryPicker(m === 'upload' ? 'any' : 'ai'),
      photos: (f) => (m === 'upload' ? addUploadFiles(f) : addAiFiles(f)),
      files: (f) => (m === 'upload' ? addUploadFiles(f) : addAiFiles(f)),
      photoAccept: 'video/*',
      fileAccept: 'video/*,.mp4,.mov,.m4v,.webm',
      multiple: true,
      libraryLabel: 'Clips saved in Reelezy',
    },
    audio: {
      library: () => setAudioPicker(true),
      photos: (f) => { if (f[0]) void handleExtractAudio(f[0]) },
      files: (f) => { if (f[0]) uploadVoiceFile(f[0]) },
      photoAccept: 'video/*',
      fileAccept: 'audio/*,.mp3,.m4a,.wav,.aac,.ogg,.webm',
      photoLabel: "Use a video's sound as music",
      libraryLabel: 'Sounds saved in Reelezy',
    },
  })
  // Crop the clip under the line, from the phone's tool bar
  const pickPhoneTool = (t: string | null) => {
    if (t === 'crop') { setMTool(null); setCropRequest((r) => ({ clip: mClip, n: (r?.n ?? 0) + 1 })); return }
    setMTool(t)
  }
  // The top of a phone panel about one clip: which clip, with arrows to pick another
  const renderPhoneClipHeader = (i: number, count: number, note = 'The clip under the line. Use the arrows to pick another.') => {
    const arrow = (dir: -1 | 1) => {
      const off = dir === -1 ? i === 0 : i === count - 1
      return (
        <button type="button" aria-label={dir === -1 ? 'Previous clip' : 'Next clip'} disabled={off} onClick={() => setMClip(i + dir)}
          style={{ width: 36, height: 36, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: off ? 'default' : 'pointer', opacity: off ? 0.35 : 1 }}>
          <Icon n={dir === -1 ? 'back' : 'forward'} />
        </button>
      )
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {arrow(-1)}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Clip {i + 1} of {count}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{note}</p>
        </div>
        {arrow(1)}
      </div>
    )
  }
  const phoneClipIds = (m: 'upload' | 'ai') => (m === 'upload' ? uploadSlots.filter((id) => uploadSlotFiles[id]) : Object.keys(stepUploads).map(Number).sort((a, b) => a - b))
  // Phone Speed page: one clip's speed on a slider
  const renderPhoneSpeedPanel = (m: 'upload' | 'ai') => {
    const ids = phoneClipIds(m)
    if (ids.length === 0) return <p style={{ fontSize: 13, color: 'var(--text-secondary)', padding: 16, margin: 0 }}>Add a clip first.</p>
    const i = Math.min(Math.max(0, mClip), ids.length - 1)
    const speed = (m === 'upload' ? uploadSpeeds[ids[i]] : aiSpeeds[ids[i]]) || 1
    return (
      <div style={{ padding: '14px 16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {renderPhoneClipHeader(i, ids.length)}
        <SpeedSlider value={speed} onChange={(v) => (m === 'upload' ? speedUploadClip(i, v) : speedAiClip(i, v))} label={`Clip ${i + 1} speed`} />
      </div>
    )
  }
  // On the phone Audio page, the clip's own sound comes first
  const renderPhoneClipAudio = (m: 'upload' | 'ai') => {
    const ids = phoneClipIds(m)
    if (ids.length === 0) return null
    const i = Math.min(Math.max(0, mClip), ids.length - 1)
    const id = ids[i]
    const vol = (m === 'upload' ? uploadVols[id] : aiVols[id]) ?? 100
    return (
      <div style={{ padding: '14px 16px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {renderPhoneClipHeader(i, ids.length, "This clip's own sound. Music and master volume are below.")}
        <VolumeRow label="Clip audio" value={vol} onChange={(v) => (m === 'upload' ? setUploadVols((prev) => ({ ...prev, [id]: v })) : setAiVols((prev) => ({ ...prev, [id]: v })))} color="var(--coral)"
          muted={!!(m === 'upload' ? uploadMuted[id] : aiMuted[id])} onMute={(on) => (m === 'upload' ? muteUploadClip(id, on) : muteAiClip(id, on))} />
      </div>
    )
  }

  // Phone editor: speed, volume and look for one clip. On a computer these sit under the preview.
  const renderPhoneClipPanel = (m: 'upload' | 'ai') => {
    const ids = m === 'upload' ? uploadSlots.filter((id) => uploadSlotFiles[id]) : Object.keys(stepUploads).map(Number).sort((a, b) => a - b)
    if (ids.length === 0) return <p style={{ fontSize: 13, color: 'var(--text-secondary)', padding: 16, margin: 0 }}>Add a clip first, then pick it here to change its speed, volume and look.</p>
    const i = Math.min(Math.max(0, mClip), ids.length - 1)
    const id = ids[i]
    const speed = (m === 'upload' ? uploadSpeeds[id] : aiSpeeds[id]) || 1
    const vol = (m === 'upload' ? uploadVols[id] : aiVols[id]) ?? 100
    const arrow = (dir: -1 | 1) => {
      const off = dir === -1 ? i === 0 : i === ids.length - 1
      return (
        <button type="button" aria-label={dir === -1 ? 'Previous clip' : 'Next clip'} disabled={off} onClick={() => setMClip(i + dir)}
          style={{ width: 36, height: 36, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: off ? 'default' : 'pointer', opacity: off ? 0.35 : 1 }}>
          <Icon n={dir === -1 ? 'back' : 'forward'} />
        </button>
      )
    }
    return (
      <div style={{ padding: '14px 16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {arrow(-1)}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Clip {i + 1} of {ids.length}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>The clip under the line. Use the arrows to pick another.</p>
          </div>
          {arrow(1)}
        </div>
        <SpeedSlider value={speed} onChange={(v) => (m === 'upload' ? speedUploadClip(i, v) : speedAiClip(i, v))} label="Speed" />
        <VolumeRow label="Clip audio" value={vol} onChange={(v) => (m === 'upload' ? setUploadVols((prev) => ({ ...prev, [id]: v })) : setAiVols((prev) => ({ ...prev, [id]: v })))} color="var(--coral)"
          muted={!!(m === 'upload' ? uploadMuted[id] : aiMuted[id])} onMute={(on) => (m === 'upload' ? muteUploadClip(id, on) : muteAiClip(id, on))} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => { setMTool(null); setCropRequest((r) => ({ clip: i, n: (r?.n ?? 0) + 1 })) }} style={{ padding: '9px 14px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{(m === 'upload' ? uploadCrops[id] : aiCrops[id]) ? 'Change crop' : 'Crop'}</button>
          {(m === 'upload' ? uploadCrops[id] : aiCrops[id]) && <button type="button" onClick={() => clipOpsFor(m, true).onCrop(i, null)} style={{ padding: '9px 14px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Remove crop</button>}
          {m === 'upload' && <button type="button" onClick={() => { duplicateUploadClip(i); setMClip(i + 1) }} style={{ padding: '9px 14px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Duplicate</button>}
          <span style={{ flex: 1 }} />
          {phoneDelConfirm ? (
            <>
              <button type="button" onClick={() => setPhoneDelConfirm(false)} style={{ padding: '9px 14px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Keep</button>
              <button type="button" onClick={() => { setPhoneDelConfirm(false); deleteClipAt(m, i); setMClip(Math.max(0, i - 1)) }} style={{ padding: '9px 14px', borderRadius: 4, border: 'none', background: '#D92D20', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Delete clip {i + 1}</button>
            </>
          ) : (
            <button type="button" onClick={() => setPhoneDelConfirm(true)} style={{ padding: '9px 14px', borderRadius: 4, border: '1px solid #D92D20', background: 'var(--card-bg)', color: '#D92D20', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
          )}
        </div>
        {renderClipAppearance(m, i)}
      </div>
    )
  }

  const renderVideoSettings = (m: 'upload' | 'ai') => (
    <CollapsibleBox title="Video settings" summary={[(m === 'ai' ? aiResolution : uploadResolution) === '4k' ? '4K' : '1080p', cutDeadSpace ? 'Cuts silences' : ''].filter(Boolean).join(' · ')}>
      {renderVideoSettingsBody(m)}
    </CollapsibleBox>
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
  // Sound taken from a video lives in storage, so the preview plays it from there
  const [extractedMusicUrl, setExtractedMusicUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!extractedMusicPath) { setExtractedMusicUrl(null); return }
    let off = false
    supabase.storage.from('video-uploads').createSignedUrl(extractedMusicPath, 3600).then(({ data }) => { if (!off) setExtractedMusicUrl(data?.signedUrl ?? null) })
    return () => { off = true }
  }, [extractedMusicPath])
  const previewMusicUrl = libraryMusicUrl || musicFileUrl || extractedMusicUrl
  // New music starts at the start of the video again
  const musicKey = `${libraryMusicUrl || ''}|${musicFile ? `${musicFile.name}:${musicFile.size}` : ''}|${extractedMusicPath || ''}`
  const [seenMusicKey, setSeenMusicKey] = useState(musicKey)
  if (seenMusicKey !== musicKey) { setSeenMusicKey(musicKey); setMusicStart(0) }

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
      const filmSpeeds: Record<number, number> = {}
      clips.forEach((cl, i) => { const sp = filmClipSpeedsRef.current[cl.url]; if (sp && sp !== 1) filmSpeeds[i] = sp })
      filmClipSpeedsRef.current = {}
      setUploadSpeeds(filmSpeeds)
      setUploadSlots(slots)
      setUploadSlotFiles(filesMap)
      setUploadSlotPaths(pathsMap)
      const filmActionLines = splitActionLines(filmActionsText)
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
      closeEditorTabs()
      if (renderNow) setFilmAutoRender(true)
      setTab('uploads')
    } catch (err) {
      console.error('Film upload failed:', err)
      alert('Saving your clips failed. They are kept here, so press Open in editor to try again.')
    }
    setFilmUploading(false)
  }

  // A photo from the device becomes a short clip and lands in the same "keep this clip" step as a filmed one.
  const addFilmPhoto = async (file: File) => {
    setFilmRecordError('')
    try {
      const clip = await photoToClip(file, filmOrientationRef.current === 'landscape')
      const url = URL.createObjectURL(clip.blob)
      filmClipSpeedsRef.current[url] = 1
      setFilmPending({ blob: clip.blob, ext: clip.ext, type: clip.type, url })
    } catch (err) {
      setFilmRecordError(err instanceof Error ? err.message : 'That photo could not be used.')
    }
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
      // Every clip is filmed: go straight into the same editor as everything else. The review screen only
      // stays up if saving the clips fails, so they can try again from there.
      setFilmPlayIdx(0)
      setFilmReview(true)
      void finishFilm(clips, false)
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
    archiveFilming(filmingItems)
    setFilmingItems([])
    await supabase.from("generated_ideas").update({ filming_cleared: true }).in("id", ids)
  }

  const pickFilmingIdea = (item: FilmingItem) => {
    setSelectedFilmingId(item.id); setStepUploads({}); resetAiClipUploads(); setAiVols({}); setAiMuted({}); setAiScreenTexts({}); setAiCrops({}); setAiPlaces({}); setAiSpeechSteps(new Set()); setAiOwnTexts({}); setAiCaps([])
    const scriptLinesForIdea = getFilmLines(item)
    if (scriptLinesForIdea.length > 0) setVoiceScript({ id: `idea:${item.id}`, label: item.title || 'Idea', lines: scriptLinesForIdea }); else setVoiceScript(null)
  }

  // Bring an archived idea back so it can be filmed again. Its instructions are unchanged.
  const reuseArchived = (item: ArchivedFilmingItem) => {
    setArchivedFilming((prev) => prev.filter((a) => a.id !== item.id))
    setFilmingItems((prev) => [item, ...prev.filter((f) => f.id !== item.id)])
    setShowArchive(false); setArchiveOpenId(null); setArchiveQuery('')
    pickFilmingIdea(item)
    supabase.from('generated_ideas').update({ filming_cleared: false }).eq('id', item.id).then(() => {})
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
  const addUploadFiles = (files: File[], libPaths?: Map<File, string>) => {
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
    Object.entries(assign).forEach(([id, f]) => { const lp = libPaths?.get(f); if (lp) adoptClipPath('u', Number(id), lp); else startClipUpload('u', Number(id), f) })
  }

  // AI editor: the steps are fixed, so dropped videos fill the next empty steps in order
  const addAiFiles = (files: File[], libPaths?: Map<File, string>) => {
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
      const lp = libPaths?.get(f)
      if (lp) adoptClipPath('a', idx, lp); else startClipUpload('a', idx, f)
    })
    if (used.length < vids.length) {
      setAiEditorError(used.length === 0 ? 'Choose an idea first, or every step already has a clip.' : `Only ${used.length} ${used.length === 1 ? 'step was' : 'steps were'} empty, so the other ${vids.length - used.length} ${vids.length - used.length === 1 ? 'video was' : 'videos were'} not added.`)
    }
  }

  const getVideoDuration = (file: File): Promise<number> => {
    // Uses the same length the preview shows, so trims and the timeline agree
    const known = previewDurations.get(previewFileKey(file))
    if (known && known > 0) return Promise.resolve(known)
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.preload = "metadata"
      video.muted = true
      const url = URL.createObjectURL(file)
      let done = false
      const finish = (d: number) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(d > 0 && Number.isFinite(d) ? d : 5) }
      video.onloadedmetadata = () => {
        whenDurationKnown(video, (d) => { previewDurations.set(previewFileKey(file), d); finish(d) }, 5000)
        window.setTimeout(() => finish(5), 5200)
      }
      video.onerror = () => finish(5)
      video.src = url
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

  const isOverRenderCap = () => {
    const capMin = userPlan === "top" ? PLAN_LIMITS.top.renderMinutes : PLAN_LIMITS.basic.renderMinutes
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

  // A clip that is already in the library is already in storage, so use it where it is instead of uploading it again
  const adoptClipPath = (kind: 'u' | 'a', idx: number, path: string) => {
    const key = `${kind}${idx}`
    clipUploadPromises.set(key, Promise.resolve(path))
    ;(kind === 'u' ? setUploadSlotPaths : setStepUploadPaths)((prev) => ({ ...prev, [idx]: path }))
    setClipUploadStatus((prev) => ({ ...prev, [key]: 'done' }))
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
  const MAX_OVERLAYS = 6
  const pickOverlay = (file: File | null, opts?: { isLogo?: boolean }) => {
    if (!file) return
    const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null
    if (!kind) { setOverlayError('Choose an image or a video file.'); return }
    if (file.size > 50 * 1024 * 1024) { setOverlayError('That file is over 50 MB. Try a smaller one.'); return }
    if (overlays.length >= MAX_OVERLAYS) { setOverlayError(`You can have up to ${MAX_OVERLAYS} overlays on a video. Remove one first.`); return }
    setOverlayError('')
    const base = { id: `ov-${(overlaySeq.current += 1)}`, file, kind, url: URL.createObjectURL(file), ar: 1, cl: 0, cr: 0, ct: 0, cb: 0, end: null } as const
    // A logo sits small in the top right for the whole video. Anything else lands near the top, from where the playhead is, and each new one steps down a little so they do not hide each other.
    const item: OverlayItem = opts?.isLogo
      ? { ...base, isLogo: true, x: 0.85, y: 0.1, size: 0.2, start: 0 }
      : { ...base, x: 0.5, y: Math.min(0.8, 0.2 + overlays.filter((o) => !o.isLogo).length * 0.12), size: 0.35, start: playheadRef.current.total > 0 && playheadRef.current.t < playheadRef.current.total - 0.5 ? playheadRef.current.t : 0 }
    // Checked against the latest list, so quick taps can never add more than one logo or go over the limit
    let added = false
    setOverlays((prev) => {
      if ((item.isLogo && prev.some((o) => o.isLogo)) || prev.length >= MAX_OVERLAYS) return prev
      added = true
      return [...prev, item]
    })
    if (added) setSelOverlay(item.id)
    else URL.revokeObjectURL(item.url)
  }
  // Puts the logo from Settings on the video. It has to download first, so taps while it does are ignored.
  const logoLoadingRef = useRef(false)
  const [logoLoading, setLogoLoading] = useState(false)
  const addLogoOverlay = async () => {
    if (!bizLogoUrl || overlays.some((o) => o.isLogo) || logoLoadingRef.current) return
    logoLoadingRef.current = true
    setLogoLoading(true)
    try {
      const res = await fetch(bizLogoUrl, { cache: 'no-store' })
      if (!res.ok) throw new Error('bad status')
      const blob = await res.blob()
      const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/\+.*$/, '')
      pickOverlay(new File([blob], `logo.${ext}`, { type: blob.type || 'image/png' }), { isLogo: true })
    } catch {
      setOverlayError('Could not load your logo. Try again, or check it in Settings.')
    } finally {
      logoLoadingRef.current = false
      setLogoLoading(false)
    }
  }
  const clearOverlay = (id: string) => {
    setOverlayError('')
    const gone = overlays.find((o) => o.id === id)
    if (gone) URL.revokeObjectURL(gone.url)
    setOverlays((prev) => prev.filter((o) => o.id !== id))
    setSelOverlay((cur) => (cur === id ? null : cur))
  }
  const patchOverlay = (id: string, patch: Partial<OverlayItem>) => setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  // Uploads the overlay files when the video is made, and returns what the server needs
  const uploadOverlay = async () => {
    if (overlays.length === 0 || !userId) return []
    const out: { path: string; kind: 'image' | 'video'; x: number; y: number; size: number; start: number; end: number | null; cl: number; cr: number; ct: number; cb: number }[] = []
    for (const ov of overlays) {
      let path = overlayUploadRef.current.get(ov.file) ?? null
      if (!path) {
        path = `${userId}/overlay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${ov.file.name.replace(/[^\w.-]+/g, '_')}`
        const send = () => supabase.storage.from('video-uploads').upload(path!, ov.file, ov.file.type ? { contentType: ov.file.type, upsert: true } : { upsert: true })
        let { error } = await send()
        // A dropped connection on a phone ("Load failed", "Failed to fetch") gets one more go
        if (error && /load failed|failed to fetch|network/i.test(error.message)) { await new Promise((r) => setTimeout(r, 1200)); ({ error } = await send()) }
        if (error) throw new Error(/load failed|failed to fetch|network/i.test(error.message) ? 'An overlay could not upload because the connection dropped. Check your signal and press Create video again.' : `Overlay upload failed: ${error.message}`)
        overlayUploadRef.current.set(ov.file, path)
      }
      out.push({ path, kind: ov.kind, x: ov.x, y: ov.y, size: ov.size, start: ov.start, end: ov.end, cl: ov.cl, cr: ov.cr, ct: ov.ct, cb: ov.cb })
    }
    return out
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

  // A song picked from the device is used as the music and kept in the audio library for next time
  const pickMusicFileAndSave = (file: File) => {
    pickMusicFile(file)
    if (!userId) return
    const paid = realSubStatus === 'active' || realSubStatus === 'trialing'
    const plan = realSubPlan && paid ? userPlan : 'free'
    void saveAudioToLibrary(userId, file, plan).then((r) => { if (r.clip && !r.existed) announceAudioLibraryChanged() })
  }

  // A sound from the audio library is already in storage, so use it where it is as the music
  const applySavedSoundAsMusic = (file: File, path: string) => {
    setLibraryMusicUrl(null)
    setLibraryMusicName(null)
    setExtractedMusicPath(null)
    setExtractAudioError('')
    setMusicFile(file)
    clipUploadPromises.set('m', Promise.resolve(path))
    setAssetPaths((prev) => ({ ...prev, m: path }))
    setClipUploadStatus((prev) => ({ ...prev, m: 'done' }))
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
  const addVoiceTake = (blob: Blob, start: number, duration: number, libPath?: string) => {
    if (!trimKeptOn) setCutDeadSpace(false)
    const id = newTakeId()
    setVoiceTakes((prev) => [...prev, { id, blob, url: URL.createObjectURL(blob), start, duration, volume: 100 }])
    if (libPath) {
      // Already in storage (picked from the library), so there is nothing to upload
      clipUploadPromises.set(`v:${id}`, Promise.resolve(libPath))
      setAssetPaths((prev) => ({ ...prev, [`v:${id}`]: libPath }))
      setClipUploadStatus((prev) => ({ ...prev, [`v:${id}`]: 'done' }))
    } else startAssetUpload(`v:${id}`, blob, 'voiceover')
  }

  const addVoiceFile = (file: File, libPath?: string) => {
    // An uploaded or library voiceover starts where the line is on the timeline, like a recorded one
    const { t, total } = playheadRef.current
    const at = total > 0 && t < total - 0.2 ? t : 0
    const probe = new Audio()
    probe.preload = 'metadata'
    let added = false
    const add = (d: number) => { if (added) return; added = true; addVoiceTake(file, at, d, libPath) }
    probe.onloadedmetadata = () => { whenDurationKnown(probe, add, 3000); window.setTimeout(() => add(0), 3200) }
    probe.onerror = () => add(0)
    probe.src = URL.createObjectURL(file)
  }

  // A recording the person uploads is also kept in their library for next time
  const uploadVoiceFile = (file: File) => {
    addVoiceFile(file)
    if (!userId) return
    const paid = realSubStatus === 'active' || realSubStatus === 'trialing'
    const plan = realSubPlan && paid ? userPlan : 'free'
    void saveAudioToLibrary(userId, file, plan).then((r) => { if (r.clip && !r.existed) announceAudioLibraryChanged() })
  }

  const removeVoiceTake = (id: string) => {
    setVoiceTakes((prev) => prev.filter((t) => t.id !== id))
    forgetAsset(`v:${id}`)
  }

  const setTakeVolume = (id: string, volume: number) => setVoiceTakes((prev) => prev.map((t) => (t.id === id ? { ...t, volume } : t)))

  const moveVoiceTake = (id: string, start: number) => setVoiceTakes((prev) => prev.map((t) => (t.id === id ? { ...t, start } : t)))

  const reorderFilmClip = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= filmClips.length || to >= filmClips.length) return
    const mv = <T,>(arr: T[]) => { const n = arr.slice(); const [x] = n.splice(from, 1); n.splice(to, 0, x); return n }
    setFilmClips(mv(filmClips))
    const ls = splitScriptLines(filmScript)
    if (from < ls.length && to < ls.length) setFilmScript(mv(ls).join('\n'))
    setFilmActionsText((prev) => { const l = splitActionLines(prev); return from < l.length && to < l.length ? mv(l).join('\n') : prev })
    setFilmPlayIdx(to)
  }

  const moveFilmClip = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= filmClips.length) return
    const next = filmClips.slice()
    next[i] = filmClips[j]
    next[j] = filmClips[i]
    setFilmClips(next)
    const ls = splitScriptLines(filmScript)
    if (i < ls.length && j < ls.length) setFilmScript(swapItems(ls, i, j).join('\n'))
    setFilmActionsText((prev) => swapItems(splitActionLines(prev), i, j).join('\n'))
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

  // Each Create video press gets a number; Cancel moves the number on, so the old attempt stops where it is
  const aiRunRef = useRef(0)
  const uploadRunRef = useRef(0)
  // What was in each editor when a video was sent, so a failed render can put it all back
  const uploadFailRestoreRef = useRef<{ id: string; snap: EditorSnap } | null>(null)
  const aiFailRestoreRef = useRef<{ id: string; takes: VoiceTake[]; musicFile: File | null; extracted: string | null; assets: Record<string, string> } | null>(null)
  const cancelAiUpload = () => { aiRunRef.current += 1; setAiUploading(false); setAiEditorError('') }
  const cancelUpload = () => { uploadRunRef.current += 1; setUploading(false); setUploadError('') }
  // A request that never reached the server ("Load failed" on iPhone, "Failed to fetch" elsewhere) means the
  // connection or the storage service is down, so say that in plain words
  const uploadErrorText = (err: unknown, fallback: string) => {
    const msg = err instanceof Error ? err.message : ''
    if (/load failed|failed to fetch|networkerror|network request failed/i.test(msg)) return 'Your clips could not upload: the connection to our storage dropped. Check your signal and press Create video again. If it keeps happening, try again in a few minutes.'
    return msg || fallback
  }

  const runAiEditorUploads = async () => {
    if (!userId) return
    const selectedItem = filmingItems.find((f) => f.id === selectedFilmingId)
    if (!selectedItem) return

    const run = ++aiRunRef.current
    setAiEditorError('')
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
      const clipSettings: { letterbox?: boolean; speed?: number; volume?: number; muted?: boolean; crop?: ClipCrop; place?: ClipPlace; appearance?: AppearanceSettings }[] = []
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
          const edited = aiScreenTexts[result.stepIndex]
          const base = edited !== undefined ? (edited ? [edited] : []) : fromActions.length > 0 ? fromActions : extractOnScreenText(it?.checklist?.[result.stepIndex] || '')
          const typed = aiOwnTexts[result.stepIndex]
          clipTexts.push(aiAddCaptions && aiCaptionOwn && typed !== undefined ? (typed.trim() ? [typed.trim()] : []) : base)
        }
        clipTrims.push({ duration: result.duration, trimStart: result.trimStart, trimLength: result.trimLength })
        if (result.isLandscape) {
          anyLandscape = true
          clipSettings.push({ letterbox: true, speed: aiSpeeds[result.stepIndex], volume: aiVols[result.stepIndex] === undefined ? undefined : aiVols[result.stepIndex] / 100, muted: aiMuted[result.stepIndex] || undefined, crop: aiCrops[result.stepIndex], place: aiPlaces[result.stepIndex], appearance: aiLooks[result.stepIndex] })
        } else {
          clipSettings.push({ speed: aiSpeeds[result.stepIndex], volume: aiVols[result.stepIndex] === undefined ? undefined : aiVols[result.stepIndex] / 100, muted: aiMuted[result.stepIndex] || undefined, crop: aiCrops[result.stepIndex], place: aiPlaces[result.stepIndex], appearance: aiLooks[result.stepIndex] })
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
              font: { family: captionFontFamily, size: Number(captionFontSize) || 36, color: captionColor, bold: captionBold ?? undefined, italic: captionItalic || undefined, underline: captionUnderline || undefined },
              position: captionPosition,
              borderColor: captionBorderColor,
              backgroundColor: captionBg ?? undefined,
            },
            layers: resolveCaptionLayers(captionLayers, captionPosition, aiOwnMode),
          }
        : null

      const overlayPayload = await uploadOverlay()
      // Cancelled while the clips were uploading: do not start a render
      if (run !== aiRunRef.current) return
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
          originalVolume: originalVol, musicVolume: musicVol, musicStart,
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
          overlays: overlayPayload,
          appearance: appearancePayload,
          madeWithBadge,
          
          ideaId: selectedFilmingId || null,
          ideaSource: !selectedFilmingId ? 'upload' : selectedFilmingId.startsWith('script-') ? 'script' : 'idea',
          ideaTitle: filmingItems.find((f) => f.id === selectedFilmingId)?.title || null,
          ideaCaption: filmingItems.find((f) => f.id === selectedFilmingId)?.caption || null,
          ideaTags: filmingItems.find((f) => f.id === selectedFilmingId)?.tags || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Render failed to start")

      aiFailRestoreRef.current = { id: data.renderId, takes: voiceTakes, musicFile, extracted: extractedMusicPath, assets: { ...assetPaths } }
      setAiRenderId(data.renderId)
      setAiRenderStatus("queued")
      localStorage.setItem('reelezy-render', JSON.stringify({ id: data.renderId, type: 'ai', ts: Date.now() }))
      setMusicFile(null)
      clearVoiceTakes()
      setExtractedMusicPath(null)
    } catch (err) {
      if (run === aiRunRef.current) setAiEditorError(uploadErrorText(err, 'Something went wrong uploading your clips. Check file sizes and try again.'))
    } finally {
      if (run === aiRunRef.current) setAiUploading(false)
    }
  }
  // ---- Editor tabs for several filmed videos
  const captureEditor = (): EditorSnap => ({
    slots: uploadSlots, files: uploadSlotFiles, paths: uploadSlotPaths, trims: uploadTrims, speeds: uploadSpeeds, vols: uploadVols, muted: uploadMuted, screenTexts: uploadScreenTexts, crops: uploadCrops, places: uploadPlaces,
    looks: uploadLooks, texts: uploadSlotTexts, ownTexts: uploadOwnTexts, speech: uploadSpeechSlots, landscape: uploadLandscapeSlots,
    caps: uploadCaps, overlays, takes: voiceTakes, assets: assetPaths,
    musicFile, libMusicUrl: libraryMusicUrl, libMusicName: libraryMusicName, extracted: extractedMusicPath, musicStart,
    badge: madeWithBadge, autoCaptions: uploadAddCaptions, preset: captionPreset, script: voiceScript,
    renderId, renderStatus, renderProgress, outputUrl, overQuota: renderOverQuota, renderError, uploadError,
    ctx: filmRenderContextRef.current, orientation: filmOutputOrientationRef.current,
  })
  const applyEditor = (sn: EditorSnap) => {
    setUploadSlots(sn.slots); setUploadSlotFiles(sn.files); setUploadSlotPaths(sn.paths); setUploadTrims(sn.trims); setUploadSpeeds(sn.speeds); setUploadVols(sn.vols); setUploadMuted(sn.muted ?? {}); setUploadScreenTexts(sn.screenTexts ?? {}); setUploadCrops(sn.crops ?? {}); setUploadPlaces(sn.places ?? {})
    setUploadLooks(sn.looks); setUploadSlotTexts(sn.texts); setUploadOwnTexts(sn.ownTexts); setUploadSpeechSlots(sn.speech); setUploadLandscapeSlots(sn.landscape)
    setUploadCaps(sn.caps); setOverlays(sn.overlays); setVoiceTakes(sn.takes); setAssetPaths(sn.assets)
    setMusicFile(sn.musicFile); setLibraryMusicUrl(sn.libMusicUrl); setLibraryMusicName(sn.libMusicName); setExtractedMusicPath(sn.extracted); setExtractAudioError('')
    // After the music itself is set, so the reset for new music does not undo it
    window.setTimeout(() => setMusicStart(sn.musicStart ?? 0), 0)
    setMadeWithBadge(sn.badge); setUploadAddCaptions(sn.autoCaptions); setCaptionPreset(sn.preset); setVoiceScript(sn.script)
    setRenderId(sn.renderId); setRenderStatus(sn.renderStatus); setRenderProgress(sn.renderProgress); setOutputUrl(sn.outputUrl); setRenderOverQuota(sn.overQuota); setRenderError(sn.renderError); setUploadError(sn.uploadError)
    setSelOverlay(null); setSelCap(null); setCapDraft('')
    filmRenderContextRef.current = sn.ctx
    filmOutputOrientationRef.current = sn.orientation
    // Everything in a waiting tab is already in storage, so point the upload bookkeeping at it
    const mine = (k: string) => /^u\d/.test(k) || k === 'm' || k.startsWith('v:')
    Array.from(clipUploadPromises.keys()).filter(mine).forEach((k) => clipUploadPromises.delete(k))
    const st: Record<string, ClipUploadState> = {}
    Object.entries(sn.paths).forEach(([id, path]) => { clipUploadPromises.set(`u${id}`, Promise.resolve(path)); st[`u${id}`] = 'done' })
    Object.entries(sn.assets).forEach(([k, path]) => { clipUploadPromises.set(k, Promise.resolve(path)); st[k] = 'done' })
    setClipUploadStatus((prev) => ({ ...Object.fromEntries(Object.entries(prev).filter(([k]) => !mine(k))), ...st }))
  }
  const switchEditorTab = (i: number) => {
    if (i === editorTab || !editorTabs[i]?.snap) return
    const busy = uploading || extractingAudio || Object.entries(clipUploadStatus).some(([k, v]) => v === 'uploading' && (/^u\d/.test(k) || k === 'm' || k.startsWith('v:')))
    if (busy) { setEditorTabNote('This video is still uploading. Switch videos when it has finished.'); return }
    setEditorTabNote('')
    const cur = captureEditor()
    const target = editorTabs[i].snap as EditorSnap
    setEditorTabs((tabs) => tabs.map((t, n) => (n === editorTab ? { ...t, snap: cur } : n === i ? { ...t, snap: null } : t)))
    applyEditor(target)
    setEditorTab(i)
  }
  // Videos filmed in Several videos arrive here: each one gets its own editor tab
  const openMultiInEditor = async (h: MultiFilmHandoff) => {
    const lowComfort = parseComfort(profile?.filming_comfort).level === 'low'
    const snaps = await Promise.all(h.videos.map(async (v): Promise<EditorSnap> => {
      const slots = v.clips.map((_, i) => i)
      const files: Record<number, File> = {}
      const paths: Record<number, string> = {}
      const trims: Record<number, ClipTrimRange> = {}
      const texts: Record<number, string[]> = {}
      v.clips.forEach((c, i) => {
        files[i] = c.file
        paths[i] = c.path
        // Cut the screen taps at the start and end of each filmed clip, like a single filmed video
        if (c.duration > 1.5 && c.duration !== 5) trims[i] = { start: 0.3, end: c.duration - 0.3, total: c.duration, file: c.file }
        const own = v.texts[i] && v.texts[i].length > 0 ? v.texts[i] : lowComfort && v.lines[i] ? [v.lines[i]] : []
        if (own.length > 0) texts[i] = own
      })
      const landscape = new Set<number>()
      if (!h.landscape) {
        const sizes = await Promise.all(v.clips.map((c) => getVideoSize(c.file)))
        sizes.forEach((sz, i) => { if (sz && sz.w > sz.h) landscape.add(i) })
      }
      const tags = typeof v.tags === 'string' ? v.tags : Array.isArray(v.tags) ? v.tags.filter((t) => typeof t === 'string').join(' ') : null
      return {
        slots, files, paths, trims, speeds: {}, vols: {}, looks: {}, texts, ownTexts: {}, speech: new Set(slots), landscape,
        caps: [], overlays: [], takes: [], assets: {}, musicFile: null, libMusicUrl: null, libMusicName: null, extracted: null,
        badge: true, autoCaptions: true, preset: captionPreset, script: v.lines.length > 0 ? { id: `multi-${v.key}`, label: v.title, lines: v.lines } : null,
        renderId: null, renderStatus: null, renderProgress: 0, outputUrl: null, overQuota: false, renderError: null, uploadError: '',
        ctx: { ideaId: v.ideaId, source: v.source, title: v.title, caption: v.caption, tags },
        orientation: h.landscape ? 'landscape' : 'portrait',
      }
    }))
    if (snaps.length === 0) return
    setEditorTabs(h.videos.map((v, i) => ({ key: v.key, title: v.title, snap: i === 0 ? null : snaps[i] })))
    setEditorTab(0)
    setEditorTabNote('')
    applyEditor(snaps[0])
    setTab('uploads')
    window.scrollTo({ top: 0 })
  }
  const closeEditorTabs = () => { setEditorTabs([]); setEditorTab(0); setEditorTabNote('') }

  const runUploadAndRender = async () => {
    if (!userId) return
    const slotIds = uploadSlots.filter((id) => uploadSlotFiles[id])
    if (slotIds.length === 0) return

    const run = ++uploadRunRef.current
    setUploading(true)
    setUploadError('')
    setRenderId(null)
    setRenderStatus(null)
    setOutputUrl(null)

    try {
      const clipPaths: string[] = []
      const clipTrims: { duration: number; trimStart?: number; trimLength?: number }[] = []
      const clipSettings: { letterbox?: boolean; speed?: number; volume?: number; muted?: boolean; crop?: ClipCrop; place?: ClipPlace; appearance?: AppearanceSettings }[] = []
      const clipTexts: string[][] = []
      const speechIndices: number[] = []
      let anyLandscape = false
      const isFilmRender = slotIds.every((id) => /\/film\/(filmed|multi)-/.test(uploadSlotPaths[id] || ''))
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
          const edited = uploadScreenTexts[result.slotId]
          const base = edited !== undefined ? (edited ? [edited] : []) : isFilmRender ? (uploadSlotTexts[result.slotId] || []) : []
          const typed = uploadOwnTexts[result.slotId]
          clipTexts.push(uploadAddCaptions && uploadCaptionOwn && typed !== undefined ? (typed.trim() ? [typed.trim()] : []) : base)
        }
        clipTrims.push({ duration: result.duration, trimStart: result.trimStart, trimLength: result.trimLength })
        if (result.isLandscape || filmLandscapeOut) {
          anyLandscape = true
          clipSettings.push({ letterbox: true, speed: uploadSpeeds[result.slotId], volume: uploadVols[result.slotId] === undefined ? undefined : uploadVols[result.slotId] / 100, muted: uploadMuted[result.slotId] || undefined, crop: uploadCrops[result.slotId], place: uploadPlaces[result.slotId], appearance: uploadLooks[result.slotId] })
        } else {
          clipSettings.push({ speed: uploadSpeeds[result.slotId], volume: uploadVols[result.slotId] === undefined ? undefined : uploadVols[result.slotId] / 100, muted: uploadMuted[result.slotId] || undefined, crop: uploadCrops[result.slotId], place: uploadPlaces[result.slotId], appearance: uploadLooks[result.slotId] })
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
              font: { family: captionFontFamily, size: Number(captionFontSize) || 36, color: captionColor, bold: captionBold ?? undefined, italic: captionItalic || undefined, underline: captionUnderline || undefined },
              position: captionPosition,
              borderColor: captionBorderColor,
              backgroundColor: captionBg ?? undefined,
            },
            layers: resolveCaptionLayers(captionLayers, captionPosition, uploadOwnMode),
          }
        : null

      const overlayPayload = await uploadOverlay()
      // Cancelled while the clips were uploading: do not start a render
      if (run !== uploadRunRef.current) return
      const res = await authFetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, clipPaths, captionStyle, captionTextOnly: uploadTextActive && !uploadSpeechActive, musicPath, voiceovers, originalVolume: originalVol, musicVolume: musicVol, musicStart, musicUrl: libraryMusicUrl, speechClipIndices: speechIndices, clipSettings, clipTexts, outputOrientation, clipTrims, resolution: uploadResolution, ideaId: filmCtx?.ideaId ?? null, ideaSource: filmCtx?.source ?? 'upload', ideaTitle: filmCtx?.title ?? null, ideaCaption: filmCtx?.caption ?? null, ideaTags: filmCtx?.tags ?? null, cutDeadSpace: cutDeadSpace && uploadCaps.length === 0, customCaptions: uploadCaps, customCaptionStyle, overlays: overlayPayload, appearance: appearancePayload, madeWithBadge }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Render failed to start')

      const sentPaths: Record<number, string> = { ...uploadSlotPaths }
      uploadResults.forEach((r) => { if (r?.path) sentPaths[r.slotId] = r.path })
      const sentAssets: Record<string, string> = { ...assetPaths }
      voiceTakes.forEach((t, i) => { if (voiceovers[i]?.path) sentAssets[`v:${t.id}`] = voiceovers[i].path })
      if (musicPath && musicFile) sentAssets.m = musicPath
      uploadFailRestoreRef.current = { id: data.renderId, snap: { ...captureEditor(), paths: sentPaths, assets: sentAssets } }
      setRenderId(data.renderId)
      setRenderStatus('queued')
      localStorage.setItem('reelezy-render', JSON.stringify({ id: data.renderId, type: 'upload', ts: Date.now() }))
      // With several videos open, the "ready" pop-up follows this one while you edit the others
      if (editorTabs.length > 1) trackRenders([{ id: data.renderId, title: filmCtx?.title || 'Your video' }])
      filmRenderContextRef.current = null
      filmOutputOrientationRef.current = null
      setUploadSlots([0])
      setUploadSlotFiles({})
      setUploadVols({})
      setUploadMuted({})
      setUploadScreenTexts({})
      setUploadCrops({})
      setUploadPlaces({})
      setUploadSlotPaths({})
      setUploadSpeechSlots(new Set())
      setUploadLandscapeSlots(new Set())
      setMusicFile(null)
      clearVoiceTakes()
      setExtractedMusicPath(null)
      authFetch('/api/delete-draft-clip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, editorType: 'upload' }) })
    } catch (err) {
      if (run === uploadRunRef.current) setUploadError(uploadErrorText(err, 'Something went wrong'))
    } finally {
      if (run === uploadRunRef.current) setUploading(false)
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

  const renderCapMin = userPlan === 'top' ? PLAN_LIMITS.top.renderMinutes : PLAN_LIMITS.basic.renderMinutes

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



  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', fontSize: 13, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", outline: 'none', boxSizing: 'border-box' as const, color: 'var(--ink)' }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5, display: 'block' as const }

  const tourSteps: TourStep[] = [
    { id: 'create', target: 'menu-item-ideas', title: 'Start with an idea', body: 'Open the Create menu and press Content Ideas. This is where every video begins.', enter: () => { setTab('overview'); setOpenDropdown('create') }, advanceOnClick: true },
    { id: 'generate', target: 'ideas-generate', title: 'Get video ideas', body: 'Press Generate and we write ideas that fit your business. Save the ones you like.', enter: () => { setOpenDropdown(null); setTab('ideas') }, advanceOnClick: true },
    { id: 'instructions', target: 'tab-filming', title: 'Your shot list', body: 'Instructions turns a saved idea into a script and a list of shots, so you know exactly what to film.', enter: () => { setOpenDropdown(null) } },
    { id: 'film', target: 'tab-film', title: 'Film it', body: 'Film opens your camera with the script scrolling on screen. Or film on your phone as normal and upload it in the next step.', enter: () => { setOpenDropdown(null) } },
    { id: 'edit', target: 'tab-edit', title: 'Choose how to edit', body: 'AI Editor For Generated Idea follows the shot list you made. For Any Video lets you edit clips you already have.', enter: () => { setOpenDropdown('edit') } },
    { id: 'clips', target: 'choose-clip', title: 'Add your clips', body: 'Pick clips from your device or from your library. Add as many as you need.', enter: () => { setOpenDropdown(null); setTab('uploads') } },
    { id: 'create-video', target: 'create-video', title: 'Make the video', body: 'When your clips are in, press Create video. We add captions and music and send you the finished video.', enter: () => { setOpenDropdown(null); setTab('uploads') } },
    { id: 'publish', target: 'tab-publish', title: 'Publish it', body: 'Publish keeps your finished videos in one place so you can download them and post.', enter: () => { setOpenDropdown(null); setTab('scheduler') } },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)' }}>
      <Tour userId={userId} runKey={tourRun} steps={tourSteps} onStatus={(how) => setTourDone(how === 'done')} />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .vs-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 12px; }
        .vs-grid .vs-q { grid-column: 1 / 3; }
        .vs-grid .vs-t { grid-column: 3; }
        @media (max-width: 640px) {
          .vs-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .vs-grid .vs-q { grid-column: 1 / 3; }
          .vs-grid .vs-t { grid-column: 1 / 3; margin-top: 6px; }
          .vs-grid label { grid-column: 1 / 3; }
        }
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
        .ed-preview { max-width: 100%; box-sizing: border-box; }
        .ed-preview button { max-width: 100%; }
        @media (max-width: 600px) {
          .ed-preview { padding: 14px !important; }
        }
        @media (min-width: 1024px) {
          .ed-split { display: grid !important; grid-template-columns: 380px minmax(0, 1fr); column-gap: 32px !important; row-gap: 0 !important; align-items: start; }
          .ed-split > .ed-main { grid-column: 2; grid-row: 1; min-width: 0; margin: 0; }
          .ed-split > .ed-preview { grid-column: 1; grid-row: 1; align-self: start; margin: 0; }
          /* The preview stays on screen while the settings beside it scroll */
          .ed-split > .ed-preview { position: sticky !important; top: 16px; max-height: calc(100vh - 32px); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
        }
        /* Phone editor (only ever on screens under 1024px): one screen, nothing on the page scrolls */
        body:has(.ed-app) { overflow: hidden; }
        .ed-app { position: fixed !important; inset: 0; z-index: 300; height: 100vh; height: 100dvh; display: flex !important; flex-direction: column !important; gap: 0 !important; background: var(--background); overflow: hidden; }
        .ed-app > .ed-mtop { order: 0; flex: none; }
        .ed-app > .ed-mtabs { order: 1; flex: none; padding: 4px 12px 0; background: var(--card-bg); }
        .ed-app > .ed-mtabs > div { margin-bottom: 0 !important; }
        .ed-app > .ed-preview { order: 2; flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; padding: 8px 12px 6px !important; border-radius: 0 !important; background: transparent !important; position: relative; }
        .ed-app > .ed-preview > .ed-pin { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }
        .ed-app .ed-stagebox { flex: 1 1 0; min-height: 0; display: flex; align-items: center; justify-content: center; }
        .ed-app .ed-stagebox > div { height: 100% !important; width: auto !important; max-width: 100%; min-width: 0 !important; margin: 0 !important; }
        .ed-app .ed-ctrl { flex-wrap: nowrap !important; }
        .ed-app .ed-ctrl > button:last-child { padding: 8px 14px !important; }
        .ed-app .ed-tl { flex: none; max-height: 34vh; overflow-y: auto; overscroll-behavior: contain; }
        .ed-app > .ed-main { order: 3; flex: 0 1 auto; max-height: 50vh; max-height: 50dvh; overflow-y: auto; overscroll-behavior: contain; gap: 0 !important; background: var(--sand); border-top: 1px solid var(--line); box-shadow: 0 -6px 18px rgba(0,0,0,0.06); }
        @media (max-height: 720px) { .ed-app > .ed-main { max-height: 44vh; max-height: 44dvh; } }
        .ed-app > .ed-main.ed-mhide { display: none !important; }
        .ed-app.ed-done > .ed-main { flex: 1 1 0; max-height: none; }
        .ed-app .ed-tool { display: none; }
        .ed-app .ed-tool.on { display: block; }
        .ed-app .ed-tool > div { border-radius: 0 !important; }
        .ed-app > .ed-mnav { order: 4; flex: none; }
        .ed-app > .ed-mnav::-webkit-scrollbar { display: none; }
        /* A phone held sideways: the video on the left, the open tool on the right */
        @media (orientation: landscape) and (max-height: 500px) {
          .ed-app { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr) auto; }
          .ed-app > .ed-mtop, .ed-app > .ed-mtabs, .ed-app > .ed-mnav { grid-column: 1 / -1; }
          .ed-app > .ed-mtop { grid-row: 1; } .ed-app > .ed-mtabs { grid-row: 2; } .ed-app > .ed-mnav { grid-row: 4; }
          .ed-app > .ed-preview { grid-column: 1; grid-row: 3; }
          .ed-app > .ed-main { grid-column: 2; grid-row: 3; max-height: none !important; border-top: none; border-left: 1px solid var(--line); box-shadow: none; }
          .ed-app:has(> .ed-main.ed-mhide) > .ed-preview, .ed-app.ed-done > .ed-main { grid-column: 1 / -1; }
        }
        .ed-app.ed-done > .ed-main video { display: block; width: auto !important; max-width: 100% !important; max-height: 52vh; max-height: 52dvh; margin: 12px auto 0 !important; }
        /* The render pop-up sits above the tool bar instead of over it */
        body:has(.ed-app) .rdt { bottom: calc(80px + env(safe-area-inset-bottom)) !important; }
        body:has(.rdt) .ed-app.ed-done > .ed-main { padding-bottom: 190px; }
        @media (max-height: 720px) { .ed-app.ed-done > .ed-main video { max-height: 42vh; max-height: 42dvh; } }
      `}</style>
      {showOverageModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "var(--sand)", borderRadius: 4, padding: "32px", maxWidth: 420, width: "100%" }}>
            <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 12 }}>You&apos;ve reached your monthly render limit</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 24 }}>
              You&apos;ve used all your included render minutes for this month. You can keep rendering for now at no extra cost, but very heavy use may be limited under our fair use terms. Your minutes reset at the start of next month.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setShowOverageModal(false); setPendingRenderAction(null) }}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 4, border: "1px solid var(--line)", background: "transparent", fontSize: 14, color: "var(--ink)", cursor: "pointer" }}
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
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,106,77,0.08)', border: '1px solid rgba(255,106,77,0.3)', borderRadius: 4, padding: '8px 18px', fontSize: 13, color: 'var(--coral)', fontWeight: 600, maxWidth: '100%', boxSizing: 'border-box' }}>
            <span className="rly-spinner" style={{ flexShrink: 0 }} />
            Rendering in the background - feel free to navigate away
          </div>
        </div>
      )}
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav className="dashboard-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 48px' }}>
          <ReelezyLogo size={32} />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a href="/settings?section=billing" className="plan-badge" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--sand)", border: "1px solid var(--line)", borderRadius: 4, padding: "6px 14px", textDecoration: "none", color: "var(--ink)", fontSize: 12, fontWeight: 600 }}>
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
          <div className="dash-hero" style={{ background: 'var(--sand)', border: '1px solid var(--line)', borderRadius: 4, padding: '20px 26px', marginBottom: 22, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px 32px' }}>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <h1 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              Welcome back, {profile?.business_name}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {profile?.industry} · {profile?.suburb}
            </p>
            {!tourDone && <button type="button" onClick={() => setTourRun((n) => n + 1)} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', marginTop: 12 }}>Take the tour</button>}
            </div>
          </div>

          <div style={{ position: 'relative', marginBottom: 22 }}>
            <div ref={(el) => { navScrollRef.current = el; if (el) setTimeout(checkNavEnd, 0) }} onScroll={checkNavEnd} className="dashboard-tabs-scroll" style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--line)', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }} onClick={() => setOpenDropdown(null)}>

            {/* Overview */}
            <button onClick={(e) => { e.stopPropagation(); setTab('overview'); setOpenDropdown(null) }} style={{ background: 'none', border: 'none', borderBottom: tab === 'overview' ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: tab === 'overview' ? 600 : 500, color: tab === 'overview' ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap' }}>
              Overview
            </button>

            {/* Create dropdown */}
            <div ref={createBtnRef} style={{ position: 'relative' }}>
              <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'create' ? null : 'create') }} data-tour="tab-create" data-dropdown style={{ background: 'none', border: 'none', borderBottom: ['ideas','script'].includes(tab) ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: ['ideas','script'].includes(tab) ? 600 : 500, color: ['ideas','script'].includes(tab) ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                Create <span style={{ fontSize: 11, opacity: 0.6 }}><Icon n="down" /></span>
              </button>
              {openDropdown === 'create' && typeof document !== 'undefined' && createPortal(
                <div data-dropdown data-tour="create-menu" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: (createBtnRef.current?.getBoundingClientRect().bottom ?? 48) + 4, left: Math.max(8, Math.min(createBtnRef.current?.getBoundingClientRect().left ?? 0, (typeof window !== 'undefined' ? window.innerWidth : 360) - 268)), background: 'var(--sand)', border: '1px solid var(--line)', borderRadius: 4, padding: '6px', zIndex: 1000, minWidth: 180, width: 'max-content', maxWidth: 'calc(100vw - 16px)', boxShadow: 'none' }}>
                  {[{ id: 'ideas', label: 'Content Ideas' }, { id: 'script', label: 'Script Generator' }, { id: 'carousel', label: 'Carousel Reels', pro: true }].map((item) => (
                    <button key={item.id} data-tour={`menu-item-${item.id}`} onClick={() => { setTab(item.id as Tab); setOpenDropdown(null) }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', background: tab === item.id ? 'rgba(255,106,77,0.08)' : 'none', border: 'none', borderRadius: 4, padding: '9px 12px', fontSize: 13, fontWeight: tab === item.id ? 600 : 400, color: tab === item.id ? 'var(--coral)' : 'var(--ink)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif" }}>
                      {item.label}{(item as {pro?: boolean}).pro && !isProPlan ? <span style={{ fontSize: 11, color: 'var(--coral)' }}>Pro</span> : ''}
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </div>

            {/* My Ideas tab */}
            <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); setTab('myideas') }} style={{ background: 'none', border: 'none', borderBottom: tab === 'myideas' ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: tab === 'myideas' ? 600 : 500, color: tab === 'myideas' ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap' }}>
              My Ideas{savedIdeas.length > 0 ? ` (${savedIdeas.length})` : ''}
            </button>

            {/* Instructions tab */}
            <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); setTab('filming') }} data-tour="tab-filming" style={{ background: 'none', border: 'none', borderBottom: tab === 'filming' ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: tab === 'filming' ? 600 : 500, color: tab === 'filming' ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap' }}>
              Instructions
            </button>

            {/* Film tab */}
            <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); setTab('film') }} data-tour="tab-film" style={{ background: 'none', border: 'none', borderBottom: tab === 'film' ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: tab === 'film' ? 600 : 500, color: tab === 'film' ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap' }}>
              Film
            </button>

            {/* Edit dropdown */}
            <div ref={editBtnRef} style={{ position: 'relative' }}>
              <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'edit' ? null : 'edit') }} data-tour="tab-edit" data-dropdown style={{ background: 'none', border: 'none', borderBottom: ['aiuploads','uploads'].includes(tab) ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: ['aiuploads','uploads'].includes(tab) ? 600 : 500, color: ['aiuploads','uploads'].includes(tab) ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                Edit <span style={{ fontSize: 11, opacity: 0.6 }}><Icon n="down" /></span>
              </button>
              {openDropdown === 'edit' && typeof document !== 'undefined' && createPortal(
                <div data-dropdown data-tour="edit-menu" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: (editBtnRef.current?.getBoundingClientRect().bottom ?? 48) + 4, left: Math.max(8, Math.min(editBtnRef.current?.getBoundingClientRect().left ?? 0, (typeof window !== 'undefined' ? window.innerWidth : 360) - 268)), background: 'var(--sand)', border: '1px solid var(--line)', borderRadius: 4, padding: '6px', zIndex: 1000, minWidth: 180, width: 'max-content', maxWidth: 'calc(100vw - 16px)', boxShadow: 'none' }}>
                  {[{ id: 'aiuploads', label: 'AI Editor For Generated Idea' }, { id: 'uploads', label: 'AI Editor For Any Video' }].map((item) => (
                    <button key={item.id} data-tour={`menu-item-${item.id}`} onClick={() => { setTab(item.id as Tab); setOpenDropdown(null) }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', background: tab === item.id ? 'rgba(255,106,77,0.08)' : 'none', border: 'none', borderRadius: 4, padding: '9px 12px', fontSize: 13, fontWeight: tab === item.id ? 600 : 400, color: tab === item.id ? 'var(--coral)' : 'var(--ink)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif" }}>
                      {item.label}
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </div>

            {/* Publish button */}
            <button onClick={(e) => { e.stopPropagation(); setTab('scheduler'); setOpenDropdown(null) }} data-tour="tab-publish" style={{ background: 'none', border: 'none', borderBottom: tab === 'scheduler' ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: tab === 'scheduler' ? 600 : 500, color: tab === 'scheduler' ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap' }}>
              Publish
            </button>

            {/* Clip library button */}
            <button onClick={(e) => { e.stopPropagation(); setTab('library'); setOpenDropdown(null) }} style={{ background: 'none', border: 'none', borderBottom: tab === 'library' ? '2px solid var(--coral)' : '2px solid transparent', padding: '10px 36px', fontSize: 14, fontWeight: tab === 'library' ? 600 : 500, color: tab === 'library' ? 'var(--ink)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap' }}>
              Library
            </button>

            </div>
            {/* Scroll arrow */}
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 1, width: 48, background: 'linear-gradient(to right, transparent, var(--background) 70%)', display: navAtEnd ? 'none' : 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, pointerEvents: 'none' }}>
              <span style={{ fontSize: 18, color: 'var(--text-muted)' }}><Icon n="forward" /></span>
            </div>
          </div>



          {SHOW_OVERVIEW_PANELS && tab === 'overview' && (
            <OverviewPanel isFree={isFreeTier} ideasReady={ideas.length} onGo={(t) => { setTab(t); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
          )}
          {tab === 'overview' && (
            <div className="dash-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14, marginBottom: 20 }}>
              {stats.map((s) => (
                s.tab ? (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => { setTab(s.tab); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    aria-label={`${s.label}: ${s.value}. Open the ${s.tab} tab`}
                    style={{ background: '#FFFFFF', border: '1px solid var(--line)', borderRadius: 4, padding: '12px 16px', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                  >
                    <p style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)', margin: 0 }}>{s.value}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{s.label}</p>
                  </button>
                ) : (
                <div key={s.label} style={{ background: '#FFFFFF', border: '1px solid var(--line)', borderRadius: 4, padding: '12px 16px' }}>
                  <p style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)' }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{s.label}</p>
                </div>
                )
              ))}
            </div>
          )}
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
                  {ideas.length > 0 ? `You have ${ideas.length} ${ideas.length === 1 ? 'idea' : 'ideas'} ready to review.` : profile?.suburb ? `Generate ideas tailored for ${profile.suburb}.` : 'Generate ideas tailored for your business.'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--coral)', marginTop: 12, fontWeight: 600 }}>Go to Content Ideas</p>
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
                <p style={{ fontSize: 12, color: 'var(--coral)', marginTop: 12, fontWeight: 600 }}>Go to AI Editor For Generated Idea</p>
              </button>
              <button
                onClick={() => setTab('scheduler')}
                style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'opacity 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--ink)' }}>
                  Publish
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  See your finished videos and download them, ready to post.
                </p>
                <p style={{ fontSize: 12, color: 'var(--coral)', marginTop: 12, fontWeight: 600 }}>Go to Publish</p>
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
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", resize: 'none', boxSizing: 'border-box' as const, lineHeight: 1.5 }}
                      />
                    </div>
                  </div>
                  <div className="ideas-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 22, flexShrink: 0 }}>
                    <button
                      onClick={generateIdeas}
                      data-tour="ideas-generate"
                      disabled={generatingIdeas}
                      style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 20px', borderRadius: 4, fontSize: 13, fontWeight: 600, border: 'none', cursor: generatingIdeas ? 'not-allowed' : 'pointer', opacity: generatingIdeas ? 0.7 : 1, whiteSpace: 'nowrap' }}
                    >
                      {generatingIdeas ? <><span className='rly-spinner' />Generating...</> : ideas.length > 0 ? 'Generate more' : 'Generate ideas'}
                    </button>
                    <button onClick={undoIdeas} disabled={batchIndex <= 0} title="Previous batch" style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '9px 12px', fontSize: 16, color: batchIndex > 0 ? 'var(--ink)' : 'var(--text-muted)', cursor: batchIndex > 0 ? 'pointer' : 'not-allowed', opacity: batchIndex > 0 ? 1 : 0.5, lineHeight: 1 }}><Icon n="back" /></button>
                    {weeklyBatches.length > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{batchIndex + 1} of {weeklyBatches.length}</span>
                    )}
                    <button onClick={redoIdeas} disabled={batchIndex >= weeklyBatches.length - 1} title="Next batch" style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '9px 12px', fontSize: 16, color: batchIndex < weeklyBatches.length - 1 ? 'var(--ink)' : 'var(--text-muted)', cursor: batchIndex < weeklyBatches.length - 1 ? 'pointer' : 'not-allowed', opacity: batchIndex < weeklyBatches.length - 1 ? 1 : 0.5, lineHeight: 1 }}><Icon n="forward" /></button>
                  </div>
                </div>

                {/* Row 2: seasonal mode + tone - full width */}
                <div className="ideas-row2" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Seasonal */}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>Content style</p>
                    <div className="ideas-style-cards" style={{ display: 'flex', gap: 6 }}>
                      {([
                        { id: 'seasonal', label: 'Seasonal', desc: 'Tied to upcoming dates & events', icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2.5" width="12" height="10.5" rx="1.5"/><line x1="1" y1="5.5" x2="13" y2="5.5"/><line x1="4.5" y1="1" x2="4.5" y2="4"/><line x1="9.5" y1="1" x2="9.5" y2="4"/></svg> },
                        { id: 'mix', label: 'Mix', desc: 'Seasonal + timeless blend', icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="7" cy="7" r="5.5"/><path d="M7 1.5 A5.5 5.5 0 0 1 7 12.5" fill="currentColor" fillOpacity="0.15"/><line x1="7" y1="1.5" x2="7" y2="12.5"/></svg> },
                        { id: 'evergreen', label: 'Timeless', desc: 'Works any time of year', icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="5.5"/><polyline points="7,3.5 7,7 9.5,9"/></svg> },
                      ] as { id: 'seasonal' | 'mix' | 'evergreen'; label: string; desc: string; icon: React.ReactNode }[]).map((opt) => (
                        <button key={opt.id} type="button" onClick={() => setSeasonalMode(opt.id)} style={{ flex: 1, padding: '7px 10px', borderRadius: 4, border: seasonalMode === opt.id ? '1.5px solid var(--coral)' : '1px solid var(--line)', background: seasonalMode === opt.id ? 'rgba(255,106,77,0.1)' : 'var(--card-bg)', cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", textAlign: 'left' as const }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: seasonalMode === opt.id ? 'var(--coral)' : 'var(--ink)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>{opt.icon}{opt.label}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Tone */}
                  <div className="ideas-tone" style={{ flexShrink: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>Tone</p>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {([
                        { id: null, label: 'Default' },
                        { id: 'casual', label: 'Casual' },
                        { id: 'professional', label: 'Professional' },
                        { id: 'humorous', label: 'Humorous' },
                        { id: 'heartfelt', label: 'Inspirational' },
                      ] as { id: string | null; label: string }[]).map((t) => (
                        <button key={t.id ?? 'default'} type="button" onClick={() => setToneOverride(t.id)} style={{ padding: '4px 10px', borderRadius: 4, border: toneOverride === t.id ? '1.5px solid var(--coral)' : '1px solid var(--line)', background: toneOverride === t.id ? 'rgba(255,106,77,0.1)' : 'var(--card-bg)', color: toneOverride === t.id ? 'var(--coral)' : 'var(--text-secondary)', fontSize: 11, fontWeight: toneOverride === t.id ? 600 : 400, cursor: 'pointer', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", whiteSpace: 'nowrap' }}>
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
                    <a href="/plans" style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 600, textDecoration: 'none' }}>{userPlan === 'mid' ? 'Upgrade to Pro' : 'Upgrade to Basic'}</a>
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
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }}
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
                            <Icon n="close" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
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
                  Star an idea to save and get filming instructions
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                {ideas.map((idea) => (
                  <div key={idea.id} style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px', position: 'relative' }}>
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
                      {savedIds.has(idea.id) ? <Icon n="star" /> : <Icon n="starOutline" />}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      {idea.source === 'script' && (
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', background: 'rgba(255,106,77,0.12)', color: 'var(--coral)', borderRadius: 4, padding: '2px 7px', border: '1px solid rgba(255,106,77,0.25)' }}>From script</span>
                      )}
                    </div>
                    <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 10, paddingRight: 24 }}>
                      {idea.title}
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                      {idea.hook}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 12 }}>
                      {idea.description}
                    </p>                    <p style={{ fontSize: 12, color: 'var(--coral)' }}>{(() => { try { const t = JSON.parse(idea.tags); return Array.isArray(t) ? t.join(" ") : idea.tags } catch { return idea.tags } })()}</p>
                    {savedIds.has(idea.id) && (
                      <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 12 }}>
                        <button
                          onClick={() => setTab('myideas')}
                          style={{ background: 'rgba(255,106,77,0.1)', border: '1px solid rgba(255,106,77,0.3)', borderRadius: 4, padding: '5px 12px', fontSize: 12, color: 'var(--coral)', cursor: 'pointer', fontWeight: 600 }}
                        >
                          View in My Ideas
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
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid var(--line)", background: "var(--card-bg)", color: "var(--ink)", fontSize: 12, marginBottom: 8, boxSizing: "border-box" }}
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
                              style={{ background: "none", border: "1px solid var(--line)", borderRadius: 4, padding: "6px 12px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}
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
                    style={{ marginTop: 14, background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}
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
                        style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        View old ideas
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                    {savedIdeas.map((idea) => (
                      <div key={idea.id} style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px', position: 'relative' }}>
                        <button
                          onClick={() => toggleSave(idea.id)}
                          style={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            background: 'none',
                            border: '1px solid #D92D20',
                            borderRadius: 4,
                            padding: '3px 10px',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#D92D20',
                          }}
                        >
                          Remove
                        </button>
                        <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 10, paddingRight: 90 }}>
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
                            style={{ width: '100%', marginTop: 12, padding: '10px 12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", minHeight: 70, resize: 'vertical', boxSizing: 'border-box' }}
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
                  <div style={{ borderTop: '1px solid var(--line)', marginBottom: 24 }} />
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
                                style={{ background: 'none', border: '1px solid #D92D20', borderRadius: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600, color: '#D92D20', cursor: 'pointer' }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {s.script.split(/(?<=[.!?])\s+/).map((sentence: string, i: number, arr: string[]) => (
                              <div key={i} style={{ paddingTop: i === 0 ? 0 : 8, paddingBottom: 8, borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
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
                <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px', marginBottom: 24 }}>
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 24px', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
                    <div style={{ maxWidth: '100%' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Video length</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {[{ val: 15, label: '15s' }, { val: 30, label: '30s' }, { val: 45, label: '45s' }, { val: 60, label: '1 min' }].map((opt) => (
                          <button key={opt.val} type="button" onClick={() => setVideoLength(opt.val)} style={{ padding: '6px 12px', borderRadius: 4, border: videoLength === opt.val ? '2px solid var(--coral)' : '1px solid var(--line)', background: videoLength === opt.val ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', fontSize: 12, fontWeight: videoLength === opt.val ? 600 : 400, color: videoLength === opt.val ? 'var(--coral)' : 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
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
                          { id: 'default', label: 'Standard', tip: 'Best for most reels. A balanced mix of shots and clear instructions that works for any business.' },
                          { id: 'multi', label: 'Multi-shot', tip: 'Lots of fast cuts. Great for real estate, tutorials or product showcases that need a polished look.' },
                          { id: 'single', label: 'Single shot', tip: 'One continuous shot. Perfect for vlogs, talking to camera or quick product demos.' },
                          { id: 'quick', label: 'Limited time', tip: 'Busy? 2-3 simple steps, 15-25 seconds total. Grab your phone and film in under 2 minutes.' },
                        ].map((mode) => (
                          <Tooltip key={mode.id} text={mode.tip} position="bottom">
                            <button type="button" onClick={() => setFilmingMode(mode.id as 'default' | 'multi' | 'single' | 'quick')} style={{ padding: '6px 12px', borderRadius: 4, border: filmingMode === mode.id ? '2px solid var(--coral)' : '1px solid var(--line)', background: filmingMode === mode.id ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', fontSize: 12, fontWeight: filmingMode === mode.id ? 600 : 400, color: filmingMode === mode.id ? 'var(--coral)' : 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
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
                    style={{ background: "none", border: "1px solid var(--line)", borderRadius: 4, padding: "8px 14px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}
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
                      <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--line)' }}>
                        <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                          {item.title}
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--coral)' }}>{item.tags}</p>
                      </div>

                      {/* What you'll need */}
                      {item.prep && item.prep.length > 0 && (
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', background: 'rgba(128,128,128,0.04)' }}>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>What you'll need</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {item.prep.map((p, i) => (
                              <span key={i} style={{ fontSize: 12, color: 'var(--ink)', background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 4, padding: '4px 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Filming steps */}
                      <div style={{ padding: '16px 24px', borderBottom: item.caption || item.script ? '1px solid var(--line)' : 'none' }}>
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
                                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--coral)', background: 'rgba(255,106,77,0.1)', borderRadius: 4, padding: '2px 6px', marginBottom: 4, display: 'inline-block' }}>
                                      {timeRange}
                                    </span>
                                  )}
                                  <p style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.6, fontWeight: 500 }}>{silentCaptions(item) ? simplifyFilmAction(instruction) : instruction}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Caption */}
                      {item.caption && (
                        <div style={{ padding: '16px 24px', borderBottom: item.script ? '1px solid var(--line)' : 'none', background: 'rgba(128,128,128,0.04)' }}>
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
                                  <div key={i} style={{ paddingTop: i === 0 ? 0 : 14, paddingBottom: 14, borderBottom: i < sentences.length - 1 ? '1px solid var(--line)' : 'none' }}>
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
                                            await supabase.from('generated_ideas').update({ checklist: { steps: newChecklist, prep: item.prep, caption: item.caption, script: newScript, directions: item.directions } }).eq('id', item.id)
                                          }} style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--coral)', border: 'none', borderRadius: 4, padding: '5px 12px', cursor: 'pointer' }}>Save</button>
                                          <button onClick={() => setEditingScriptItemId(null)} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '5px 12px', cursor: 'pointer' }}>Cancel</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                        <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.65, flex: 1 }}>{sentence}</p>
                                        <button onClick={() => { setEditingScriptItemId(editKey); setEditingScriptText(sentence) }} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}>Edit</button>
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
                      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
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
              <a href="/plans" style={{ fontSize: 13, color: '#fff', background: 'var(--coral)', padding: '10px 18px', borderRadius: 4, fontWeight: 600, textDecoration: 'none' }}>Upgrade to Pro</a>
            </div>
          )}
          {tab === 'carousel' && isProPlan && (
            <div>
              <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '32px', marginBottom: 24 }}>
                <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Create a carousel
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Add your pictures, put them in order and save. This makes a swipeable picture post, not a video.
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
                        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}><Icon n="grip" /></span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{i + 1}</span>
                        <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeCarouselFile(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
                        >
                          <Icon n="close" />
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
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", resize: 'vertical', boxSizing: 'border-box', marginBottom: 16 }}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, margin: 0 }}>Your carousels</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{savedCarousels.length} saved. They also appear in Publish.</p>
                    </div>
                    {savedCarousels.length > 1 && (
                      <button type="button" onClick={downloadAllCarousels} style={carouselBtn.secondary}><Icon n="download" />Download all</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))', gap: 12 }}>
                    {savedCarousels.map((c, ci) => (
                      <CarouselCard key={c.id} c={c} index={savedCarousels.length - 1 - ci} onDelete={() => deleteCarousel(c.id)} onPublish={() => setTab('scheduler')} />
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
                  <a href="/plans" style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', marginLeft: 16 }}>Upgrade to Pro</a>
                </div>
              )}
              <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '32px', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, margin: 0 }}>Script Generator</h3>
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 4, padding: '6px 12px', textAlign: 'center', flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{scriptsThisWeek} / {isFreeTier ? 3 : isProPlan ? 96 : 20}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>scripts</p>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Type in any idea or topic, pick a length and style, and get a full word-for-word script. You don&apos;t need a saved idea.
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
                      style={{ padding: "8px 14px", borderRadius: 4, border: scriptLength === opt.id ? "2px solid var(--coral)" : "1px solid var(--line)", background: "var(--card-bg)", fontSize: 12, color: "var(--ink)", cursor: "pointer" }}
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

                {generatedScript && (() => {
                  const sentences = generatedScript.split(/(?<=[.!?])\s+/).map((x: string) => x.trim()).filter((x: string) => x.length > 0)
                  const open = savedScripts.find((x) => x.id === openScriptId)
                  return (
                    <div style={{ background: 'var(--card-bg)', borderRadius: 4, padding: 24, border: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 4px' }}>Your script</p>
                          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.4 }}>{open?.topic || scriptTopic}</p>
                        </div>
                        <button type="button" onClick={() => { setGeneratedScript(null); setOpenScriptId(null) }} aria-label="Close script" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, flexShrink: 0 }}><Icon n="close" /></button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {sentences.map((sentence: string, i: number) => (
                          <div key={i} style={{ paddingTop: i === 0 ? 0 : 12, paddingBottom: 12, borderBottom: i < sentences.length - 1 ? '1px solid var(--line)' : 'none' }}>
                            <p style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.6, fontWeight: 500, margin: 0 }}>{sentence}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                        <button type="button" onClick={async () => { if (!profile) return; await proceedToFilming([{ id: 'script-gen', title: open?.topic || scriptTopic, hook: generatedScript.split(/[.!?]/)[0] || scriptTopic, description: open?.topic || scriptTopic, tags: '', script: generatedScript } as Idea]) }} style={carouselBtn.primary}>Make filming instructions</button>
                        <button type="button" onClick={() => { void navigator.clipboard.writeText(generatedScript).then(() => { setScriptCopied('open'); setTimeout(() => setScriptCopied(null), 1500) }) }} style={carouselBtn.secondary}><Icon n={scriptCopied === 'open' ? 'check' : 'copy'} />{scriptCopied === 'open' ? 'Copied' : 'Copy script'}</button>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {savedScripts.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, margin: 0 }}>Your scripts</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{savedScripts.length} saved, newest first</p>
                    </div>
                    {confirmScriptDelete === 'all' ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Delete all {savedScripts.length} scripts?</span>
                        <button type="button" onClick={() => setConfirmScriptDelete(null)} style={carouselBtn.secondary}>Keep</button>
                        <button type="button" onClick={async () => { if (!userId) return; await supabase.from('generated_scripts').delete().eq('user_id', userId); setSavedScripts([]); setGeneratedScript(null); setOpenScriptId(null); setConfirmScriptDelete(null) }} style={{ ...carouselBtn.danger, background: '#D92D20', color: '#fff' }}>Delete all</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmScriptDelete('all')} style={carouselBtn.danger}>Delete all</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 12 }}>
                    {savedScripts.map((sc) => {
                      const isOpen = openScriptId === sc.id && !!generatedScript
                      const first = sc.script.split(/(?<=[.!?])\s+/)[0] || sc.script
                      const meta = [sc.length ? sc.length.charAt(0).toUpperCase() + sc.length.slice(1) : null, sc.style, new Date(sc.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })].filter(Boolean)
                      return (
                        <div key={sc.id} style={{ background: '#fff', border: `1px solid ${isOpen ? 'var(--coral)' : 'var(--line)'}`, borderRadius: 4, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px', lineHeight: 1.4 }}>{sc.topic}</p>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {meta.map((m) => <span key={m as string} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--sand)', borderRadius: 999, padding: '2px 9px' }}>{m}</span>)}
                            </div>
                          </div>
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{first}</p>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 'auto' }}>
                            <button type="button" onClick={() => { setGeneratedScript(sc.script); setScriptTopic(sc.topic); setOpenScriptId(sc.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={carouselBtn.primary}>{isOpen ? 'Open now' : 'Open'}</button>
                            <button type="button" onClick={async () => { if (!profile) return; await proceedToFilming([{ id: 'script-gen', title: sc.topic, hook: first, description: sc.topic, tags: '', script: sc.script } as Idea]) }} style={carouselBtn.secondary}>Film this</button>
                            <button type="button" onClick={() => { void navigator.clipboard.writeText(sc.script).then(() => { setScriptCopied(sc.id); setTimeout(() => setScriptCopied(null), 1500) }) }} style={carouselBtn.secondary} aria-label="Copy script"><Icon n={scriptCopied === sc.id ? 'check' : 'copy'} />{scriptCopied === sc.id ? 'Copied' : 'Copy'}</button>
                            <span style={{ flex: 1 }} />
                            {confirmScriptDelete === sc.id ? (
                              <>
                                <button type="button" onClick={() => setConfirmScriptDelete(null)} style={carouselBtn.secondary}>Keep</button>
                                <button type="button" onClick={async () => { if (!userId) return; await supabase.from('generated_scripts').delete().eq('id', sc.id).eq('user_id', userId); setSavedScripts((prev) => prev.filter((x) => x.id !== sc.id)); if (openScriptId === sc.id) { setGeneratedScript(null); setOpenScriptId(null) } setConfirmScriptDelete(null) }} style={{ ...carouselBtn.danger, background: '#D92D20', color: '#fff' }}>Delete</button>
                              </>
                            ) : (
                              <button type="button" onClick={() => setConfirmScriptDelete(sc.id)} style={carouselBtn.danger}>Delete</button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === 'library' && (
            <>
              <ClipLibrary userId={userId} plan={isFreeTier ? 'free' : userPlan} onPlans={() => { window.location.href = '/plans' }} />
              <AudioLibrary userId={userId} plan={isFreeTier ? 'free' : userPlan} />
              <OverlayElements userId={userId} />
            </>
          )}
          {audioPicker && (
            <AudioPicker userId={userId} onClose={() => setAudioPicker(false)} onPick={(file, clip) => addVoiceFile(file, clip.path)} />
          )}
          {musicPicker && (
            <AudioPicker userId={userId} title="Pick music" onClose={() => setMusicPicker(false)} onPick={(file, clip) => applySavedSoundAsMusic(file, clip.path)} onPickFile={pickMusicFileAndSave} onExtract={(f) => { void handleExtractAudio(f) }} />
          )}
          {libraryPicker && (
            <LibraryPicker
              userId={userId}
              plan={isFreeTier ? 'free' : userPlan}
              single={libraryPicker === 'film' || libraryPicker === 'slot' || libraryPicker === 'step'}
              title={libraryPicker === 'film' || libraryPicker === 'slot' || libraryPicker === 'step' ? 'Use a saved clip' : undefined}
              onClose={() => setLibraryPicker(null)}
              onAdd={(files, picked) => {
                const libPaths = new Map<File, string>()
                files.forEach((f, i) => { if (picked[i]) libPaths.set(f, picked[i].path) })
                if (libraryPicker === 'film') {
                  const f = files[0]
                  if (f) { setFilmRecordError(''); setFilmPending({ blob: f, ext: (f.name.split('.').pop() || 'mp4').toLowerCase(), type: f.type || 'video/mp4', url: URL.createObjectURL(f) }) }
                } else if (libraryPicker === 'slot') {
                  const f = files[0]
                  if (f && userId) { setUploadSlotFiles((prev) => ({ ...prev, [libraryTarget]: f })); const lp = libPaths.get(f); if (lp) adoptClipPath('u', libraryTarget, lp); else startClipUpload('u', libraryTarget, f) }
                } else if (libraryPicker === 'step') {
                  const f = files[0]
                  if (f) { setStepUploads((prev) => ({ ...prev, [libraryTarget]: f })); const lp = libPaths.get(f); if (lp) adoptClipPath('a', libraryTarget, lp); else startClipUpload('a', libraryTarget, f) }
                } else if (libraryPicker === 'ai') addAiFiles(files, libPaths)
                else addUploadFiles(files, libPaths)
              }}
            />
          )}

          {overlayPicker && (
            <OverlayPicker
              userId={userId}
              logoUrl={bizLogoUrl}
              onClose={() => setOverlayPicker(false)}
              onPick={(file) => pickOverlay(file)}
              onLogo={() => { void addLogoOverlay() }}
            />
          )}

          {tab === 'uploads' && editorTabs.length > 1 && !phone && (
            <EditorTabsBar
              tabs={editorTabs.map((t, i) => {
                const id = i === editorTab ? renderId : t.snap?.renderId ?? null
                const st = i === editorTab ? renderStatus : t.snap?.renderStatus ?? null
                return { key: t.key, title: t.title, status: !id ? '' : st === 'done' ? 'Ready' : st === 'failed' ? 'Failed' : 'Rendering' }
              })}
              active={editorTab}
              note={editorTabNote}
              onSwitch={switchEditorTab}
              onClose={closeEditorTabs}
            />
          )}
          {tab === 'uploads' && (
            <div className={phone ? `ed-split ed-app${renderId && renderStatus !== 'failed' ? ' ed-done' : ''}` : 'ed-split'} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {phone && (
                <PhoneEditorTop
                  title={editorTabs.length > 1 ? editorTabs[editorTab]?.title || 'Editor' : 'Editor'}
                  onBack={() => { setMTool(null); setTab('overview') }}
                  actionLabel={freeQuotaExceeded ? 'Upgrade' : uploading ? 'Uploading' : extractingAudio ? 'Preparing' : 'Create video'}
                  actionDisabled={!freeQuotaExceeded && (uploading || extractingAudio || !uploadSlots.some((id) => uploadSlotFiles[id]))}
                  action={() => {
                    if (freeQuotaExceeded) { window.location.href = '/plans'; return }
                    if (uploading || extractingAudio || !uploadSlots.some((id) => uploadSlotFiles[id])) return
                    setMTool(null)
                    startUploadAndRender()
                  }}
                />
              )}
              {phone && editorTabs.length > 1 && (
                <div className="ed-mtabs">
                  <EditorTabsBar
                    tabs={editorTabs.map((t, i) => {
                      const id = i === editorTab ? renderId : t.snap?.renderId ?? null
                      const st = i === editorTab ? renderStatus : t.snap?.renderStatus ?? null
                      return { key: t.key, title: t.title, status: !id ? '' : st === 'done' ? 'Ready' : st === 'failed' ? 'Failed' : 'Rendering' }
                    })}
                    active={editorTab}
                    note={editorTabNote}
                    onSwitch={switchEditorTab}
                    onClose={closeEditorTabs}
                  />
                </div>
              )}
<div className={phone && !mTool && !uploading && !uploadError && !renderId ? 'ed-main ed-mhide' : 'ed-main'} style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
              <BoxOpenContext.Provider value={phone}>
              {phone && mTool && <PhonePanelHead title={PHONE_TOOL_NAMES[mTool] || ''} onDone={() => setMTool(null)} />}
              {phone && mTool === 'clip' && renderPhoneClipPanel('upload')}
              {phone && mTool === 'speed' && renderPhoneSpeedPanel('upload')}
              {phone && mTool === 'extract' && renderPhoneExtractPanel()}

              {/* ── CLIPS ── */}
              {edT(phone, 'clips', <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px' }}>
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
                      style={{ background: 'var(--card-bg)', borderRadius: 4, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'grab', border: '1px solid var(--line)' }}
                    >
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}><Icon n="grip" /></span>
                      <span style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                        <button type="button" aria-label="Move clip up" disabled={slotIndex === 0} onClick={() => setUploadSlots((prev) => swapItems(prev, prev.indexOf(slotId), prev.indexOf(slotId) - 1))} style={{ background: 'none', border: 'none', padding: '0 4px', fontSize: 11, lineHeight: 1.2, cursor: slotIndex === 0 ? 'default' : 'pointer', opacity: slotIndex === 0 ? 0.25 : 0.8, color: 'var(--ink)' }}><Icon n="up" /></button>
                        <button type="button" aria-label="Move clip down" disabled={slotIndex === uploadSlots.length - 1} onClick={() => setUploadSlots((prev) => swapItems(prev, prev.indexOf(slotId), prev.indexOf(slotId) + 1))} style={{ background: 'none', border: 'none', padding: '0 4px', fontSize: 11, lineHeight: 1.2, cursor: slotIndex === uploadSlots.length - 1 ? 'default' : 'pointer', opacity: slotIndex === uploadSlots.length - 1 ? 0.25 : 0.8, color: 'var(--ink)' }}><Icon n="down" /></button>
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--coral)', background: 'rgba(255,106,77,0.1)', borderRadius: 4, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{slotIndex + 1}</span>
                      <div style={{ flex: '1 1 0', minWidth: 0 }}>
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
                          <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <p style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadSlotFiles[slotId].name}</p>
                            <ClipUploadBadge status={clipUploadStatus[`u${slotId}`]} onRetry={() => startClipUpload('u', slotId, uploadSlotFiles[slotId])} />
                            <SaveToLibraryButton key={`${slotId}-${uploadSlotFiles[slotId].name}-${uploadSlotFiles[slotId].size}`} userId={userId} plan={isFreeTier ? 'free' : userPlan} getFile={() => uploadSlotFiles[slotId] || null} />
                            <button type="button" onClick={() => (document.querySelector(`.upload-slot-input-${slotId}`) as HTMLInputElement)?.click()} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}>Change</button>
                          </div>
                          <div style={{ marginTop: 8, width: 'min(100%, 340px)' }}>
                            <VolumeRow label="Clip volume" value={uploadVols[slotId] ?? 100} onChange={(v) => setUploadVols((prev) => ({ ...prev, [slotId]: v }))} color="var(--coral)" muted={!!uploadMuted[slotId]} onMute={(on) => muteUploadClip(slotId, on)} />
                          </div>
                          </>
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
                            <button type="button" onClick={() => { setLibraryTarget(slotId); setLibraryPicker('slot') }} style={{ background: 'none', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 4, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Pick from library</button>
                            <span className="dnd-hint" style={{ fontSize: 11, color: 'var(--text-muted)' }}>or drag & drop</span>
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
                          }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}><Icon n="close" /></button>
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
                  style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '7px 14px', fontSize: 12, color: 'var(--ink)', fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 8 }}>
                  Add from library
                </button>
                {uploadLandscapeSlots.size > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--ink)' }}>How should landscape clips appear?</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[{ id: 'crop', label: 'Crop & zoom' }, { id: 'blur', label: 'Blurred bars' }, { id: 'landscape', label: 'Keep as-is' }].map((opt) => (
                        <button key={opt.id} type="button" onClick={() => setLandscapeHandling(opt.id as 'crop' | 'blur' | 'landscape')}
                          style={{ padding: '6px 12px', borderRadius: 4, border: landscapeHandling === opt.id ? '2px solid var(--coral)' : '1px solid var(--line)', background: landscapeHandling === opt.id ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', fontSize: 12, color: landscapeHandling === opt.id ? 'var(--coral)' : 'var(--ink)', cursor: 'pointer', fontWeight: landscapeHandling === opt.id ? 600 : 400 }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>)}

              {/* ── AUDIO ── */}
              {edT(phone, 'audio', <>{phone && renderPhoneClipAudio('upload')}{renderAudioSection('upload', voiceScript?.label)}</>)}
              {edT(phone, 'voiceover', renderVoiceoverSection(voiceScript?.label))}

              {/* ── CAPTIONS ── */}
              {edT(phone, 'captions', renderCaptionsCard('upload'))}
              {edT(phone, 'overlay', renderOverlayCard())}

              {/* ── VIDEO SETTINGS ── */}
              {edT(phone, 'settings', <>{renderVideoSettings('upload')}{phone && renderPhoneBadgeToggle()}</>)}

              {/* ── Render ── */}
              {edT(phone, 'always', <>{uploading && (
                <div style={{ padding: '12px 16px', background: 'rgba(217,45,32,0.06)', borderRadius: 4, border: '1px solid rgba(217,45,32,0.3)' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'rgb(217,45,32)', marginBottom: 2 }}>Uploading your clips...</p>
                  <p style={{ fontSize: 12, color: 'rgba(217,45,32,0.7)' }}>Don't navigate away or close this tab until the render starts.</p>
                  <button type="button" onClick={cancelUpload} style={{ marginTop: 8, padding: '6px 14px', borderRadius: 4, border: '1px solid rgba(217,45,32,0.4)', background: 'var(--card-bg)', color: 'rgb(217,45,32)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                </div>
              )}
              {uploadError && <p style={{ fontSize: 13, color: 'var(--coral)', margin: phone ? 0 : undefined, padding: phone ? '10px 16px' : undefined }}>{uploadError}</p>}</>)}

              {edT(phone, 'never', <button
                onClick={() => {
                  if (freeQuotaExceeded) { window.location.href = '/plans'; return }
                  const hasAnyFile = uploadSlots.some((id) => uploadSlotFiles[id])
                  if (uploading || extractingAudio || !hasAnyFile) return
                  startUploadAndRender()
                }}
                data-tour="create-video"
                disabled={uploading || extractingAudio || !uploadSlots.some((id) => uploadSlotFiles[id])}
                style={{ width: '100%', backgroundColor: 'var(--coral)', color: '#fff', padding: '15px', borderRadius: 4, fontSize: 16, fontWeight: 700, border: 'none', boxShadow: uploading || !uploadSlots.some((id) => uploadSlotFiles[id]) ? 'none' : '0 4px 18px rgba(255,106,77,0.4)', cursor: uploading || extractingAudio ? 'not-allowed' : 'pointer', opacity: uploading || extractingAudio || !uploadSlots.some((id) => uploadSlotFiles[id]) ? 0.5 : 1, letterSpacing: 0.3 }}
              >
                {freeQuotaExceeded ? 'Upgrade to render more videos' : uploading ? 'Uploading...' : extractingAudio ? 'Extracting audio...' : editorTabs.length > 1 ? `Render video ${editorTab + 1}` : 'Create video'}
              </button>)}

              {/* ── Result ── */}
              {edT(phone, 'always', renderId && (
                <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px' }}>
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
                      {renderError?.includes('No spoken audio') ? 'A clip was marked as speech but no audio was detected. Uncheck "Speech" for that clip and try again.' : (renderError ? 'Something went wrong making your video. Your clips are still here, so press Create video to try again.' : 'Something went wrong. Please try again.')}
                    </p>
                  )}
                  {renderStatus === 'done' && outputUrl && (
                    <>
                      <video controls controlsList="nodownload noremoteplayback" disablePictureInPicture onContextMenu={(e) => { if (isFreeTier) e.preventDefault() }} src={outputUrl} style={{ width: '100%', maxWidth: 400, borderRadius: 4, marginTop: 12 }} />
                      {renderOverQuota ? (
                        <button onClick={() => window.location.href = '/plans'} style={{ marginTop: 12, backgroundColor: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          Upgrade to download
                        </button>
                      ) : (
                        isFreeTier ? <a href="/plans" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: 'var(--sand)', color: 'var(--coral)', border: '1px solid var(--coral)', borderRadius: 4, padding: '6px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Upgrade to download</a> : <button onClick={() => downloadVideo(outputUrl, 'reelezy-video.mp4')} title="Download" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, width: 38, height: 38, fontSize: 16, cursor: 'pointer' }}><Icon n="down" /></button>
                      )}
                    </>
                  )}
                  {phone && (renderStatus === 'done' || renderStatus === 'failed') && (
                    <button type="button" onClick={() => { setRenderId(null); setRenderStatus(null); setMTool('clips') }}
                      style={{ display: 'block', width: '100%', marginTop: 16, padding: '12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Start a new video</button>
                  )}
                </div>
              ))}

              </BoxOpenContext.Provider>
              </div>

              {(!renderId || renderStatus === 'failed') && <EditorPreview
                mobile={phone}
                panelOpen={phone && !!mTool}
                onClipIndex={setMClip}
                screenText={screenTextBox('upload')}
                clipOps={clipOpsFor('upload', phone)}
                cropRequest={cropRequest}
                addSources={addSourcesFor('upload')}
                tlOps={{ onTakeVolume: setTakeVolume, onMusicVol: setMusicVol, onRemoveMusic: clearMusic, onRemoveOverlay: clearOverlay, musicStart, onMusicStart: setMusicStart }}
                onReorderClip={reorderUploadClip}
                onDropFiles={addUploadFiles}
                captionStyle={previewCaptionStyle}
                captions={uploadCaps}
                onCaptions={setUploadCaps}
                onTrimClip={trimUploadClip}
                onSpeedClip={speedUploadClip}
                clipMenu={(i) => renderClipAppearance('upload', i)}
                onPickLibrary={() => setLibraryPicker('any')}
                showScript={scriptOpen}
                scriptSpeed={scriptSpeed}
                autoCap={uploadAddCaptions && !uploadCaptionOwn && captionLayers.speech.on ? layerPoint(captionLayers, 'speech', captionPosition) : null}
                onAutoCapMove={moveAutoCap}
                onAutoCapRemove={() => setUploadAddCaptions(false)}
                onAutoCapSize={(n) => setCaptionFontSize(n)}
                autoCapFont={toCaptionFont(captionFontFamily)}
                badge={madeWithBadge}
                onBadge={setMadeWithBadge}
                selCap={selCap}
                onSelCap={setSelCap}
                onPlayhead={handlePlayhead}
                overlays={overlays}
                selOverlay={selOverlay}
                onSelOverlay={setSelOverlay}
                onOverlayPatch={patchOverlay}
                appearance={appearance}
                segments={uploadSlots.filter((id) => uploadSlotFiles[id]).map((id) => { const f = uploadSlotFiles[id]; const t = uploadTrims[id]; const ok = !!t && t.file === f; return { file: f, start: ok ? t.start : 0, end: ok ? t.end : null, speed: uploadSpeeds[id], volume: uploadMuted[id] ? 0 : uploadVols[id], appearance: uploadLooks[id], crop: uploadCrops[id], place: uploadPlaces[id] } })}
                takes={voiceTakes}
                originalVol={originalVol}
                musicUrl={previewMusicUrl}
                musicVol={musicVol}
                scriptLines={voiceScript?.lines ?? []}
                onAddTake={addVoiceTake}
                onRemoveTake={removeVoiceTake}
                onMoveTake={moveVoiceTake}
              />}
              {phone && <PhoneEditorNav tools={phoneTools(['clips', 'clip', 'crop', 'audio', 'extract', 'voiceover', 'captions', 'overlay', 'settings'])} active={mTool} onPick={pickPhoneTool} />}
            </div>
          )}

                        {/* Film tab */}
              {tab === 'film' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: filmMulti ? 880 : 1180, margin: '32px auto', padding: '0 24px' }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Film with Teleprompter</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>{filmMulti ? 'Film several videos back to back, then choose the settings for each one and render them all together. You can close the app while they render.' : 'Pick an idea and check its script and actions. Press Start filming to open the full-screen recorder, film one clip per line, then your video opens in the editor to finish and render.'}</p>
                  </div>
                  <div role="group" aria-label="How many videos" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 4, background: 'var(--sand)' }}>
                    {([[false, 'One video'], [true, 'Several videos']] as const).map(([multi, name]) => {
                      const locked = filmMultiBusy || filmIsRecording || filmRecorderOpen || filmClips.length > 0 || !!filmPending
                      const active = filmMulti === multi
                      return (
                        <button key={name} type="button" aria-pressed={active} disabled={locked && !active} onClick={() => setFilmMulti(multi)} title={locked && !active ? 'Finish or clear your clips to switch' : multi ? 'Film several videos back to back and render them together' : 'Film one video from an idea or your own script'} style={{ flex: 1, padding: '9px 12px', borderRadius: 4, border: 'none', background: active ? 'var(--coral)' : 'transparent', color: active ? '#fff' : 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: locked && !active ? 'not-allowed' : 'pointer', opacity: locked && !active ? 0.5 : 1, fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>{name}</button>
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
                      onOpenEditor={(h) => { void openMultiInEditor(h) }}
                      onBusy={setFilmMultiBusy}
                    />
                  ) : (
                  <>
                  <div className="film-split" style={filmReview ? { display: 'none' } : undefined}>
                  <div style={{ background: 'var(--sand)', borderRadius: 4, padding: 16 }}>
                    <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 12, marginTop: 0 }}>Select idea to film</h3>
                    <div className="film-ideas" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {filmingItems.filter((i) => !i.id.startsWith('script-') && i.source !== 'script').map((idea) => (
                        <label key={idea.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 4, background: filmSelectedId === `idea:${idea.id}` ? 'rgba(255,106,77,0.08)' : 'rgba(128,128,128,0.08)', border: filmSelectedId === `idea:${idea.id}` ? '1px solid var(--coral)' : '1px solid var(--line)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={filmSelectedId === `idea:${idea.id}`} onChange={(e) => { if (e.target.checked) { const plan = getFilmPlan(idea); selectFilmSource(`idea:${idea.id}`, plan.lines, plan.actions, plan.durations) } else selectFilmSource(null, []) }} style={{ marginTop: 2, cursor: 'pointer', accentColor: '#FF6A4D', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, lineHeight: 1.4 }}>{idea.title}</span>
                        </label>
                      ))}
                      {dbSavedIdeas.filter((i) => i.source !== 'script' && !filmingItems.some((f) => f.id === i.id)).length > 0 && (
                        <>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '6px 0 2px', margin: 0 }}>My ideas</p>
                          {dbSavedIdeas.filter((i) => i.source !== 'script' && !filmingItems.some((f) => f.id === i.id)).map((idea) => (
                            <label key={idea.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 4, background: filmSelectedId === `idea:${idea.id}` ? 'rgba(255,106,77,0.08)' : 'rgba(128,128,128,0.08)', border: filmSelectedId === `idea:${idea.id}` ? '1px solid var(--coral)' : '1px solid var(--line)', cursor: 'pointer' }}>
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
                            <label key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 4, background: filmSelectedId === `script-${s.id}` ? 'rgba(255,106,77,0.08)' : 'rgba(128,128,128,0.08)', border: filmSelectedId === `script-${s.id}` ? '1px solid var(--coral)' : '1px solid var(--line)', cursor: 'pointer' }}>
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
                    <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>Script and actions</h3>
                    <div className="film-fields">
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '16px 0 0' }}>Your script</p>
                        <textarea value={filmScript} onChange={(e) => { const v = e.target.value; const nl = splitScriptLines(v); if (nl.length > filmClipCount) setFilmDurations([]); setFilmSceneNote(''); setFilmScript(v); setFilmLineIdx(0); setFilmClips([]); setFilmReview(false); setFilmRedoIdx(null) }} placeholder="Words to say or show. One line per clip." rows={12} style={{ marginTop: 8, padding: '10px 12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, lineHeight: 1.5, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '16px 0 0' }}>Actions</p>
                        <textarea value={filmActionsText} onChange={(e) => { setFilmActionsText(e.target.value); setFilmSceneCount(null); setFilmDurations([]); setFilmLineIdx(0); setFilmClips([]); setFilmReview(false); setFilmRedoIdx(null) }} placeholder="What to do in each clip. One line per clip. You only need a script or actions, not both." rows={12} style={{ marginTop: 8, padding: '10px 12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, lineHeight: 1.5, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '8px 0 0' }}>
                      <label htmlFor="film-clip-count" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>Number of clips</label>
                      <input
                        id="film-clip-count"
                        type="number"
                        min={1}
                        max={15}
                        inputMode="numeric"
                        title="Type how many clips you want to film. Your script is joined up or split into that many clips."
                        disabled={filmClips.length > 0 || !!filmPending || filmClipCount === 0}
                        value={filmClipDraft ?? String(filmClipCount)}
                        onChange={(e) => setFilmClipDraft(e.target.value)}
                        onBlur={(e) => applyFilmClipCount(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyFilmClipCount((e.target as HTMLInputElement).value) }}
                        style={{ width: 64, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontWeight: 600 }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>One scene per script line: press Enter in your script to add a scene. Changing the number never rewrites your script or actions. Extra scenes show No script or No action (1 to 15).</span>
                    </div>
                    {filmSelectedId && (
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                        {filmEdited ? 'Your edits are saved automatically. ' : 'Any edits you make are saved automatically. '}
                        {filmEdited && <button type="button" onClick={resetFilmEdits} disabled={filmClips.length > 0 || !!filmPending} title="Go back to the original script and actions" style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--coral)', cursor: 'pointer', textDecoration: 'underline' }}>Reset to original</button>}
                      </p>
                    )}
                    {filmSceneNote && <p style={{ fontSize: 11, color: 'var(--coral)', margin: '6px 0 0' }}>{filmSceneNote}</p>}
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
                          title={locked && !active ? 'Finish or clear your clips to change orientation' : o === 'portrait' ? 'Tall video for TikTok, Reels and Shorts' : 'Wide video for YouTube and your website'}
                          style={{ flex: 1, padding: '9px 12px', borderRadius: 4, border: active ? '1px solid var(--coral)' : '1px solid var(--line)', background: active ? 'rgba(255,106,77,0.1)' : 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: locked ? 'not-allowed' : 'pointer', opacity: locked && !active ? 0.5 : 1 }}
                        >
                          {o === 'portrait' ? 'Portrait' : 'Landscape'}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilmRecorderOpen(true)}
                    disabled={filmClipCount === 0}
                    title={filmClipCount === 0 ? 'Choose an idea or add a script first' : 'Open the camera with your script on the teleprompter'}
                    style={{ padding: '15px 20px', borderRadius: 4, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: filmClipCount === 0 ? 'not-allowed' : 'pointer', opacity: filmClipCount === 0 ? 0.5 : 1, boxShadow: filmClipCount === 0 ? 'none' : '0 4px 18px rgba(255,106,77,0.4)', fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}
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
                      <button type="button" onClick={closeFilmRecorder} disabled={filmIsRecording || filmCountdown !== null} aria-label="Close recorder" style={{ position: 'absolute', top: 10, right: 10, zIndex: 7, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 20, lineHeight: 1, cursor: filmIsRecording || filmCountdown !== null ? 'not-allowed' : 'pointer', opacity: filmIsRecording || filmCountdown !== null ? 0.4 : 1 }}><Icon n="close" /></button>
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
                      onPhoto={(f) => { void addFilmPhoto(f) }}
                      speed={filmSpeed}
                      onSpeed={changeFilmClipSpeed}
                    />
                    {filmClipCount > 0 && (
                      <div style={{ position: 'absolute', bottom: 108, right: 14, zIndex: 3, background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '5px 11px', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                        Clip {Math.min(filmLineIdx + 1, filmClipCount)} of {filmClipCount}
                      </div>
                    )}
                    {filmCurrentLine && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, pointerEvents: filmPending ? 'none' : 'auto', background: 'rgba(8,6,24,0.62)', padding: filmOrientation === 'landscape' ? '12px 60px 12px 18px' : '46px 60px 14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {filmLines[filmLineIdx - 1] && <p style={{ color: 'rgba(241,239,232,0.45)', fontSize: 14, lineHeight: 1.35, margin: 0 }}>{filmLines[filmLineIdx - 1]}</p>}
                        {filmIsRecording ? (
                          <div style={{ overflow: 'hidden' }}>
                            <p ref={filmTeleprompterInnerRef} style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0, whiteSpace: 'nowrap', textShadow: '0 1px 8px rgba(0,0,0,0.7)', willChange: 'transform', display: 'inline-block', paddingLeft: '100%' }}>{filmCurrentLine}</p>
                          </div>
                        ) : (
                          <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, lineHeight: 1.35, margin: 0 }}>{filmCurrentLine}</p>
                        )}
                        {filmLines[filmLineIdx + 1] && <p style={{ color: 'rgba(241,239,232,0.45)', fontSize: 14, lineHeight: 1.35, margin: 0 }}>{filmLines[filmLineIdx + 1]}</p>}
                        {!filmPending && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Slower</span>
                            <input type="range" min={SCRIPT_SPEED_MIN} max={SCRIPT_SPEED_MAX} step={0.25} value={filmScrollSpeed} aria-label="Teleprompter speed" onChange={(e) => changeFilmSpeed(Number(e.target.value))} style={{ flex: 1, minWidth: 0, accentColor: 'var(--coral)' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Faster</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', minWidth: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{filmScrollSpeed}x</span>
                        </div>
                        )}
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
                        <button onClick={startFilmCamera} data-tour="film-start" style={{ padding: '12px 28px', borderRadius: 4, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>Enable Camera</button>
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
                            <button onClick={redoFilmClip} style={{ padding: '13px 20px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>Redo</button>
                            <button onClick={saveFilmClip} style={{ padding: '13px 20px', borderRadius: 4, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>{filmRedoIdx !== null ? 'Save clip' : filmLineIdx + 1 >= filmClipCount ? 'Edit video' : 'Save & next'}</button>
                          </>
                        ) : (
                          <>
                          
                          <div style={{ flex: 1 }}>
                            {filmRedoIdx !== null && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{`Re-recording clip ${filmRedoIdx + 1}`}</span>}
                          </div>
                          </>
                        )}
                      </div>
                    </div>,
                    document.body
                  )}
                  {filmReview && (
                    <div className="ed-split" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      <div className="ed-main" style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                      <div>
                        <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 18, fontWeight: 700, margin: 0 }}>{filmUploading ? 'Opening the editor' : 'Review your video'}</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>{filmUploading ? <><span className='rly-spinner rly-spinner-coral' />Saving your clips. The editor opens in a moment.</> : 'Watch it back in order. Redo any clip you don\'t like, then open it in the editor.'}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {filmClips.map((cl, i) => (
                          <div key={cl.url} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 4, background: filmPlayIdx === i ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', border: filmPlayIdx === i ? '1px solid var(--coral)' : '1px solid transparent' }}>
                            <button type="button" onClick={() => setFilmPlayIdx(i)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>{i + 1}</button>
                            <p style={{ flex: 1, fontSize: 13, lineHeight: 1.4, margin: 0 }}>{filmLines[i] || filmActions[i] || `Clip ${i + 1}`}</p>
                            <span style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                              <button type="button" aria-label="Move clip earlier" disabled={i === 0} onClick={() => moveFilmClip(i, -1)} style={{ background: 'none', border: 'none', padding: '0 6px', fontSize: 11, lineHeight: 1.3, cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.25 : 0.8, color: 'var(--ink)' }}><Icon n="up" /></button>
                              <button type="button" aria-label="Move clip later" disabled={i === filmClips.length - 1} onClick={() => moveFilmClip(i, 1)} style={{ background: 'none', border: 'none', padding: '0 6px', fontSize: 11, lineHeight: 1.3, cursor: i === filmClips.length - 1 ? 'default' : 'pointer', opacity: i === filmClips.length - 1 ? 0.25 : 0.8, color: 'var(--ink)' }}><Icon n="down" /></button>
                            </span>
                            <SaveToLibraryButton key={cl.url} userId={userId} plan={isFreeTier ? 'free' : userPlan} getFile={() => new File([cl.blob], `film-clip-${i + 1}.${cl.ext}`, { type: cl.type })} />
                            <button type="button" onClick={() => startRedoFilmClip(i)} disabled={filmUploading} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', flexShrink: 0 }}>Redo</button>
                          </div>
                        ))}
                      </div>
                      {renderAudioSection('upload', voiceScript?.label)}
                      {renderVoiceoverSection(voiceScript?.label)}
                      {renderCaptionsCard('upload')}
                      {renderOverlayCard()}
                      {renderVideoSettings('upload')}
              {renderAppearanceCard()}
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>Render time used: {stats.find((s) => s.label === 'Render time used')?.value}</p>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button onClick={() => { if (freeQuotaExceeded) { window.location.href = '/plans'; return } gateRenderAction(() => { finishFilm(filmClips, true) }) }} disabled={filmUploading} style={{ flex: 1, minWidth: 140, padding: '13px 20px', borderRadius: 4, border: 'none', background: 'var(--coral)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: filmUploading ? 'not-allowed' : 'pointer', opacity: filmUploading ? 0.7 : 1, fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>{filmUploading ? 'Saving…' : freeQuotaExceeded ? 'Upgrade to render' : 'Render video'}</button>
                        <button onClick={() => finishFilm(filmClips, false)} disabled={filmUploading} style={{ flex: 1, minWidth: 140, padding: '13px 20px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, cursor: filmUploading ? 'not-allowed' : 'pointer', opacity: filmUploading ? 0.7 : 1, fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>{filmUploading ? 'Saving…' : 'Open in editor'}</button>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>The editor lets you change clip order, speed, crop and trims before you render.</p>
                      </div>
                      <EditorPreview
                        onReorderClip={reorderFilmClip}
                        captionStyle={previewCaptionStyle}
                        captions={uploadCaps}
                        onCaptions={setUploadCaps}
                        showScript={scriptOpen}
                        scriptSpeed={scriptSpeed}
                        autoCap={uploadAddCaptions && !uploadCaptionOwn && captionLayers.speech.on ? layerPoint(captionLayers, 'speech', captionPosition) : null}
                        onAutoCapMove={moveAutoCap}
                        onAutoCapRemove={() => setUploadAddCaptions(false)}
                onAutoCapSize={(n) => setCaptionFontSize(n)}
                autoCapFont={toCaptionFont(captionFontFamily)}
                badge={madeWithBadge}
                onBadge={setMadeWithBadge}
                        selCap={selCap}
                        onSelCap={setSelCap}
                        onPlayhead={handlePlayhead}
                        overlays={overlays}
                        selOverlay={selOverlay}
                        onSelOverlay={setSelOverlay}
                        onOverlayPatch={patchOverlay}
                appearance={appearance}
                        segments={filmSegFiles.map((f) => ({ file: f, start: 0.3, end: null }))}
                        takes={voiceTakes}
                        originalVol={originalVol}
                        musicUrl={previewMusicUrl}
                        musicVol={musicVol}
                        scriptLines={voiceScript?.lines ?? splitScriptLines(filmScript)}
                        onAddTake={addVoiceTake}
                        onRemoveTake={removeVoiceTake}
                        onMoveTake={moveVoiceTake}
                      />
                    </div>
                  )}
                  </>
                  )}
                </div>
              )}

{tab === 'aiuploads' && (
            <div className={selectedFilmingId ? (phoneAi ? `ed-split ed-app${aiRenderId && aiRenderStatus !== 'failed' ? ' ed-done' : ''}` : 'ed-split') : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {phoneAi && (
                <PhoneEditorTop
                  title={aiPhoneTitle}
                  onBack={() => { setMTool(null); setTab('overview') }}
                  actionLabel={freeQuotaExceeded ? 'Upgrade' : aiUploading ? 'Uploading' : extractingAudio ? 'Preparing' : 'Create video'}
                  actionDisabled={!freeQuotaExceeded && (aiUploading || extractingAudio || Object.keys(stepUploads).length === 0)}
                  action={() => {
                    if (freeQuotaExceeded) { window.location.href = '/plans'; return }
                    if (aiUploading || extractingAudio || Object.keys(stepUploads).length === 0) return
                    setMTool(null)
                    submitAiEditorUploads()
                  }}
                />
              )}
<div className={phoneAi && !mTool && !aiUploading && !aiEditorError && !aiRenderId ? 'ed-main ed-mhide' : 'ed-main'} style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
              <BoxOpenContext.Provider value={phoneAi}>
              {phoneAi && mTool && <PhonePanelHead title={PHONE_TOOL_NAMES[mTool] || ''} onDone={() => setMTool(null)} />}
              {phoneAi && mTool === 'clip' && renderPhoneClipPanel('ai')}
              {phoneAi && mTool === 'speed' && renderPhoneSpeedPanel('ai')}
              {phoneAi && mTool === 'extract' && renderPhoneExtractPanel()}

              {/* ── Select idea ── */}
              {edT(phoneAi, 'idea', <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>{showArchive ? 'Archived videos' : 'Select an idea to film'}</p>
                  {(archivedFilming.length > 0 || showArchive) && (
                    <button
                      type="button"
                      aria-expanded={showArchive}
                      onClick={() => { setShowArchive((v) => !v); setArchiveOpenId(null); setArchiveQuery('') }}
                      style={{ fontSize: 12, fontWeight: 600, color: showArchive ? 'var(--ink)' : 'var(--coral)', background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {showArchive ? 'Back to ideas' : `Archived videos (${archivedFilming.length})`}
                    </button>
                  )}
                </div>
                {showArchive ? (() => {
                  const q = archiveQuery.trim().toLowerCase()
                  const list = q ? archivedFilming.filter((a) => `${a.title} ${a.hook || ''} ${a.description || ''}`.toLowerCase().includes(q)) : archivedFilming
                  const when = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Every idea you have made a video from or cleared. Tap one to see its filming instructions, then film it again.</p>
                      {archivedFilming.length > 5 && (
                        <input
                          value={archiveQuery}
                          onChange={(e) => setArchiveQuery(e.target.value)}
                          placeholder="Search archived videos"
                          aria-label="Search archived videos"
                          style={{ fontSize: 14, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--card-bg)', color: 'var(--ink)', boxSizing: 'border-box', width: '100%' }}
                        />
                      )}
                      {archivedFilming.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Nothing archived yet.</p>}
                      {archivedFilming.length > 0 && list.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>No archived videos match that search.</p>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: phoneAi ? undefined : 420, overflowY: phoneAi ? undefined : 'auto' }}>
                        {list.map((a) => {
                          const open = archiveOpenId === a.id
                          const steps = a.checklist || []
                          return (
                            <div key={a.id} data-archived={a.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 4 }}>
                              <button
                                type="button"
                                aria-expanded={open}
                                onClick={() => setArchiveOpenId(open ? null : a.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '10px 12px', cursor: 'pointer', color: 'var(--ink)' }}
                              >
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: open ? 'normal' : 'nowrap' }}>{a.title}</span>
                                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{[when(a.createdAt), `${steps.length} ${steps.length === 1 ? 'shot' : 'shots'}`, a.source === 'script' ? 'From a script' : ''].filter(Boolean).join(' · ')}</span>
                                </span>
                                <span aria-hidden style={{ fontSize: 12, color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
                              </button>
                              {open && (
                                <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {a.hook && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}><strong style={{ color: 'var(--ink)' }}>Hook:</strong> {a.hook}</p>}
                                  {(a.prep || []).length > 0 && (
                                    <div>
                                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', margin: '0 0 4px' }}>Before you film</p>
                                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>{(a.prep || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
                                    </div>
                                  )}
                                  {steps.length > 0 && (
                                    <div>
                                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', margin: '0 0 4px' }}>Filming instructions</p>
                                      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>{steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
                                    </div>
                                  )}
                                  {a.script && (
                                    <div>
                                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', margin: '0 0 4px' }}>Script</p>
                                      <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{a.script}</p>
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => reuseArchived(a)}
                                    style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--coral)', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer' }}
                                  >
                                    Film this again
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })() : filmingItems.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{archivedFilming.length > 0 ? 'Generate filming instructions in the Filming tab, or open Archived videos to film an old idea again.' : 'Generate filming instructions first in the Filming tab, then come back here to upload your clips.'}</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {filmingItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => pickFilmingIdea(item)}
                        style={{ padding: '8px 14px', borderRadius: 4, border: selectedFilmingId === item.id ? '2px solid var(--coral)' : '1px solid var(--line)', background: selectedFilmingId === item.id ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', fontSize: 12, color: selectedFilmingId === item.id ? 'var(--coral)' : 'var(--ink)', fontWeight: selectedFilmingId === item.id ? 600 : 400, cursor: 'pointer' }}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>)}

              {selectedFilmingId && (() => {
                const item = filmingItems.find((f) => f.id === selectedFilmingId)
                if (!item) return null
                return (
                  <>
                    {/* ── STEP 1: Clips per step ── */}
                    {edT(phoneAi, 'clips', <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>1 · Upload your clips</p>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                        <button type="button" onClick={() => setAiSingleClipMode(false)} style={{ padding: '8px 16px', borderRadius: 4, border: !aiSingleClipMode ? '2px solid var(--coral)' : '1px solid var(--line)', background: !aiSingleClipMode ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', fontSize: 13, color: !aiSingleClipMode ? 'var(--coral)' : 'var(--ink)', fontWeight: !aiSingleClipMode ? 600 : 400, cursor: 'pointer' }}>
                          I filmed separate clips per step
                        </button>
                        <button type="button" onClick={() => setAiSingleClipMode(true)} style={{ padding: '8px 16px', borderRadius: 4, border: aiSingleClipMode ? '2px solid var(--coral)' : '1px solid var(--line)', background: aiSingleClipMode ? 'rgba(255,106,77,0.08)' : 'var(--card-bg)', fontSize: 13, color: aiSingleClipMode ? 'var(--coral)' : 'var(--ink)', fontWeight: aiSingleClipMode ? 600 : 400, cursor: 'pointer' }}>
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
                          <div style={{ background: 'var(--card-bg)', borderRadius: 4, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--coral)', background: 'rgba(255,106,77,0.1)', borderRadius: 4, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {stepUploads[0] ? (
                                <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <p style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stepUploads[0].name}</p>
                                  <ClipUploadBadge status={clipUploadStatus['a0']} onRetry={() => startClipUpload('a', 0, stepUploads[0])} />
                                  <button type="button" onClick={() => document.getElementById('ai-single-clip')?.click()} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}>Change</button>
                                  <button type="button" onClick={() => { setStepUploads({}); resetAiClipUploads() }} style={{ fontSize: 14, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}><Icon n="close" /></button>
                                </div>
                                <div style={{ marginTop: 8, width: 'min(100%, 340px)' }}>
                                  <VolumeRow label="Clip volume" value={aiVols[0] ?? 100} onChange={(v) => setAiVols((prev) => ({ ...prev, 0: v }))} color="var(--coral)" muted={!!aiMuted[0]} onMute={(on) => muteAiClip(0, on)} />
                                </div>
                                </>
                              ) : (
                                <div
                                  draggable={false}
                                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--coral)' }}
                                  onDragLeave={(e) => { e.stopPropagation(); e.currentTarget.style.borderColor = 'transparent' }}
                                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = 'transparent'; const file = e.dataTransfer.files?.[0]; if (file) setStepUploads({ 0: file }) }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, border: '2px dashed transparent', borderRadius: 4, padding: '2px', transition: 'border-color 0.15s' }}
                                >
                                  <button type="button" onClick={() => document.getElementById('ai-single-clip')?.click()} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Choose clip</button>
                                  <button type="button" onClick={() => { setLibraryTarget(0); setLibraryPicker('step') }} style={{ background: 'none', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 4, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Pick from library</button>
                                  <span className="dnd-hint" style={{ fontSize: 11, color: 'var(--text-muted)' }}>or drag & drop</span>
                                </div>
                              )}
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
<div key={i} style={{ background: 'var(--card-bg)', borderRadius: 4, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, border: '1px solid var(--line)' }}>
                              <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}><Icon n="grip" /></span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--coral)', background: 'rgba(255,106,77,0.1)', borderRadius: 4, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{i + 1}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {timeRange && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--coral)', background: 'rgba(255,106,77,0.1)', borderRadius: 4, padding: '2px 6px', marginBottom: 4, display: 'inline-block' }}>{timeRange}</span>}
                                <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, fontWeight: 500, marginBottom: 8 }}>{instruction}</p>
                                <input id={`ai-step-${i}`} type="file" accept="video/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { setStepUploads((prev) => ({ ...prev, [i]: file })); startClipUpload('a', i, file) } }} style={{ display: 'none' }} />
                                {(stepUploads[i] || stepUploadNames[i]) ? (
                                  <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <p style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stepUploads[i]?.name || stepUploadNames[i]}</p>
                                    <ClipUploadBadge status={clipUploadStatus[`a${i}`]} onRetry={() => { const f = stepUploads[i]; if (f) startClipUpload('a', i, f) }} />
                                    <button type="button" onClick={() => document.getElementById(`ai-step-${i}`)?.click()} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}>Change</button>
                                    <button type="button" onClick={() => {
                                    setStepUploads((prev) => { const n = {...prev}; delete n[i]; return n })
                                    setStepUploadPaths((prev) => { const n = {...prev}; delete n[i]; return n })
                                    forgetClipUpload('a', i)
                                    setStepUploadNames((prev) => { const n = {...prev}; delete n[i]; return n })
                                    void authFetch('/api/delete-draft-clip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, editorType: 'ai', slotIndex: i }) })
                                  }} style={{ fontSize: 14, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}><Icon n="close" /></button>
                                  </div>
                                  <div style={{ marginTop: 8, width: 'min(100%, 340px)' }}>
                                    <VolumeRow label="Clip volume" value={aiVols[i] ?? 100} onChange={(v) => setAiVols((prev) => ({ ...prev, [i]: v }))} color="var(--coral)" muted={!!aiMuted[i]} onMute={(on) => muteAiClip(i, on)} />
                                  </div>
                                  </>
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
                                    <button type="button" onClick={() => { setLibraryTarget(i); setLibraryPicker('step') }} style={{ background: 'none', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 4, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Pick from library</button>
                                    <span className="dnd-hint" style={{ fontSize: 11, color: 'var(--text-muted)' }}>or drag & drop</span>
                                  </div>
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
                              <button key={opt.id} type="button" onClick={() => setAiLandscapeHandling(opt.id as 'crop' | 'blur' | 'landscape')} style={{ padding: '7px 14px', borderRadius: 4, border: aiLandscapeHandling === opt.id ? '2px solid var(--coral)' : '1px solid var(--line)', background: 'var(--card-bg)', fontSize: 12, color: 'var(--ink)', cursor: 'pointer' }}>{opt.label}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>)}

                    {/* ── AUDIO ── */}
                    {edT(phoneAi, 'audio', <>{phoneAi && renderPhoneClipAudio('ai')}{renderAudioSection('ai', voiceScript?.label ?? (aiIdeaLines.length > 0 ? aiIdeaItem?.title || 'your idea' : undefined), aiIdeaLines.length === 0 && !voiceScript?.label ? aiIdeaItem?.title : undefined)}</>)}
                    {edT(phoneAi, 'voiceover', renderVoiceoverSection(voiceScript?.label ?? (aiIdeaLines.length > 0 ? aiIdeaItem?.title || 'your idea' : undefined), aiIdeaLines.length === 0 && !voiceScript?.label ? aiIdeaItem?.title : undefined))}

                    {/* ── CAPTIONS ── */}
                    {edT(phoneAi, 'captions', renderCaptionsCard('ai'))}
                    {edT(phoneAi, 'overlay', renderOverlayCard())}

                    {/* ── VIDEO SETTINGS ── */}
                    {edT(phoneAi, 'settings', <>{renderVideoSettings('ai')}{phoneAi && renderPhoneBadgeToggle()}</>)}

                    {/* ── Render ── */}
                    {edT(phoneAi, 'always', <>{aiUploading && (
                      <div style={{ padding: '12px 16px', background: 'rgba(217,45,32,0.06)', borderRadius: 4, border: '1px solid rgba(217,45,32,0.3)' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'rgb(217,45,32)', marginBottom: 2 }}>Uploading your clips...</p>
                        <p style={{ fontSize: 12, color: 'rgba(217,45,32,0.7)' }}>Don't navigate away or close this tab until the render starts.</p>
                        <button type="button" onClick={cancelAiUpload} style={{ marginTop: 8, padding: '6px 14px', borderRadius: 4, border: '1px solid rgba(217,45,32,0.4)', background: 'var(--card-bg)', color: 'rgb(217,45,32)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                      </div>
                    )}
                    {aiEditorError && (
                      <p style={{ fontSize: 13, color: 'var(--coral)', padding: '12px 16px', background: 'rgba(255,106,77,0.08)', borderRadius: 4, border: '1px solid rgba(255,106,77,0.25)' }}>{aiEditorError}</p>
                    )}</>)}

                    {edT(phoneAi, 'never', <button
                      onClick={() => { if (freeQuotaExceeded) { window.location.href = '/plans'; return } if (aiUploading || extractingAudio || Object.keys(stepUploads).length === 0) return; submitAiEditorUploads() }}
                      data-tour="create-video"
                      disabled={aiUploading || extractingAudio || Object.keys(stepUploads).length === 0}
                      style={{ width: '100%', backgroundColor: 'var(--coral)', color: '#fff', padding: '15px', borderRadius: 4, fontSize: 16, fontWeight: 700, border: 'none', boxShadow: aiUploading || Object.keys(stepUploads).length === 0 ? 'none' : '0 4px 18px rgba(255,106,77,0.4)', cursor: aiUploading || extractingAudio ? 'not-allowed' : 'pointer', opacity: aiUploading || extractingAudio || Object.keys(stepUploads).length === 0 ? 0.5 : 1, letterSpacing: 0.3 }}
                    >
                      {freeQuotaExceeded ? 'Upgrade to render more videos' : aiUploading ? 'Uploading...' : extractingAudio ? 'Extracting audio...' : 'Create video'}
                    </button>)}

                    {edT(phoneAi, 'always', aiRenderId && (
                      <div style={{ background: 'var(--sand)', borderRadius: 4, padding: '24px' }}>
                        <h3 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Your video</h3>
                        {aiRenderStatus !== 'done' && aiRenderStatus !== 'failed' && (
                          <>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>Status: {aiRenderStatus || 'starting'}... usually takes a minute or two.</p>
                            <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(128,128,128,0.2)', overflow: 'hidden' }}>
                              <div style={{ width: `${aiRenderProgress}%`, height: '100%', background: 'var(--coral)', borderRadius: 4, transition: 'width 0.4s ease' }} />
                            </div>
                          </>
                        )}
                        {aiRenderStatus === 'failed' && <p style={{ fontSize: 13, color: 'var(--coral)' }}>Something went wrong making your video. Your clips are still here, so press Create video to try again.</p>}
                        {aiRenderStatus === 'done' && aiOutputUrl && (
                          <>
                            <video controls controlsList="nodownload noremoteplayback" disablePictureInPicture onContextMenu={(e) => { if (isFreeTier) e.preventDefault() }} src={aiOutputUrl} style={{ width: '100%', maxWidth: 400, borderRadius: 4, marginTop: 12 }} />
                            {aiRenderOverQuota ? (
                              <button onClick={() => window.location.href = '/plans'} style={{ marginTop: 12, backgroundColor: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                Upgrade to download
                              </button>
                            ) : (
                              isFreeTier ? <a href="/plans" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: 'var(--sand)', color: 'var(--coral)', border: '1px solid var(--coral)', borderRadius: 4, padding: '6px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Upgrade to download</a> : <button onClick={() => downloadVideo(aiOutputUrl, 'reelezy-video.mp4')} title="Download" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, width: 38, height: 38, fontSize: 16, cursor: 'pointer' }}><Icon n="down" /></button>
                            )}
                          </>
                        )}
                        {phoneAi && (aiRenderStatus === 'done' || aiRenderStatus === 'failed') && (
                          <button type="button" onClick={() => { setAiRenderId(null); setAiRenderStatus(null); setMTool('clips') }}
                            style={{ display: 'block', width: '100%', marginTop: 16, padding: '12px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Start a new video</button>
                        )}
                      </div>
                    ))}
                  </>
                )
              })()}
              </BoxOpenContext.Provider>
              </div>

              {!!selectedFilmingId && (!aiRenderId || aiRenderStatus === 'failed') && <EditorPreview
                mobile={phoneAi}
                panelOpen={phoneAi && !!mTool}
                onClipIndex={setMClip}
                screenText={screenTextBox('ai')}
                clipOps={clipOpsFor('ai', phoneAi)}
                cropRequest={cropRequest}
                addSources={addSourcesFor('ai')}
                tlOps={{ onTakeVolume: setTakeVolume, onMusicVol: setMusicVol, onRemoveMusic: clearMusic, onRemoveOverlay: clearOverlay, musicStart, onMusicStart: setMusicStart }}
                onDropFiles={addAiFiles}
                captionStyle={previewCaptionStyle}
                captions={aiCaps}
                onCaptions={setAiCaps}
                onTrimClip={trimAiClip}
                onSpeedClip={speedAiClip}
                clipMenu={(i) => renderClipAppearance('ai', i)}
                onPickLibrary={() => setLibraryPicker('ai')}
                showScript={scriptOpen}
                scriptSpeed={scriptSpeed}
                autoCap={aiAddCaptions && !aiCaptionOwn && captionLayers.speech.on ? layerPoint(captionLayers, 'speech', captionPosition) : null}
                onAutoCapMove={moveAutoCap}
                onAutoCapRemove={() => setAiAddCaptions(false)}
                onAutoCapSize={(n) => setCaptionFontSize(n)}
                autoCapFont={toCaptionFont(captionFontFamily)}
                badge={madeWithBadge}
                onBadge={setMadeWithBadge}
                selCap={selCap}
                onSelCap={setSelCap}
                onPlayhead={handlePlayhead}
                overlays={overlays}
                selOverlay={selOverlay}
                onSelOverlay={setSelOverlay}
                onOverlayPatch={patchOverlay}
                appearance={appearance}
                segments={Object.keys(stepUploads).map(Number).sort((a, b) => a - b).map((i) => { const f = stepUploads[i]; const t = aiTrims[i]; const ok = !!t && t.file === f; return { file: f, start: ok ? t.start : 0, end: ok ? t.end : null, speed: aiSpeeds[i], volume: aiMuted[i] ? 0 : aiVols[i], appearance: aiLooks[i], crop: aiCrops[i], place: aiPlaces[i] } })}
                takes={voiceTakes}
                originalVol={originalVol}
                musicUrl={previewMusicUrl}
                musicVol={musicVol}
                scriptLines={voiceScript?.lines ?? aiIdeaLines}
                onAddTake={addVoiceTake}
                onRemoveTake={removeVoiceTake}
                onMoveTake={moveVoiceTake}
              />}
              {phoneAi && <PhoneEditorNav tools={phoneTools(['idea', 'clips', 'clip', 'crop', 'audio', 'extract', 'voiceover', 'captions', 'overlay', 'settings'])} active={mTool} onPick={pickPhoneTool} />}
            </div>
          )}

        {tab === 'scheduler' && (
          <SchedulerTab userId={userId} carousels={savedCarousels} isFree={isFreeTier} onDeleteCarousel={deleteCarousel} />
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
                Fill out my profile
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
            role="dialog" aria-label="Music library"
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", background: "var(--card-bg)", borderRadius: 4, padding: "32px", maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto" }}
          >
            <button type="button" aria-label="Close" onClick={() => { previewAudioRef.current?.pause(); setPreviewingTrackId(null); setShowMusicLibrary(null) }}
              style={{ position: "absolute", top: 12, right: 12, width: 34, height: 34, borderRadius: 4, border: "none", background: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n="close" /></button>
            <h2 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 4, paddingRight: 28 }}>
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
                    {previewingTrackId === track.id ? <Icon n="pause" /> : <Icon n="play" />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{track.name}</p>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>{track.mood}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectLibraryTrack(track.id, track.name, track.url, showMusicLibrary)}
                    style={{ background: "none", border: "1px solid var(--line)", borderRadius: 4, padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}
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
