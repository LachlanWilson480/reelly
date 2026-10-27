'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { CameraControlsApi, CamRes, CamFps } from '@/lib/useCameraControls'

type Props = {
  cam: CameraControlsApi
  cameraActive: boolean
  isRecording: boolean
  counting: boolean
  recordDisabled?: boolean
  hidden?: boolean
  notice?: string | null
  onRecord: () => void
  onStop: () => void
  onFlip: () => void
  onRestart: () => void
  onLens: (id: string) => void
}

const shadow = 'drop-shadow(0 1px 3px rgba(0,0,0,0.65))'
const iconBtn: CSSProperties = { width: 44, height: 44, border: 'none', background: 'transparent', color: '#fff', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', filter: shadow, fontSize: 17, fontWeight: 800 }
const panelBox: CSSProperties = { position: 'absolute', zIndex: 6, background: 'rgba(8,6,24,0.88)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, width: 200 }
const panelLabel: CSSProperties = { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, margin: 0 }
const panelNote: CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 10, lineHeight: 1.35, margin: 0 }
const chip = (on: boolean): CSSProperties => ({ flex: 1, padding: '7px 0', borderRadius: 16, border: 'none', background: on ? 'var(--coral)' : 'rgba(255,255,255,0.14)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' })

function Svg({ children }: { children: ReactNode }) {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}

// The camera controls drawn on top of the picture: left tools, lens picker, and the record row. Shared by both recorders.
export default function CameraControls({ cam, cameraActive, isRecording, counting, recordDisabled, hidden, notice, onRecord, onStop, onFlip, onRestart, onLens }: Props) {
  const lock = isRecording || counting
  const presets = cam.zoomCaps ? [0.5, 1, 2, 5].filter((z) => z >= cam.zoomCaps!.min - 0.01 && z <= cam.zoomCaps!.max + 0.01) : []
  const showArc = !hidden && (cam.lenses.length > 0 || presets.length > 1)
  const qualityTop = cam.res === '4k' ? '4K' : cam.res === '720' ? 'HD' : 'FHD'
  const setQuality = (r: CamRes, f: CamFps) => { cam.setQuality(r, f); onRestart() }

  return (
    <>
      {cam.grid && (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', backgroundImage: 'linear-gradient(to right, transparent calc(33.33% - 0.5px), rgba(255,255,255,0.45) calc(33.33% - 0.5px), rgba(255,255,255,0.45) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), rgba(255,255,255,0.45) calc(66.66% - 0.5px), rgba(255,255,255,0.45) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px)), linear-gradient(to bottom, transparent calc(33.33% - 0.5px), rgba(255,255,255,0.45) calc(33.33% - 0.5px), rgba(255,255,255,0.45) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), rgba(255,255,255,0.45) calc(66.66% - 0.5px), rgba(255,255,255,0.45) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px))' }} />
      )}

      {!hidden && (
        <div style={{ position: 'absolute', left: 8, top: '34%', zIndex: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button type="button" aria-label="Grid lines" aria-pressed={cam.grid} onClick={() => cam.setGrid(!cam.grid)} style={{ ...iconBtn, opacity: cam.grid ? 1 : 0.8 }}>
            <Svg>
              <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
              <path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" strokeWidth={cam.grid ? 1.9 : 1.2} />
            </Svg>
          </button>
          <button type="button" aria-label="Countdown timer" aria-expanded={cam.panel === 'timer'} disabled={lock} onClick={() => cam.setPanel(cam.panel === 'timer' ? null : 'timer')} style={{ ...iconBtn, opacity: lock ? 0.4 : 1 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="13.5" r="7.5" />
              <path d="M9.5 3h5M12 3v3M18.2 6.8l1.2-1.2" />
              {cam.timer ? <text x="12" y="16.8" textAnchor="middle" fontSize={cam.timer === 10 ? 8.5 : 10} fontWeight="800" fill="#fff" stroke="none">{cam.timer}</text> : <path d="M4.5 21 20 6" />}
            </svg>
          </button>
          {cam.torchOk && (
            <button type="button" aria-label="Torch" aria-pressed={cam.torch} onClick={cam.toggleTorch} style={{ ...iconBtn, opacity: cam.torch ? 1 : 0.8 }}>
              <Svg><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" fill={cam.torch ? '#ffd166' : 'none'} stroke={cam.torch ? '#ffd166' : '#fff'} /></Svg>
            </button>
          )}
        </div>
      )}

      {cam.panel && !hidden && (
        <div aria-hidden="true" onClick={() => cam.setPanel(null)} style={{ position: 'absolute', inset: 0, zIndex: 5 }} />
      )}

      {cam.panel === 'timer' && !hidden && (
        <div role="group" aria-label="Countdown timer" style={{ ...panelBox, left: 58, top: 'calc(34% + 50px)' }}>
          <p style={panelLabel}>Countdown</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {([[0, 'Off'], [3, '3s'], [10, '10s']] as const).map(([v, name]) => (
              <button key={name} type="button" onClick={() => cam.setTimer(v)} style={chip(cam.timer === v)}>{name}</button>
            ))}
          </div>
          <p style={panelNote}>How long to wait after you press record before filming starts, so you have time to get ready.</p>
        </div>
      )}

      {cam.panel === 'quality' && !hidden && (
        <div role="group" aria-label="Video quality" style={{ ...panelBox, right: 12, bottom: 96 }}>
          <p style={panelLabel}>Resolution</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['720', '1080', '4k'] as const).map((r) => (
              <button key={r} type="button" disabled={lock} onClick={() => setQuality(r, cam.fps)} style={chip(cam.res === r)}>{r === '4k' ? '4K' : `${r}p`}</button>
            ))}
          </div>
          <p style={panelLabel}>Frame rate</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {([24, 30, 60] as const).map((f) => (
              <button key={f} type="button" disabled={lock} onClick={() => setQuality(cam.res, f)} style={chip(cam.fps === f)}>{f}</button>
            ))}
          </div>
          <p style={panelNote}>Higher settings give a sharper video but bigger files. If your phone can&apos;t do it, it uses the closest it can.</p>
        </div>
      )}

      {showArc && (
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 104, zIndex: 3, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.5)', borderRadius: 24, padding: 4 }}>
          {cam.lenses.length > 0
            ? cam.lenses.map((l) => (
              <button key={l.id} type="button" disabled={lock} onClick={() => onLens(l.id)} style={{ minWidth: 40, height: 34, borderRadius: 17, border: 'none', background: cam.lensId === l.id ? '#fff' : 'transparent', color: cam.lensId === l.id ? '#111' : '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{l.name}</button>
            ))
            : presets.map((z) => (
              <button key={z} type="button" onClick={() => cam.changeZoom(z)} style={{ minWidth: 40, height: 34, borderRadius: 17, border: 'none', background: Math.abs(cam.zoom - z) < 0.05 ? '#fff' : 'transparent', color: Math.abs(cam.zoom - z) < 0.05 ? '#111' : '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{z === 0.5 ? '.5x' : `${z}x`}</button>
            ))}
        </div>
      )}

      {notice && !hidden && (
        <div role="status" style={{ position: 'absolute', left: 14, right: 14, top: '40%', zIndex: 6, background: 'rgba(8,6,24,0.85)', color: '#fff', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{notice}</div>
      )}

      {!hidden && (cameraActive || isRecording) && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, zIndex: 3, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 14px' }}>
          <div />
          <button
            type="button"
            onClick={isRecording ? onStop : onRecord}
            disabled={counting || !!recordDisabled}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            style={{ width: 74, height: 74, borderRadius: '50%', border: '4px solid #fff', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: counting || recordDisabled ? 'not-allowed' : 'pointer', opacity: counting || recordDisabled ? 0.5 : 1 }}
          >
            <span style={{ width: isRecording ? 28 : 56, height: isRecording ? 28 : 56, borderRadius: isRecording ? 8 : '50%', background: '#ff2d55', transition: 'all 0.15s ease' }} />
          </button>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
            <button type="button" className="film-flip" aria-label="Flip camera" disabled={isRecording} onClick={onFlip} style={{ ...iconBtn, opacity: isRecording ? 0.4 : 1 }}>
              <Svg><path d="M20 11a8 8 0 0 0-14-4.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4.5L20 15M20 20v-5h-5" /></Svg>
            </button>
            <button type="button" aria-label="Video quality" aria-expanded={cam.panel === 'quality'} onClick={() => cam.setPanel(cam.panel === 'quality' ? null : 'quality')} style={{ ...iconBtn, width: 46, flexDirection: 'column', lineHeight: 1, fontSize: 15 }}>
              <span>{qualityTop}</span>
              <span>{cam.fps}</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
