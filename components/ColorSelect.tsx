'use client'

// The standard colour swatch, plus an optional "No background" button beside it.
export default function ColorSelect({ value, onChange, allowNone = false, noneLabel = 'No background', ariaLabel, height = 40 }: {
  value: string | null
  onChange: (value: string | null) => void
  allowNone?: boolean
  noneLabel?: string
  ariaLabel?: string
  height?: number
}) {
  const none = allowNone && value === null
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        type="color"
        aria-label={ariaLabel}
        value={value ?? '#000000'}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 64, flexShrink: 0, height, padding: 4, border: '1px solid var(--line)', borderRadius: 4, background: 'var(--card-bg)', cursor: 'pointer', opacity: none ? 0.35 : 1 }}
      />
      {allowNone && (
        <button
          type="button"
          aria-pressed={none}
          onClick={() => onChange(none ? '#000000' : null)}
          style={{ height, padding: '0 12px', borderRadius: 4, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', border: none ? '2px solid var(--coral)' : '1px solid var(--line)', background: none ? 'rgba(255,106,77,0.1)' : 'var(--card-bg)', color: none ? 'var(--coral)' : 'var(--ink)' }}
        >
          {noneLabel}
        </button>
      )}
    </div>
  )
}
