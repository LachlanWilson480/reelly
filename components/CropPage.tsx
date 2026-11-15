'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// The part of a clip's picture to keep, as fractions of the whole picture (0 to 1)
export type CropRect = { x: number; y: number; w: number; h: number }

// A full page for cropping one clip, like a phone's photo editor. The frame is the shape of the finished video.
// Pinch (or scroll, or use the slider) to zoom, drag to move the picture. What is inside the frame is what is kept.
// All maths is done in "frame units", so it does not depend on how big the screen is.
export default function CropPage({ src, start, end, aspect, initial, title, onSave, onCancel }: {
  src: string
  start: number
  end: number | null
  aspect: number // width / height of the finished video
  initial: CropRect | null
  title: string
  onSave: (crop: CropRect | null) => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [ratio, setRatio] = useState<number | null>(null) // the clip's own width / height
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ z: 1, cx: 0.5, cy: 0.5 })
  const [moving, setMoving] = useState(false)
  const [at, setAt] = useState(0)
  const [dur, setDur] = useState(0)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d0: number; z0: number } | null>(null)
  const seeded = useRef(false)

  // How big the clip is inside the frame at zoom 1 (the whole picture fits, like the preview shows it)
  const fitW = ratio ? Math.min(1, ratio / aspect) : 1
  const fitH = ratio ? Math.min(1, aspect / ratio) : 1
  const fillZ = 1 / Math.min(fitW, fitH)
  const maxZ = Math.max(5, fillZ * 3)

  const clampView = (z: number, cx: number, cy: number) => {
    const zz = Math.min(maxZ, Math.max(1, z))
    const vw = 1 / (fitW * zz), vh = 1 / (fitH * zz)
    return {
      z: zz,
      cx: vw >= 1 ? 0.5 : Math.min(1 - vw / 2, Math.max(vw / 2, cx)),
      cy: vh >= 1 ? 0.5 : Math.min(1 - vh / 2, Math.max(vh / 2, cy)),
    }
  }

  // Start from the crop the clip already has
  useEffect(() => {
    if (!ratio || seeded.current) return
    seeded.current = true
    if (!initial) return
    const fw = Math.min(1, ratio / aspect), fh = Math.min(1, aspect / ratio)
    const zs = [initial.w < 0.999 ? 1 / (initial.w * fw) : 0, initial.h < 0.999 ? 1 / (initial.h * fh) : 0]
    const z = Math.max(1, ...zs)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- runs once, when the clip's size is first known
    setView(clampView(z, initial.x + initial.w / 2, initial.y + initial.h / 2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratio])

  // The frame is as big as fits on the screen
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const fit = () => {
      const r = el.getBoundingClientRect()
      const w = Math.min(r.width, r.height * aspect)
      setBox({ w, h: w / aspect })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [aspect])

  // Scroll to zoom on a computer. React's wheel events cannot stop the page scrolling, so this is added by hand.
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      setView((v) => clampView(v.z * Math.exp(-e.deltaY * 0.0015), v.cx, v.cy))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratio])

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

  const down = (e: React.PointerEvent) => {
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: view.z }
    }
    setMoving(true)
  }
  const move = (e: React.PointerEvent) => {
    const p = pointers.current.get(e.pointerId)
    if (!p || box.w <= 0) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const n = pointers.current.size
    // Work the zoom out now: React may apply the change after the fingers have already lifted
    let pinchZ: number | null = null
    if (n >= 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values())
      pinchZ = pinch.current.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d0)
    }
    const share = n >= 2 ? 0.5 : 1
    setView((v) => {
      // Two fingers: both move the picture half as much each, and the gap between them sets the zoom
      const vwPx = box.w * fitW * v.z, vhPx = box.h * fitH * v.z
      return clampView(pinchZ ?? v.z, v.cx - (dx * share) / vwPx, v.cy - (dy * share) / vhPx)
    })
  }
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) setMoving(false)
  }

  const nudge = (e: React.KeyboardEvent) => {
    const step = 0.02
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (d[e.key]) { e.preventDefault(); setView((v) => clampView(v.z, v.cx + d[e.key][0], v.cy + d[e.key][1])) }
    if (e.key === '+' || e.key === '=') setView((v) => clampView(v.z * 1.1, v.cx, v.cy))
    if (e.key === '-') setView((v) => clampView(v.z / 1.1, v.cx, v.cy))
  }

  const rect = (): CropRect | null => {
    const vw = 1 / (fitW * view.z), vh = 1 / (fitH * view.z)
    const x = vw >= 1 ? 0 : view.cx - vw / 2, y = vh >= 1 ? 0 : view.cy - vh / 2
    const w = Math.min(1, vw), h = Math.min(1, vh)
    if (x < 0.003 && y < 0.003 && w > 0.997 && h > 0.997) return null
    const r4 = (n: number) => Math.round(n * 10000) / 10000
    return { x: r4(x), y: r4(y), w: r4(w), h: r4(h) }
  }

  const vW = fitW * view.z, vH = fitH * view.z
  const zoomPos = Math.log(view.z) / Math.log(maxZ)
  const btn = { padding: '9px 14px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const

  const page = (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: '#111', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'calc(10px + env(safe-area-inset-top)) 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <button type="button" onClick={onCancel} style={{ ...btn, border: 'none', background: 'none', padding: '9px 6px' }}>Cancel</button>
        <p style={{ flex: 1, margin: 0, textAlign: 'center', fontSize: 15, fontWeight: 700 }}>{title}</p>
        <button type="button" onClick={() => onSave(rect())} disabled={!ratio} style={{ ...btn, border: 'none', background: 'var(--coral)', fontWeight: 700, padding: '9px 18px', opacity: ratio ? 1 : 0.5 }}>Save</button>
      </div>

      <div ref={stageRef} style={{ flex: 1, minHeight: 0, margin: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div ref={frameRef} tabIndex={0} role="application" aria-label="Crop frame. Drag to move the picture, pinch or scroll to zoom. Arrow keys move it, plus and minus zoom."
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onKeyDown={nudge}
          style={{ position: 'relative', width: box.w, height: box.h, overflow: 'hidden', background: '#000', touchAction: 'none', cursor: moving ? 'grabbing' : 'grab', outline: '2px solid #fff', outlineOffset: 0, borderRadius: 2 }}>
          <video ref={videoRef} src={src} muted playsInline preload="auto" onLoadedMetadata={loaded}
            onTimeUpdate={(e) => setAt(Math.max(0, e.currentTarget.currentTime - start))}
            style={{ position: 'absolute', left: `${(0.5 - view.cx * vW) * 100}%`, top: `${(0.5 - view.cy * vH) * 100}%`, width: `${vW * 100}%`, height: `${vH * 100}%`, objectFit: 'fill', maxWidth: 'none', pointerEvents: 'none', display: 'block' }} />
          {/* A grid to line things up, shown while moving */}
          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: moving ? 1 : 0, transition: 'opacity 0.15s', backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '33.33% 33.33%', backgroundPosition: '-1px -1px' }} />
          {!ratio && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Loading the clip...</span>}
        </div>
      </div>

      <div style={{ padding: '0 16px calc(16px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <label style={{ display: 'grid', gridTemplateColumns: '64px 1fr', alignItems: 'center', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
          Zoom
          <input type="range" min={0} max={1000} value={Math.round(zoomPos * 1000)} aria-label="Zoom"
            onChange={(e) => { const z = Math.exp((Number(e.target.value) / 1000) * Math.log(maxZ)); setView((v) => clampView(z, v.cx, v.cy)) }}
            style={{ width: '100%', accentColor: 'var(--coral)', minHeight: 28 }} />
        </label>
        {dur > 0.2 && (
          <label style={{ display: 'grid', gridTemplateColumns: '64px 1fr', alignItems: 'center', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
            Moment
            <input type="range" min={0} max={1000} value={Math.round((at / dur) * 1000)} aria-label="Move through the clip"
              onChange={(e) => { const v = videoRef.current; if (v) { const t = (Number(e.target.value) / 1000) * dur; setAt(t); try { v.currentTime = start + t } catch {} } }}
              style={{ width: '100%', accentColor: 'var(--coral)', minHeight: 28 }} />
          </label>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" onClick={() => setView(clampView(fillZ, view.cx, view.cy))} style={btn}>Fill the frame</button>
          <button type="button" onClick={() => setView({ z: 1, cx: 0.5, cy: 0.5 })} style={btn}>Show it all</button>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>Pinch to zoom and drag to move. Only this clip is cropped.</p>
      </div>
    </div>
  )
  return typeof document === 'undefined' ? null : createPortal(page, document.body)
}
