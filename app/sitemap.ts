import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://reelly.com.au', lastModified: new Date(), priority: 1 },
    { url: 'https://reelly.com.au/plans', lastModified: new Date(), priority: 0.8 },
    { url: 'https://reelly.com.au/signup', lastModified: new Date(), priority: 0.8 },
    { url: 'https://reelly.com.au/login', lastModified: new Date(), priority: 0.5 },
    { url: 'https://reelly.com.au/terms', lastModified: new Date(), priority: 0.3 },
  ]
}
