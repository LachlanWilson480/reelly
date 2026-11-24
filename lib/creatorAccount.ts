// Creator accounts: a plan given for a set number of months in return for social media content.
// While one runs, the Made with Reelezy badge stays on every video. Set up in supabase/creator_accounts.sql.

export type CreatorSubRow = { status?: string | null; creator_until?: string | null } | null | undefined

// True while the creator account is running
export function creatorActive(row: CreatorSubRow, now = new Date()): boolean {
  return !!row?.creator_until && row.status === 'active' && new Date(row.creator_until) > now
}

// What people type: their handle or a word, plus the random ending, like DAVEYSBARBER-K7Q2.
// Spaces, @ and dots are dropped. The dash is kept, so the code matches exactly how it was made.
export function cleanCreatorCode(value: unknown): string {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

// A random ending, so nobody can claim a creator's code just by guessing their handle.
// No 0, O, 1, I or L, so it is easy to read out and type.
export function randomCodeEnding(length = 4): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => letters[b % letters.length]).join('')
}
