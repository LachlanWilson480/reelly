// Creator accounts: a plan given for a set number of months in return for social media content.
// While one runs, the Made with Reelezy badge stays on every video. Set up in supabase/creator_accounts.sql.

export type CreatorSubRow = { status?: string | null; creator_until?: string | null } | null | undefined

// True while the creator account is running
export function creatorActive(row: CreatorSubRow, now = new Date()): boolean {
  return !!row?.creator_until && row.status === 'active' && new Date(row.creator_until) > now
}

// What people type: their handle or a word, without spaces, @ or dots. Matches how admin saves it.
export function cleanCreatorCode(value: unknown): string {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40)
}
