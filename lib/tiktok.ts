// TikTok posting settings. Shared by the Publish page (to ask for them) and the server (to check and use them).
// TikTok requires that the person chooses these themselves, so there is no default for who can view.

export const TIKTOK_PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: 'Everyone',
  FOLLOWER_OF_CREATOR: 'Followers',
  MUTUAL_FOLLOW_FRIENDS: 'Friends',
  SELF_ONLY: 'Only me',
}

export type TikTokOptions = {
  privacy: string // '' until the person chooses
  allowComment: boolean
  allowDuet: boolean
  allowStitch: boolean
  commercial: boolean // "Disclose commercial content"
  yourBrand: boolean // promoting their own business
  brandedContent: boolean // paid partnership
}

export const emptyTikTok: TikTokOptions = { privacy: '', allowComment: false, allowDuet: false, allowStitch: false, commercial: false, yourBrand: false, brandedContent: false }

// Returns a message for the person when something is missing, otherwise ''
export function tiktokProblem(o: TikTokOptions): string {
  if (!o.privacy) return 'Choose who can view your TikTok video.'
  if (o.commercial && !o.yourBrand && !o.brandedContent) return 'Choose what kind of commercial content this is, or turn the disclosure off.'
  if (o.commercial && o.brandedContent && o.privacy === 'SELF_ONLY') return 'Branded content cannot be set to Only me. Choose another option for who can view it.'
  return ''
}

// Server side: accepts only what the form can produce. Returns null if it is not usable.
export function parseTikTokOptions(raw: unknown): TikTokOptions | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const o: TikTokOptions = {
    privacy: typeof r.privacy === 'string' ? r.privacy : '',
    allowComment: r.allowComment === true,
    allowDuet: r.allowDuet === true,
    allowStitch: r.allowStitch === true,
    commercial: r.commercial === true,
    yourBrand: r.commercial === true && r.yourBrand === true,
    brandedContent: r.commercial === true && r.brandedContent === true,
  }
  if (!(o.privacy in TIKTOK_PRIVACY_LABELS)) return null
  return tiktokProblem(o) ? null : o
}

export type TikTokCreator = {
  nickname: string
  username: string
  avatar: string
  privacyOptions: string[]
  commentDisabled: boolean
  duetDisabled: boolean
  stitchDisabled: boolean
}
