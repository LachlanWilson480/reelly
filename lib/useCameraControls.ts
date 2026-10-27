'use client'

import { useState, useRef } from 'react'

export type CamRes = '720' | '1080' | '4k'
export type CamFps = 24 | 30 | 60
export type CamPanel = 'timer' | 'quality' | null
export type CamLens = { id: string; name: string }

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

  // The size and frame rate to ask the camera for
  const sizeConstraints = (landscape: boolean) => {
    const [longSide, shortSide] = resRef.current === '4k' ? [3840, 2160] : resRef.current === '720' ? [1280, 720] : [1920, 1080]
    return { width: { ideal: landscape ? longSide : shortSide }, height: { ideal: landscape ? shortSide : longSide }, frameRate: { ideal: fpsRef.current } }
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
    try {
      const caps = (vt?.getCapabilities?.() || {}) as unknown as { torch?: boolean; zoom?: { min: number; max: number } }
      setTorchOk(!!caps.torch)
      setZoomCaps(caps.zoom && caps.zoom.max > caps.zoom.min ? { min: caps.zoom.min, max: caps.zoom.max } : null)
    } catch {
      setTorchOk(false)
      setZoomCaps(null)
    }
    const currentId = vt?.getSettings?.().deviceId || null
    setLensId(currentId)
    navigator.mediaDevices.enumerateDevices().then((devs) => {
      const rear = devs.filter((d) => d.kind === 'videoinput' && /back|rear|environment/i.test(d.label))
      const isRear = !!currentId && rear.some((d) => d.deviceId === currentId)
      setLenses(isRear && rear.length > 1
        ? rear.map((d) => ({ id: d.deviceId, name: /ultra/i.test(d.label) ? '.5x' : /tele/i.test(d.label) ? '2x' : '1x' })).sort((a, b) => parseFloat(a.name) - parseFloat(b.name))
        : [])
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
    await applyTrack({ zoom: z })
  }

  return { grid, setGrid, timer, setTimer, res, fps, frameRate, torchOk, torch, zoomCaps, zoom, lenses, lensId, panel, setPanel, sizeConstraints, setQuality, onStream, toggleTorch, changeZoom }
}

export type CameraControlsApi = ReturnType<typeof useCameraControls>
