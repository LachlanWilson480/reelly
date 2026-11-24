import { legalRegionForHost, type LegalRegion } from '@/lib/legalRegion'

// The home address of each Reelezy domain. Google is told these are the same site for different countries.
export const SITE_ORIGINS: Record<LegalRegion, string> = {
  intl: 'https://www.reelezy.com',
  au: 'https://www.reelezy.com.au',
  uk: 'https://www.reelezy.co.uk',
}

// Which country each domain is for: Australia, the UK, and everyone else
export const HREFLANG: Record<string, LegalRegion> = { 'en-AU': 'au', 'en-GB': 'uk', 'x-default': 'intl' }

// The address of the domain this visit came in on, so each domain points at itself (never at another domain).
// Previews and localhost count as the international site.
export function originForHost(host: string | null | undefined): string {
  const h = (host || '').toLowerCase().split(',')[0].trim().split(':')[0]
  if (/^(www\.)?reelezy\.(com|com\.au|co\.uk)$/.test(h)) return `https://${h}`
  return SITE_ORIGINS[legalRegionForHost(h)] || SITE_ORIGINS.intl
}
