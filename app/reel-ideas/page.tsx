import type { Metadata } from 'next'
import Link from 'next/link'
import PublicShell from '@/components/PublicShell'
import { headers } from 'next/headers'
import { BUSINESS_TYPES } from '@/lib/reelIdeasContent'
import { originForHost } from '@/lib/siteDomains'

export const metadata: Metadata = {
  title: 'Reel ideas for small businesses, by type of business | Reelezy',
  description: 'Free Instagram and TikTok reel ideas for cafes, salons, barbers, trainers, tradies, florists and 14 more types of small business. Each with a hook and what to film.',
  alternates: { canonical: '/reel-ideas' },
}

export default async function ReelIdeasIndex() {
  const h = await headers()
  const origin = originForHost(h.get('x-forwarded-host') || h.get('host'))
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Reel ideas by type of business',
    itemListElement: BUSINESS_TYPES.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: `Reel ideas for ${b.name.toLowerCase()}`, url: `${origin}/reel-ideas/${b.slug}` })),
  }
  return (
    <PublicShell from="reel-ideas">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="pg">
        <div className="lp-wrap">
          <div className="pg-head">
            <h1 className="lp-h1">Reel ideas for your business</h1>
            <p className="lp-lead">Pick your type of business for six reel ideas you can film this week, with the first line to say and exactly what to film. All free, no sign up needed.</p>
          </div>
          <div className="pg-grid">
            {BUSINESS_TYPES.map((b) => (
              <Link key={b.slug} href={`/reel-ideas/${b.slug}`} className="pg-card">
                <h3>Reel ideas for {b.name.toLowerCase()}</h3>
                <p>{b.ideas.slice(0, 3).map((i) => i.title).join(' · ')}</p>
                <span className="pg-n">{b.ideas.length} ideas</span>
              </Link>
            ))}
          </div>
          <div className="pg-cta">
            <div>
              <h2 className="lp-h3">Not on the list?</h2>
              <p>Type in your business and get three reel ideas written for you in seconds.</p>
            </div>
            <Link href="/free/reel-ideas" className="lp-btn">Try the free idea generator</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
