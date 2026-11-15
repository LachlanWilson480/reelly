import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://www.reelezy.com', lastModified: new Date(), priority: 1 },
    { url: 'https://www.reelezy.com/plans', lastModified: new Date(), priority: 0.8 },
    { url: 'https://www.reelezy.com/signup', lastModified: new Date(), priority: 0.8 },
    { url: 'https://www.reelezy.com/login', lastModified: new Date(), priority: 0.5 },
    { url: 'https://www.reelezy.com/contact', lastModified: new Date(), priority: 0.4 },
    { url: 'https://www.reelezy.com/privacy', lastModified: new Date(), priority: 0.3 },
    { url: 'https://www.reelezy.com/terms', lastModified: new Date(), priority: 0.3 },
  ]
}
