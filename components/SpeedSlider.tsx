'use client'

// One slider for clip speed everywhere: slow-mo on the left, timelapse on the right, normal in the middle.
// The track is spread evenly by doubling (0.25x, 0.5x, 1x, 2x, 4x, 8x), so 1x sits right in the middle.
export const SPEED_MIN = 0.25
export const SPEED_MAX = 8
const STEPS = 1000
const span = Math.log(SPEED_MAX / SPEED_MIN)

export const speedToPos = (s: number) => Math.round((Math.log(Math.min(SPEED_MAX, Math.max(SPEED_MIN, s || 1)) / SPEED_MIN) / span) * STEPS)

// Neat values: small steps when slow, bigger steps when fast, and it clicks onto Normal near the middle
export const posToSpeed = (p: number) => {
  const raw = SPEED_MIN * Math.exp((Math.min(STEPS, Math.max(0, p)) / STEPS) * span)
  if (Math.abs(raw - 1) < 0.06) return 1
  const step = raw < 1 ? 0.05 : raw < 2 ? 0.1 : 0.25
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, Number((Math.round(raw / step) * step).toFixed(2))))
}

export const speedLabel = (s: number) => (s === 1 ? 'Normal' : `${Number(s.toFixed(2))}x`)

export default function SpeedSlider({ value, onChange, label = 'Speed', dark = false, note = true }: {
  value: number
  onChange: (speed: number) => void
  label?: string
  dark?: boolean
  note?: boolean
}) {
  const v = value || 1
  const ink = dark ? '#fff' : 'var(--ink)'
  const muted = dark ? 'rgba(255,255,255,0.65)' : 'var(--text-muted)'
  const silent = v < 0.5 || v > 2
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: ink }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: v === 1 ? ink : 'var(--coral)', fontVariantNumeric: 'tabular-nums' }}>{speedLabel(v)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={STEPS}
        step={1}
        value={speedToPos(v)}
        aria-label={label}
        aria-valuetext={speedLabel(v)}
        onChange={(e) => onChange(posToSpeed(Number(e.target.value)))}
        style={{ width: '100%', accentColor: 'var(--coral)', margin: '4px 0', minHeight: 28 }}
      />
      <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: muted }}>
        <span>0.25x slow-mo</span>
        <span>Normal</span>
        <span>8x timelapse</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 24 }}>
        {note ? <span style={{ fontSize: 11, color: muted }}>{silent ? 'At this speed the clip plays without sound.' : 'Slower than 0.5x or faster than 2x plays without sound.'}</span> : <span />}
        {v !== 1 && (
          <button type="button" onClick={() => onChange(1)} style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: ink, background: 'none', border: `1px solid ${dark ? 'rgba(255,255,255,0.4)' : 'var(--line)'}`, borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>Reset</button>
        )}
      </div>
    </div>
  )
}
