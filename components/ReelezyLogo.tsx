// Wordmark drawn in code so it reads on a white page (the old logo image had white lettering).
export function ReelezyLogo({ size = 44 }: { size?: number }) {
  const fs = Math.round(size * 0.52)
  return (
    <span
      aria-label="Reelezy"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: fs, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1, height: size }}
    >
      <svg width={fs * 1.25} height={fs * 1.25} viewBox="0 0 40 40" aria-hidden="true">
        <rect x="5" y="14" width="30" height="21" rx="3" fill="#FF6A4D" />
        <path d="M5 10.5 31 3.5l1.4 4.8L6.4 15.3Z" fill="#E4553A" />
        <rect x="5" y="14" width="30" height="5" fill="#E4553A" />
        <rect x="12" y="23" width="9" height="7" rx="1.5" fill="#FFFFFF" />
        <path d="m22.5 25.2 5.5-2.4v7.4l-5.5-2.4Z" fill="#FFFFFF" />
      </svg>
      <span>Reel<b style={{ color: '#FF6A4D', fontWeight: 600 }}>ezy</b></span>
    </span>
  )
}
