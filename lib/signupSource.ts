// "How did you hear about Reelezy?" and which page someone signed up from.
// Both are saved on the new account (Supabase user_metadata: heard_about, signup_from) and counted on the Admin page.

export const HEARD_OPTIONS: { value: string; label: string }[] = [
  { value: 'google', label: 'Google search' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'friend', label: 'A friend or another business' },
  { value: 'creator', label: 'A creator I follow' },
  { value: 'reddit', label: 'Reddit or a forum' },
  { value: 'event', label: 'A market, event or flyer' },
  { value: 'ai', label: 'ChatGPT, Claude or another AI' },
  { value: 'other', label: 'Somewhere else' },
]

export const HEARD_LABEL: Record<string, string> = Object.fromEntries(HEARD_OPTIONS.map((o) => [o.value, o.label]))

export const SOURCE_KEY = 'reelezy-signup-source'

export const cleanHeard = (v: unknown) => (typeof v === 'string' && HEARD_LABEL[v] ? v : '')
// Page names like "reel-ideas-cafes" or "free-caption-generator", or "site:google.com"
export const cleanFrom = (v: unknown) => (typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9:._-]/g, '').slice(0, 60) : '')

export type SavedSource = { heard?: string; from?: string }

export function readSource(): SavedSource {
  try {
    const s = JSON.parse(localStorage.getItem(SOURCE_KEY) || '{}')
    return { heard: cleanHeard(s.heard) || undefined, from: cleanFrom(s.from) || undefined }
  } catch { return {} }
}

export function saveSource(patch: SavedSource) {
  try { localStorage.setItem(SOURCE_KEY, JSON.stringify({ ...readSource(), ...patch })) } catch {}
}
