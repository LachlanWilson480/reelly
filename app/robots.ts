import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/editor', '/settings', '/onboarding', '/history', '/customise', '/auth', '/api'],
    },
    sitemap: 'https://www.reelezy.com/sitemap.xml',
  }
}
