import type { Metadata } from 'next'
import Link from 'next/link'
import PublicShell from '@/components/PublicShell'
import FreeCaptionTool from '@/components/free/FreeCaptionTool'

export const metadata: Metadata = {
  title: 'Free caption and hashtag generator for Instagram and TikTok | Reelezy',
  description: 'Write Instagram, TikTok and Facebook captions for your small business in seconds. Three captions and 15 hashtags, including local tags. Free, no sign up needed.',
  alternates: { canonical: '/free/caption-generator' },
}

const FAQ = [
  { q: 'How many hashtags should I use?', a: 'Somewhere between 3 and 15 works well. Pick the ones that match your post and your area rather than using all of them every time.' },
  { q: 'Why add my suburb or town?', a: 'Local hashtags help people near you find your posts, and they are the people most likely to walk in or book.' },
  { q: 'Is it really free?', a: 'Yes. You can write a few sets of captions every hour without an account. Inside Reelezy every video comes with its own caption and hashtags.' },
]

export default function FreeCaptionPage() {
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Reelezy caption and hashtag generator', applicationCategory: 'BusinessApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ]
  return (
    <PublicShell from="free-caption-generator">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="pg">
        <div className="lp-wrap">
          <div className="pg-head">
            <h1 className="lp-h1">Free caption and hashtag generator</h1>
            <p className="lp-lead">Say what your post is about and get three captions, short to long, plus hashtags for your type of business and your area. Ready to copy into Instagram, TikTok or Facebook.</p>
          </div>
          <FreeCaptionTool />

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
              <h2 className="lp-h3">Need something to post?</h2>
              <p className="pg-note" style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 18 }}>Get three reel ideas for your business, each with a hook and what to film.</p>
              <Link href="/free/reel-ideas" className="lp-btn lp-btn-line">Try the reel idea generator</Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
