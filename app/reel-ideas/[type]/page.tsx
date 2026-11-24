import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PublicShell from '@/components/PublicShell'
import { headers } from 'next/headers'
import { BUSINESS_TYPES, findBusinessType } from '@/lib/reelIdeasContent'
import { originForHost } from '@/lib/siteDomains'

export const dynamicParams = false

export function generateStaticParams() {
  return BUSINESS_TYPES.map((b) => ({ type: b.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type } = await params
  const b = findBusinessType(type)
  if (!b) return {}
  const title = `${b.ideas.length} reel ideas for ${b.name.toLowerCase()} | Reelezy`
  const description = `Instagram and TikTok reel ideas for ${b.name.toLowerCase()}: ${b.ideas.slice(0, 3).map((i) => i.title.toLowerCase()).join(', ')} and more. Each with a hook and what to film.`
  return {
    title,
    description,
    alternates: { canonical: `/reel-ideas/${b.slug}` },
    openGraph: { title, description, url: `/reel-ideas/${b.slug}` },
  }
}

export default async function ReelIdeasForType({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const b = findBusinessType(type)
  if (!b) notFound()

  const h = await headers()
  const origin = originForHost(h.get('x-forwarded-host') || h.get('host'))
  const others = BUSINESS_TYPES.filter((o) => o.slug !== b.slug)
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Reel ideas', item: `${origin}/reel-ideas` },
        { '@type': 'ListItem', position: 2, name: b.name, item: `${origin}/reel-ideas/${b.slug}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Reel ideas for ${b.name.toLowerCase()}`,
      itemListElement: b.ideas.map((i, n) => ({ '@type': 'ListItem', position: n + 1, name: i.title, description: `${i.hook} ${i.film}` })),
    },
  ]

  return (
    <PublicShell from={`reel-ideas-${b.slug}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="pg">
        <div className="lp-wrap">
          <nav className="pg-crumbs" aria-label="Breadcrumb">
            <Link href="/reel-ideas">Reel ideas</Link><span aria-hidden>/</span><span>{b.name}</span>
          </nav>
          <div className="pg-head">
            <h1 className="lp-h1">{b.ideas.length} reel ideas for {b.name.toLowerCase()}</h1>
            <p className="lp-lead">{b.intro}</p>
          </div>

          <div className="pg-grid">
            {b.ideas.map((idea, n) => (
              <article key={idea.title} className="pg-card">
                <span className="pg-n">Idea {n + 1}</span>
                <h3>{idea.title}</h3>
                <p className="pg-label">Open with</p>
                <p className="pg-hook">“{idea.hook}”</p>
                <p className="pg-label">What to film</p>
                <p>{idea.film}</p>
              </article>
            ))}
          </div>

          <div className="pg-two">
            <div>
              <h2 className="lp-h3">Opening lines that work for a {b.one}</h2>
              <ul className="lp-list">{b.hooks.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
            <div>
              <h2 className="lp-h3">Filming tips</h2>
              <ul className="lp-list">{b.tips.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          </div>

          <div className="pg-cta">
            <div>
              <h2 className="lp-h3">Want ideas made for your {b.one}?</h2>
              <p>Reelezy writes reel ideas for your business, gives you a script to read while you film, then edits the video with captions and music. Free to start.</p>
            </div>
            <Link href={`/signup?from=${encodeURIComponent(`reel-ideas-${b.slug}`)}`} className="lp-btn">Get started free</Link>
          </div>

          <div className="pg-more">
            <h2>Reel ideas for other businesses</h2>
            <div className="pg-chips">
              {others.map((o) => <Link key={o.slug} href={`/reel-ideas/${o.slug}`}>{o.name}</Link>)}
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
