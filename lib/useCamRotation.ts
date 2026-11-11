'use client'

import { useState, useRef, useEffect } from 'react'
import { isTouchDevice } from '@/lib/openCamera'

// Some phones hand the app a sideways picture (wide when the phone is held upright, or the other way round).
// This turns the picture the right way up for what you see and for what gets recorded. It only ever acts on phones and
// tablets, and only when the picture is the wrong shape for the video you chose. One tap on Rotate flips the direction.
const KEY = 'reelezy-cam-rot'

export function useCamRotation(portrait: boolean) {
  const [dir, setDir] = useState<90 | 270>(90)
  const [off, setOff] = useState(false)
  const [mismatch, setMismatch] = useState(false)
  const touch = isTouchDevice()
  const rot: 0 | 90 | 270 = touch && mismatch && !off ? dir : 0
  const rotRef = useRef<0 | 90 | 270>(0)
  useEffect(() => { rotRef.current = rot })

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const s = localStorage.getItem(KEY)
        if (s === 'off') setOff(true)
        else if (s === '270') setDir(270)
      } catch {}
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const onMeta = (v: HTMLVideoElement) => {
    if (v.videoWidth > 0 && v.videoHeight > 0) setMismatch((v.videoWidth > v.videoHeight) === portrait)
  }

  const cycle = () => {
    let nextDir = dir
    let nextOff = off
    if (off) { nextOff = false; nextDir = 90 }
    else if (dir === 90) { nextDir = 270 }
    else { nextOff = true }
    setDir(nextDir)
    setOff(nextOff)
    try { localStorage.setItem(KEY, nextOff ? 'off' : String(nextDir)) } catch {}
  }

  // Style for the live preview. A turned picture is laid out sideways inside the box so it fills it exactly.
  const videoStyle = (mirrored: boolean): React.CSSProperties => {
    if (rot === 0) return { width: '100%', height: '100%', objectFit: touch ? 'contain' : 'cover', transform: mirrored ? 'scaleX(-1)' : 'none', display: 'block' }
    const along = portrait ? '177.78%' : '56.25%'
    const across = portrait ? '56.25%' : '177.78%'
    return { position: 'absolute', left: '50%', top: '50%', width: along, height: across, objectFit: 'cover', transform: `translate(-50%, -50%) rotate(${rot}deg)${mirrored ? ' scaleX(-1)' : ''}`, display: 'block' }
  }

  return { rot, rotRef, mismatch, onMeta, cycle, videoStyle, touch }
}

// Draws the turned picture onto a canvas so the recording comes out the right way up too
export function rotatedCanvasStream(vid: HTMLVideoElement, rot: number, portrait: boolean, fps: number) {
  const outW = portrait ? 1080 : 1920
  const outH = portrait ? 1920 : 1080
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  let raf = 0
  const draw = () => {
    const vw = vid.videoWidth
    const vh = vid.videoHeight
    if (ctx && vw > 0 && vh > 0) {
      const swap = rot === 90 || rot === 270
      const dw = swap ? outH : outW
      const dh = swap ? outW : outH
      const s = Math.max(dw / vw, dh / vh)
      ctx.save()
      ctx.translate(outW / 2, outH / 2)
      ctx.rotate((rot * Math.PI) / 180)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(vid, (-vw * s) / 2, (-vh * s) / 2, vw * s, vh * s)
      ctx.restore()
    }
    raf = requestAnimationFrame(draw)
  }
  draw()
  const stream = canvas.captureStream(fps)
  return { stream, stop: () => { cancelAnimationFrame(raf); stream.getVideoTracks().forEach((t) => t.stop()) } }
}
