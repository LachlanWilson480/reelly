// Reelezy logo, drawn in code so it stays sharp and matches the site: a coral tile with a play triangle
// and a trim bar (the same handle you drag in the editor), next to a serif wordmark like the landing page headlines.
export function ReelezyMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect width="40" height="40" rx="6" fill="#FF6A4D" />
      <rect x="9" y="10" width="4" height="20" rx="1" fill="#FFFFFF" />
      <path d="M18 10.5v19L33 20z" fill="#FFFFFF" />
    </svg>
  )
}

export function ReelezyLogo({ size = 44 }: { size?: number }) {
  const mark = Math.round(size * 0.66)
  const fs = Math.round(size * 0.58)
  return (
    <span
      aria-label="Reelezy"
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(mark * 0.34), fontFamily: 'var(--serif)', fontSize: fs, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1, height: size }}
    >
      <ReelezyMark size={mark} />
      <span>Reelezy</span>
    </span>
  )
}
