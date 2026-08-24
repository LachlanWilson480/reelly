import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/editor', '/settings', '/onboarding', '/history', '/customise'],
    },
    sitemap: 'https://reelly.com.au/sitemap.xml',
  }
}
