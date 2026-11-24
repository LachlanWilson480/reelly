import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { originForHost } from '@/lib/siteDomains'

// Each domain points search engines at its own sitemap
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers()
  const origin = originForHost(h.get('x-forwarded-host') || h.get('host'))
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/editor', '/settings', '/onboarding', '/history', '/customise', '/auth', '/admin', '/api'],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  }
}
