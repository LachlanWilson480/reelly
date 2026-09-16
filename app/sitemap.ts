import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://reelezy.com', lastModified: new Date(), priority: 1 },
    { url: 'https://reelezy.com/plans', lastModified: new Date(), priority: 0.8 },
    { url: 'https://reelezy.com/signup', lastModified: new Date(), priority: 0.8 },
    { url: 'https://reelezy.com/login', lastModified: new Date(), priority: 0.5 },
    { url: 'https://reelezy.com/terms', lastModified: new Date(), priority: 0.3 },
  ]
}
