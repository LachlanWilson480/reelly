'use client'

import { COMFORT_LEVELS, type ComfortLevel } from '@/lib/filmingComfort'

// Three boxes for how much the owner is comfortable doing on camera. `onDark` is for the coloured onboarding card.
export default function ComfortPicker({ value, onChange, onDark = false }: { value: ComfortLevel | null; onChange: (level: ComfortLevel) => void; onDark?: boolean }) {
  const text = onDark ? '#F1EFE8' : 'var(--ink)'
  const muted = onDark ? 'rgba(241,239,232,0.7)' : 'var(--text-muted)'
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block', color: text }}>How comfortable are you on camera?</label>
      <p style={{ fontSize: 12, color: muted, marginBottom: 10 }}>Your ideas, scripts and filming steps will only use what you are happy to do</p>
      <div role="radiogroup" aria-label="Filming comfort level" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {COMFORT_LEVELS.map((level) => {
          const selected = value === level.id
          return (
            <button
              key={level.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(level.id)}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 10,
                border: selected ? '2px solid var(--coral)' : onDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(128,128,128,0.25)',
                background: selected ? 'rgba(255,106,77,0.15)' : onDark ? 'rgba(255,255,255,0.08)' : 'var(--card-bg)',
                color: text,
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{level.title}</span>
              <span style={{ display: 'block', fontSize: 12, lineHeight: 1.4, color: muted }}>{level.description}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
