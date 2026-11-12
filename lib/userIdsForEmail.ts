import type { SupabaseClient } from '@supabase/supabase-js'

// Every account id that uses this email. Uses the user_ids_for_email database function
// (supabase/migrations/add_email_lookup.sql), which is one quick query however many users there are.
// If that function has not been added yet, it falls back to reading the user list page by page, so it is
// still correct, just slower.
export async function userIdsForEmail(admin: SupabaseClient, email: string): Promise<string[]> {
  const target = email.trim().toLowerCase()
  if (!target) return []
  const { data, error } = await admin.rpc('user_ids_for_email', { p_email: target })
  if (!error && Array.isArray(data)) {
    return data.map((row: unknown) => (typeof row === 'string' ? row : (row as { user_ids_for_email?: string; id?: string })?.user_ids_for_email ?? (row as { id?: string })?.id)).filter((v): v is string => typeof v === 'string')
  }
  console.warn('user_ids_for_email is missing, reading the user list instead. Run supabase/migrations/add_email_lookup.sql.')
  const ids: string[] = []
  for (let page = 1; page <= 100; page++) {
    const { data: list, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (listError) throw listError
    list.users.forEach((u) => { if ((u.email || '').toLowerCase() === target) ids.push(u.id) })
    if (list.users.length < 1000) break
  }
  return ids
}
