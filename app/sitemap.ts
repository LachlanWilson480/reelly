import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { HREFLANG, SITE_ORIGINS, originForHost } from '@/lib/siteDomains'
import { BUSINESS_TYPES } from '@/lib/reelIdeasContent'

// The public pages, how important each one is, and how often it changes
const PAGES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }[] = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/plans', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/signup', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/refer', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/login', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/free/reel-ideas', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/free/caption-generator', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/reel-ideas', priority: 0.8, changeFrequency: 'monthly' },
  ...BUSINESS_TYPES.map((b) => ({ path: `/reel-ideas/${b.slug}`, priority: 0.7, changeFrequency: 'monthly' as const })),
]

// One sitemap per domain: reelezy.com.au/sitemap.xml lists .com.au pages, reelezy.co.uk/sitemap.xml lists .co.uk pages.
// Each page also names its twin on the other domains, so Google shows Australians the .com.au page, and so on.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers()
  const origin = originForHost(h.get('x-forwarded-host') || h.get('host'))
  const lastModified = new Date()
  return PAGES.map((p) => ({
    url: `${origin}${p.path || '/'}`,
    lastModified,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
    alternates: {
      languages: Object.fromEntries(Object.entries(HREFLANG).map(([lang, region]) => [lang, `${SITE_ORIGINS[region]}${p.path || '/'}`])),
    },
  }))
}
