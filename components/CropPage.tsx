'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// The part of a clip's picture to keep, as fractions of the whole picture (0 to 1)
export type CropRect = { x: number; y: number; w: number; h: number }
type Mode = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

const MIN = 0.08
const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 }

// A full page for cropping one clip, like the Photos app: the whole picture shows, the part being kept sits in a
// box, and what is cut off stays visible but darkened around it. Drag a corner or an edge to any shape, or drag
// inside the box to move it. Nothing is locked to a shape.
export default function CropPage({ src, start, end, aspect, initial, title, onSave, onCancel }: {
  src: string
  start: number
  end: number | null
  aspect: number // width / height of the finished video, for the "Fit the video shape" button
  initial: CropRect | null
  title: string
  onSave: (crop: CropRect | null) => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [ratio, setRatio] = useState<number | null>(null) // the clip's own width / height
  const [area, setArea] = useState({ w: 0, h: 0 })
  const [rect, setRect] = useState<CropRect>(initial ?? FULL)
  const [dragging, setDragging] = useState(false)
  const [at, setAt] = useState(0)
  const [dur, setDur] = useState(0)
  const drag = useRef<{ mode: Mode; sx: number; sy: number; r0: CropRect } | null>(null)

  // The picture is as big as fits, with room around it for the handles
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const fit = () => { const r = el.getBoundingClientRect(); setArea({ w: r.width, h: r.height }) }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const pad = 18
  const pic = (() => {
    if (!ratio || area.w <= 0) return { w: 0, h: 0 }
    const aw = Math.max(0, area.w - pad * 2), ah = Math.max(0, area.h - pad * 2)
    const w = Math.min(aw, ah * ratio)
    return { w, h: w / ratio }
  })()

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', key)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', key) }
  }, [onCancel])

  const loaded = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth || !v.videoHeight) return
    setRatio(v.videoWidth / v.videoHeight)
    const stop = end != null && Number.isFinite(end) ? end : v.duration
    setDur(Math.max(0, (Number.isFinite(stop) ? stop : 0) - start))
    try { v.currentTime = Math.max(0.001, start) } catch {}
    // iPhones show nothing until a video has played, so play it for a moment with the sound off
    v.muted = true
    void v.play().then(() => { v.pause(); try { v.currentTime = Math.max(0.001, start) } catch {} }).catch(() => {})
  }

  const clamp = (r: CropRect): CropRect => {
    const w = Math.min(1, Math.max(MIN, r.w)), h = Math.min(1, Math.max(MIN, r.h))
    return { x: Math.min(1 - w, Math.max(0, r.x)), y: Math.min(1 - h, Math.max(0, r.y)), w, h }
  }

  const grab = (mode: Mode) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    drag.current = { mode, sx: e.clientX, sy: e.clientY, r0: rect }
    setDragging(true)
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || pic.w <= 0) return
    // Worked out straight away: React may apply it after the finger has already lifted
    const dx = (e.clientX - d.sx) / pic.w, dy = (e.clientY - d.sy) / pic.h
    const r = d.r0
    if (d.mode === 'move') { setRect(clamp({ ...r, x: r.x + dx, y: r.y + dy })); return }
    let left = r.x, top = r.y, right = r.x + r.w, bottom = r.y + r.h
    if (d.mode.includes('w')) left = Math.min(right - MIN, Math.max(0, r.x + dx))
    if (d.mode.includes('e')) right = Math.max(left + MIN, Math.min(1, r.x + r.w + dx))
    if (d.mode.includes('n')) top = Math.min(bottom - MIN, Math.max(0, r.y + dy))
    if (d.mode.includes('s')) bottom = Math.max(top + MIN, Math.min(1, r.y + r.h + dy))
    setRect({ x: left, y: top, w: right - left, h: bottom - top })
  }
  const up = () => { drag.current = null; setDragging(false) }

  const nudge = (e: React.KeyboardEvent) => {
    const s = e.shiftKey ? 0.05 : 0.01
    const d: Record<string, [number, number]> = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }
    if (d[e.key]) { e.preventDefault(); setRect((r) => clamp({ ...r, x: r.x + d[e.key][0], y: r.y + d[e.key][1] })) }
  }

  // The biggest box the shape of the finished video, around the middle of the box there is now
  const fitShape = () => {
    if (!ratio) return
    const want = aspect / ratio // width / height in picture fractions
    let w = 1, h = w / want
    if (h > 1) { h = 1; w = h * want }
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2
    setRect(clamp({ x: cx - w / 2, y: cy - h / 2, w, h }))
  }

  const result = (): CropRect | null => {
    if (rect.x < 0.003 && rect.y < 0.003 && rect.w > 0.997 && rect.h > 0.997) return null
    const r4 = (n: number) => Math.round(n * 10000) / 10000
    return { x: r4(rect.x), y: r4(rect.y), w: r4(rect.w), h: r4(rect.h) }
  }

  const box = { left: rect.x * pic.w, top: rect.y * pic.h, width: rect.w * pic.w, height: rect.h * pic.h }
  const btn = { padding: '9px 14px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const
  const HIT = 34
  const corner = (m: 'nw' | 'ne' | 'sw' | 'se') => {
    const top = m[0] === 'n', left = m[1] === 'w'
    return (
      <span key={m} role="slider" aria-label={`Crop corner ${top ? 'top' : 'bottom'} ${left ? 'left' : 'right'}`} onPointerDown={grab(m)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ position: 'absolute', width: HIT, height: HIT, [top ? 'top' : 'bottom']: -HIT / 2, [left ? 'left' : 'right']: -HIT / 2, touchAction: 'none', cursor: m === 'nw' || m === 'se' ? 'nwse-resize' : 'nesw-resize', zIndex: 3 }}>
        {/* The L-shaped corner, sitting just outside the box */}
        <span aria-hidden="true" style={{ position: 'absolute', [top ? 'top' : 'bottom']: HIT / 2 - 4, [left ? 'left' : 'right']: HIT / 2 - 4, width: 22, height: 22, [top ? 'borderTop' : 'borderBottom']: '4px solid #fff', [left ? 'borderLeft' : 'borderRight']: '4px solid #fff', boxSizing: 'border-box' }} />
      </span>
    )
  }
  const edge = (m: 'n' | 's' | 'e' | 'w') => {
    const vert = m === 'n' || m === 's'
    return (
      <span key={m} role="slider" aria-label={`Crop edge ${m === 'n' ? 'top' : m === 's' ? 'bottom' : m === 'w' ? 'left' : 'right'}`} onPointerDown={grab(m)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ position: 'absolute', touchAction: 'none', cursor: vert ? 'ns-resize' : 'ew-resize', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
          ...(vert ? { left: HIT / 2, right: HIT / 2, height: HIT, [m === 'n' ? 'top' : 'bottom']: -HIT / 2 } : { top: HIT / 2, bottom: HIT / 2, width: HIT, [m === 'w' ? 'left' : 'right']: -HIT / 2 }) }}>
        <span aria-hidden="true" style={{ background: '#fff', borderRadius: 1, ...(vert ? { width: 26, height: 4 } : { width: 4, height: 26 }) }} />
      </span>
    )
  }

  const page = (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'calc(10px + env(safe-area-inset-top)) 12px 10px' }}>
        <button type="button" onClick={onCancel} style={{ ...btn, borderRadius: 20, background: 'rgba(255,255,255,0.18)', border: 'none', padding: '7px 14px' }}>Cancel</button>
        <p style={{ flex: 1, margin: 0, textAlign: 'center', fontSize: 15, fontWeight: 700 }}>{title}</p>
        <button type="button" onClick={() => onSave(result())} disabled={!ratio} style={{ ...btn, borderRadius: 20, border: 'none', background: 'var(--coral)', fontWeight: 700, padding: '7px 18px', opacity: ratio ? 1 : 0.5 }}>Done</button>
      </div>

      <div ref={stageRef} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: pic.w, height: pic.h }}>
          <video ref={videoRef} src={src} muted playsInline preload="auto" onLoadedMetadata={loaded}
            onTimeUpdate={(e) => setAt(Math.max(0, e.currentTarget.currentTime - start))}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }} />
          {!ratio && <span style={{ position: 'fixed', left: 0, right: 0, top: '45%', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Loading the clip...</span>}
          {/* The parts being cut off stay visible, darkened */}
          {pic.w > 0 && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', ...box, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }} />
          </div>}
          {pic.w > 0 && (
            <div tabIndex={0} role="application" aria-label="Crop box. Drag inside to move it, drag the corners and edges to change it. Arrow keys move it."
              onPointerDown={grab('move')} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={nudge}
              style={{ position: 'absolute', ...box, border: '1px solid rgba(255,255,255,0.9)', boxSizing: 'border-box', cursor: dragging ? 'grabbing' : 'move', touchAction: 'none' }}>
              {/* Thirds, like a camera grid */}
              <span aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: dragging ? 0.9 : 0.5, backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '33.333% 33.333%', backgroundPosition: '-1px -1px' }} />
              {(['n', 's', 'e', 'w'] as const).map(edge)}
              {(['nw', 'ne', 'sw', 'se'] as const).map(corner)}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '10px 16px calc(16px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {dur > 0.2 && (
          <label style={{ display: 'grid', gridTemplateColumns: '64px 1fr', alignItems: 'center', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
            Moment
            <input type="range" min={0} max={1000} value={Math.round((at / dur) * 1000)} aria-label="Move through the clip"
              onChange={(e) => { const v = videoRef.current; if (v) { const t = (Number(e.target.value) / 1000) * dur; setAt(t); try { v.currentTime = start + t } catch {} } }}
              style={{ width: '100%', accentColor: 'var(--coral)', minHeight: 28 }} />
          </label>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" onClick={fitShape} style={btn}>Fit the video shape</button>
          <button type="button" onClick={() => setRect(FULL)} style={btn}>Reset</button>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>Drag the corners or edges to any shape. The darker part is cut off. Only this clip is cropped.</p>
      </div>
    </div>
  )
  return typeof document === 'undefined' ? null : createPortal(page, document.body)
}
