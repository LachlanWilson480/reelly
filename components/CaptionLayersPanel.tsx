'use client'

import { useRef } from 'react'
import { type CaptionLayers, type CaptionPosition, type LayerKey, layerPoint } from '@/lib/captionLayers'

type Props = {
  value: CaptionLayers
  onChange: (next: CaptionLayers) => void
  position: CaptionPosition
  landscape?: boolean
}

const LAYERS: { key: LayerKey; name: string; desc: string }[] = [
  { key: 'onScreen', name: 'Captions layer 1', desc: 'On-screen text from your filming instructions. Sits above layer 2.' },
  { key: 'speech', name: 'Captions layer 2', desc: 'What you say, in the style you picked.' },
]

export default function CaptionLayersPanel({ value, onChange, position, landscape }: Props) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<LayerKey | null>(null)

  const move = (clientX: number, clientY: number) => {
    const key = dragRef.current
    const r = frameRef.current?.getBoundingClientRect()
    if (!key || !r || r.width <= 0 || r.height <= 0) return
    const x = Math.min(0.92, Math.max(0.08, (clientX - r.left) / r.width))
    const y = Math.min(0.95, Math.max(0.05, (clientY - r.top) / r.height))
    onChange({ ...value, [key]: { ...value[key], x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 } })
  }
  const moved = value.onScreen.x !== undefined || value.onScreen.y !== undefined || value.speech.x !== undefined || value.speech.y !== undefined

  return (
    <div style={{ margin: '4px 0 14px', padding: 12, borderRadius: 4, border: '1px solid rgba(128,128,128,0.2)', background: 'var(--card-bg)' }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px' }}>Caption layers</p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LAYERS.map((l) => (
            <label key={l.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={value[l.key].on} onChange={(e) => onChange({ ...value, [l.key]: { ...value[l.key], on: e.target.checked } })} style={{ marginTop: 3, accentColor: '#FF6A4D' }} />
              <span>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{l.name}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.35 }}>{l.desc}</span>
              </span>
            </label>
          ))}
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>Drag each label in the frame to where you want that layer to appear.</p>
          {moved && (
            <button type="button" onClick={() => onChange({ onScreen: { on: value.onScreen.on }, speech: { on: value.speech.on } })} style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 4, padding: '5px 10px', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>Reset positions</button>
          )}
        </div>
        <div
          ref={frameRef}
          onPointerMove={(e) => { if (dragRef.current) move(e.clientX, e.clientY) }}
          onPointerUp={() => { dragRef.current = null }}
          onPointerCancel={() => { dragRef.current = null }}
          style={{ position: 'relative', width: landscape ? 220 : 124, aspectRatio: landscape ? '16 / 9' : '9 / 16', borderRadius: 4, background: 'linear-gradient(160deg,#2b2b31,#141417)', border: '2px solid rgba(128,128,128,0.35)', overflow: 'hidden', touchAction: 'none', userSelect: 'none', flexShrink: 0 }}
        >
          {LAYERS.map((l) => {
            const pt = layerPoint(value, l.key, position)
            const on = value[l.key].on
            return (
              <div
                key={l.key}
                onPointerDown={(e) => {
                  if (!on) return
                  dragRef.current = l.key
                  try { frameRef.current?.setPointerCapture(e.pointerId) } catch {}
                  move(e.clientX, e.clientY)
                }}
                style={{ position: 'absolute', left: `${pt.x * 100}%`, top: `${pt.y * 100}%`, transform: 'translate(-50%, -50%)', padding: '3px 6px', borderRadius: 4, fontSize: 10, fontWeight: 800, lineHeight: 1.1, textAlign: 'center', whiteSpace: 'nowrap', cursor: on ? 'grab' : 'default', opacity: on ? 1 : 0.3, background: l.key === 'onScreen' ? '#FF6A4D' : '#fff', color: l.key === 'onScreen' ? '#fff' : '#111', boxShadow: 'none' }}
              >{l.key === 'onScreen' ? 'Layer 1' : 'Layer 2'}</div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
