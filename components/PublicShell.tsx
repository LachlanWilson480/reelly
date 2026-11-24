import Link from 'next/link'
import type { ReactNode } from 'react'
import '@/app/landing.css'

// The clapperboard mark with the wordmark beside it, same as the homepage
export const PublicLogo = ({ size = 22 }: { size?: number }) => (
  <Link href="/?stay=1" className="lp-logo" style={{ fontSize: size, textDecoration: 'none' }} aria-label="Reelezy home">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/logo-mark.png" alt="" width={Math.round(size * 1.5)} height={Math.round(size * 1.5)} style={{ display: 'block', flexShrink: 0 }} />
    <span>Reel<b>ezy</b></span>
  </Link>
)

// The footer columns, shared with the homepage so every public page links to the free tools and idea pages
export const FOOTER_COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  { title: 'Product', links: [{ href: '/plans', label: 'Plans' }, { href: '/signup', label: 'Sign up' }, { href: '/login', label: 'Log in' }] },
  { title: 'Free tools', links: [{ href: '/free/reel-ideas', label: 'Reel idea generator' }, { href: '/free/caption-generator', label: 'Caption and hashtag generator' }, { href: '/reel-ideas', label: 'Reel ideas by business' }] },
  { title: 'Company', links: [{ href: '/privacy', label: 'Privacy Policy' }, { href: '/terms', label: 'Terms of Service' }, { href: '/contact', label: 'Contact' }] },
]

export function PublicFooter() {
  return (
    <footer className="lp-foot">
      <div className="lp-wrap">
        <div className="lp-foot-top">
          <div>
            <PublicLogo size={24} />
            <p className="lp-foot-line">AI-powered social content for small businesses.</p>
          </div>
          <div className="lp-foot-cols">
            {FOOTER_COLUMNS.map((c) => (
              <div key={c.title}>
                <h4>{c.title}</h4>
                <div className="lp-foot-col">
                  {c.links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="lp-copy">© 2026 Reelezy. All rights reserved.</p>
      </div>
    </footer>
  )
}

// The frame for public pages people land on from Google: top bar, page, footer
export default function PublicShell({ children, from }: { children: ReactNode; from: string }) {
  return (
    <div className="lp">
      <nav className="lp-nav" aria-label="Main">
        <div className="lp-nav-in">
          <PublicLogo />
          <div className="lp-nav-links">
            <Link href="/reel-ideas">Reel ideas</Link>
            <Link href="/free/reel-ideas">Idea generator</Link>
            <Link href="/free/caption-generator">Caption generator</Link>
            <Link href="/plans">Plans</Link>
          </div>
          <div className="lp-nav-actions">
            <Link href="/login" className="lp-login">Log in</Link>
            <Link href={`/signup?from=${encodeURIComponent(from)}`} className="lp-btn lp-btn-sm">Sign up free</Link>
          </div>
        </div>
      </nav>
      <main>{children}</main>
      <PublicFooter />
    </div>
  )
}
