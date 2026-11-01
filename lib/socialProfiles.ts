export type PlatformId = 'youtube' | 'tiktok' | 'instagram' | 'linkedin' | 'facebook'

export const PLATFORMS: { id: PlatformId; label: string; placeholder: string; hosts: string[] }[] = [
  { id: 'youtube', label: 'YouTube', placeholder: '@yourchannel', hosts: ['youtube.com', 'youtu.be'] },
  { id: 'tiktok', label: 'TikTok', placeholder: '@yourbusiness', hosts: ['tiktok.com'] },
  { id: 'instagram', label: 'Instagram', placeholder: '@yourbusiness', hosts: ['instagram.com'] },
  { id: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/company/yourbusiness', hosts: ['linkedin.com'] },
  { id: 'facebook', label: 'Facebook', placeholder: 'facebook.com/yourbusiness', hosts: ['facebook.com', 'fb.com'] },
]

export type SocialProfiles = Partial<Record<PlatformId, string>>

// Accepts a handle (@name) or a link to the profile. Returns the cleaned text, '' for empty, or null when it does not look right.
export function cleanProfile(platform: PlatformId, input: string): string | null {
  const v = input.trim()
  if (!v) return ''
  if (v.length > 200) return null
  if (/^@?[A-Za-z0-9._-]{2,60}$/.test(v)) return v.startsWith('@') ? v : `@${v}`
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    const def = PLATFORMS.find((p) => p.id === platform)
    if (!def || !def.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return null
    return `${u.hostname.replace(/^www\./, '')}${u.pathname}`.replace(/\/$/, '')
  } catch { return null }
}

export function connectedPlatforms(p: SocialProfiles | null | undefined): PlatformId[] {
  return PLATFORMS.filter((x) => !!p?.[x.id]).map((x) => x.id)
}
