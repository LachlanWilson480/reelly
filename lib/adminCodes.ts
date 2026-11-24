import type { SupabaseClient } from '@supabase/supabase-js'

// Every code people can type into the Code box lives in one of these tables. A new code must not clash with any of them,
// or the box could not tell which one someone meant.
export async function codeTaken(admin: SupabaseClient, code: string, except?: { table: string; id?: string }): Promise<string | null> {
  const checks: [string, string, string][] = [
    ['creator_access_codes', 'code', 'a creator account code'],
    ['discount_codes', 'code', 'a discount code'],
    ['creators', 'code', 'a creator\'s commission code'],
    ['referral_codes', 'code', 'someone\'s referral code'],
  ]
  for (const [table, col, label] of checks) {
    const { data } = await admin.from(table).select('*').eq(col, code).limit(1)
    const row = (data || [])[0] as { id?: string } | undefined
    if (!row) continue
    if (except && except.table === table && (!except.id || row.id === except.id)) continue
    return label
  }
  return null
}
