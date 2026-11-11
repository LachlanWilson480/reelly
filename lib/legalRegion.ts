// Which version of the legal pages a visitor sees, chosen by the domain they opened.
// .co.uk is the UK version, .com.au is the Australian version, anything else (.com, previews, localhost) is international.
export type LegalRegion = 'au' | 'uk' | 'intl'

export function legalRegionForHost(host: string | null | undefined): LegalRegion {
  const h = (host || '').toLowerCase().split(',')[0].trim().split(':')[0]
  if (h.endsWith('.co.uk')) return 'uk'
  if (h.endsWith('.com.au')) return 'au'
  return 'intl'
}

export const LEGAL_SITE: Record<LegalRegion, string> = { au: 'reelezy.com.au', uk: 'reelezy.co.uk', intl: 'reelezy.com' }
