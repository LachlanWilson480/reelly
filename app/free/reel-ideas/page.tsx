import type { Metadata } from 'next'
import Link from 'next/link'
import PublicShell from '@/components/PublicShell'
import FreeIdeasTool from '@/components/free/FreeIdeasTool'
import { BUSINESS_TYPES } from '@/lib/reelIdeasContent'

export const metadata: Metadata = {
  title: 'Free reel idea generator for small businesses | Reelezy',
  description: 'Type in your business and get three Instagram and TikTok reel ideas in seconds, each with a hook and what to film. Free, no sign up needed.',
  alternates: { canonical: '/free/reel-ideas' },
}

const FAQ = [
  { q: 'Is it really free?', a: 'Yes. You can get a few sets of ideas every hour without an account. Sign up free if you want ideas made around your own business every week.' },
  { q: 'Do the ideas work for TikTok and Facebook too?', a: 'Yes. Every idea is a short vertical video, so it works as an Instagram Reel, a TikTok, a Facebook Reel or a YouTube Short.' },
  { q: 'I do not want to be on camera. Will that work?', a: 'Many of the ideas can be filmed with just your hands, your products or your space. Inside Reelezy you can set how comfortable you are on camera and every idea follows it.' },
]

export default function FreeReelIdeasPage() {
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Reelezy reel idea generator', applicationCategory: 'BusinessApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ]
  return (
    <PublicShell from="free-reel-ideas">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="pg">
        <div className="lp-wrap">
          <div className="pg-head">
            <h1 className="lp-h1">Free reel idea generator</h1>
            <p className="lp-lead">Tell us your type of business and get three reel ideas you can film on your phone this week, each with the first line to say and what to film.</p>
          </div>
          <FreeIdeasTool />

          <div className="pg-two">
            <div>
              <h2 className="lp-h3">Questions</h2>
              {FAQ.map((f) => (
                <div key={f.q} style={{ marginBottom: 22 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>{f.q}</h3>
                  <p className="pg-note" style={{ fontSize: 15, lineHeight: 1.7 }}>{f.a}</p>
                </div>
              ))}
            </div>
            <div>
              <h2 className="lp-h3">Ideas by type of business</h2>
              <div className="pg-chips">
                {BUSINESS_TYPES.map((b) => <Link key={b.slug} href={`/reel-ideas/${b.slug}`}>{b.name}</Link>)}
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
