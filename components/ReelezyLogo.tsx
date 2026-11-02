// Reelezy logo: the clapperboard mark (public/logo-mark.png) next to a serif wordmark like the landing page headlines.
export function ReelezyMark({ size = 28 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo-mark.png" alt="" width={size} height={size} style={{ flexShrink: 0, display: 'block' }} />
}

export function ReelezyLogo({ size = 44 }: { size?: number }) {
  const mark = Math.round(size * 1.0)
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
