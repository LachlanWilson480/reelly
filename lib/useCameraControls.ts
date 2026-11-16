'use client'

import { useState, useRef } from 'react'

export type CamRes = '720' | '1080' | '4k'
export type CamFps = 24 | 30 | 60
export type CamPanel = 'timer' | 'quality' | null
export type CamLens = { id: string; name: string }

// iPhone, iPad (which can say it is a Mac) and iPod. Every browser on these uses Safari's camera.
function isAppleTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}

// Everything the camera screens share besides the stream itself: grid, countdown timer, quality, torch, zoom and lens choice.
// The film tab and the several videos recorder both use this, so the two always behave the same.
export function useCameraControls(getStream: () => MediaStream | null) {
  const [grid, setGrid] = useState(false)
  const [timer, setTimer] = useState<0 | 3 | 10>(3)
  const [res, setRes] = useState<CamRes>('1080')
  const [fps, setFps] = useState<CamFps>(30)
  const resRef = useRef<CamRes>('1080')
  const fpsRef = useRef<CamFps>(30)
  const [torchOk, setTorchOk] = useState(false)
  const [torch, setTorch] = useState(false)
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [lenses, setLenses] = useState<CamLens[]>([])
  const [lensId, setLensId] = useState<string | null>(null)
  const [panel, setPanel] = useState<CamPanel>(null)
  // Pinch to zoom. Phones that let a website zoom the camera (Android) zoom the real camera. iPhones do not, so the
  // picture is enlarged instead (digitalZoom) and each clip keeps that zoom for the editor and the finished video.
  const [digitalZoom, setDigitalZoom] = useState(1)
  const zoomRef = useRef(1)
  const digitalRef = useRef(1)
  const capsRef = useRef<{ min: number; max: number } | null>(null)
  const lensesRef = useRef<CamLens[]>([])
  const lensIdRef = useRef<string | null>(null)
  const pinchBase = useRef(1)
  const lensSwitching = useRef(false)
  const applying = useRef(false)
  const nextNative = useRef<number | null>(null)

  // The size and frame rate to ask the camera for.
  // iPhones and iPads always get asked for the wide shape: their camera is wide, and asking for a tall picture
  // makes Safari cut a narrow strip out of it (a big zoom). Asked for wide, Safari turns the picture upright by itself.
  const sizeConstraints = (landscape: boolean) => {
    const [longSide, shortSide] = resRef.current === '4k' ? [3840, 2160] : resRef.current === '720' ? [1280, 720] : [1920, 1080]
    const wide = landscape || isAppleTouchDevice()
    return { width: { ideal: wide ? longSide : shortSide }, height: { ideal: wide ? shortSide : longSide }, frameRate: { ideal: fpsRef.current } }
  }
  const frameRate = () => fpsRef.current

  const setQuality = (r: CamRes, f: CamFps) => {
    resRef.current = r
    fpsRef.current = f
    setRes(r)
    setFps(f)
  }

  // Call this each time a new camera stream starts, to find out what that camera can do
  const onStream = (stream: MediaStream) => {
    const vt = stream.getVideoTracks()[0]
    setTorch(false)
    setZoom(1)
    zoomRef.current = 1
    digitalRef.current = 1
    setDigitalZoom(1)
    lensSwitching.current = false
    try {
      const caps = (vt?.getCapabilities?.() || {}) as unknown as { torch?: boolean; zoom?: { min: number; max: number } }
      setTorchOk(!!caps.torch)
      const zc = caps.zoom && caps.zoom.max > caps.zoom.min ? { min: caps.zoom.min, max: caps.zoom.max } : null
      capsRef.current = zc
      setZoomCaps(zc)
      // Start at 1x where the camera allows it
      if (zc && zc.min <= 1 && zc.max >= 1) { zoomRef.current = 1 } else if (zc) { zoomRef.current = zc.min; setZoom(zc.min) }
    } catch {
      setTorchOk(false)
      setZoomCaps(null)
      capsRef.current = null
    }
    const currentId = vt?.getSettings?.().deviceId || null
    setLensId(currentId)
    lensIdRef.current = currentId
    navigator.mediaDevices.enumerateDevices().then((devs) => {
      const rear = devs.filter((d) => d.kind === 'videoinput' && /back|rear|environment/i.test(d.label))
      const isRear = !!currentId && rear.some((d) => d.deviceId === currentId)
      // iPhones also list combined cameras ("Back Dual Camera", "Back Triple Camera") that switch lenses by themselves.
      // Leave those out, and show each lens once: .5x, 1x, then the zoom lens.
      const real = rear.filter((d) => !/dual|triple/i.test(d.label))
      const named = real.map((d) => ({ id: d.deviceId, name: /ultra/i.test(d.label) ? '.5x' : /tele/i.test(d.label) ? '2x' : '1x' }))
      const once = named.filter((l, i) => named.findIndex((o) => o.name === l.name) === i)
      const list = isRear && once.length > 1 ? once.sort((a, b) => parseFloat(a.name) - parseFloat(b.name)) : []
      lensesRef.current = list
      setLenses(list)
    }).catch(() => setLenses([]))
  }

  const applyTrack = (settings: Record<string, unknown>) => {
    const vt = getStream()?.getVideoTracks()[0]
    if (!vt) return Promise.resolve(false)
    return vt.applyConstraints({ advanced: [settings] } as unknown as MediaTrackConstraints).then(() => true).catch(() => false)
  }

  const toggleTorch = async () => {
    const next = !torch
    if (await applyTrack({ torch: next })) setTorch(next)
  }

  const changeZoom = async (z: number) => {
    setZoom(z)
    zoomRef.current = z
    await applyTrack({ zoom: z })
  }

  // Real camera zoom, sent one at a time so a fast pinch does not pile up requests
  const applyNative = (z: number) => {
    nextNative.current = z
    if (applying.current) return
    applying.current = true
    const run = () => {
      const v = nextNative.current
      nextNative.current = null
      if (v === null) { applying.current = false; return }
      applyTrack({ zoom: v }).finally(run)
    }
    run()
  }

  const onUltraWide = () => lensesRef.current.some((l) => l.name === '.5x' && l.id === lensIdRef.current)

  // The zoom shown to the person: .5x on the ultra wide lens, otherwise the camera or picture zoom
  const shownZoom = zoomCaps ? zoom : lenses.some((l) => l.name === '.5x' && l.id === lensId) ? 0.5 : digitalZoom

  const pinchStart = () => {
    pinchBase.current = capsRef.current ? zoomRef.current : onUltraWide() ? 0.5 : digitalRef.current
  }

  // factor: how far the fingers have spread since the pinch started (2 = twice as far apart)
  const pinchTo = (factor: number, onLens?: (id: string) => void) => {
    if (lensSwitching.current) return
    const target = pinchBase.current * factor
    const caps = capsRef.current
    if (caps) {
      const z = Math.min(caps.max, Math.max(caps.min, target))
      zoomRef.current = z
      setZoom(z)
      applyNative(z)
      return
    }
    const ultra = lensesRef.current.find((l) => l.name === '.5x')
    const main = lensesRef.current.find((l) => l.name === '1x')
    if (onUltraWide()) {
      // Pinching in from .5x moves back to the main lens
      if (target >= 0.85 && main && onLens) { lensSwitching.current = true; onLens(main.id) }
      return
    }
    if (target < 0.8 && ultra && onLens) {
      // Pinching out past 1x moves to the ultra wide lens
      lensSwitching.current = true
      onLens(ultra.id)
      return
    }
    const z = Math.min(5, Math.max(1, target))
    digitalRef.current = z
    setDigitalZoom(z)
  }

  // Back to 1x
  const resetZoom = (onLens?: (id: string) => void) => {
    if (capsRef.current) { const z = Math.min(capsRef.current.max, Math.max(capsRef.current.min, 1)); zoomRef.current = z; setZoom(z); applyNative(z); return }
    if (onUltraWide()) { const main = lensesRef.current.find((l) => l.name === '1x'); if (main && onLens) { lensSwitching.current = true; onLens(main.id) } return }
    digitalRef.current = 1
    setDigitalZoom(1)
  }

  return { grid, setGrid, timer, setTimer, res, fps, frameRate, torchOk, torch, zoomCaps, zoom, lenses, lensId, panel, setPanel, sizeConstraints, setQuality, onStream, toggleTorch, changeZoom, digitalZoom, shownZoom, pinchStart, pinchTo, resetZoom }
}

export type CameraControlsApi = ReturnType<typeof useCameraControls>
