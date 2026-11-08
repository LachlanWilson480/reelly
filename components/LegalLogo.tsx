import Link from 'next/link'

// Logo that links back to the home page. Used at the top of the legal pages.
export default function LegalLogo() {
  return (
    <Link href="/" aria-label="Reelezy home" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 40, textDecoration: 'none', color: 'var(--ink)', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontWeight: 600, fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="" width={33} height={33} style={{ display: 'block', flexShrink: 0 }} />
      <span>Reel<b style={{ color: 'var(--coral)', fontWeight: 600 }}>ezy</b></span>
    </Link>
  )
}
