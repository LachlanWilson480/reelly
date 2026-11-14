import type { SupabaseClient } from '@supabase/supabase-js'

// Writes to the subscriptions table. If the paid / paid_at columns have not been added yet
// (supabase/migrations/add_subscription_paid.sql), it writes everything else so payments still switch plans on.
const missingPaid = (msg?: string) => !!msg && /paid/.test(msg) && /column|schema/i.test(msg)
const withoutPaid = (row: Record<string, unknown>) => { const rest = { ...row }; delete rest.paid; delete rest.paid_at; return rest }

export async function updateSubscription(admin: SupabaseClient, col: 'user_id' | 'stripe_subscription_id', value: string, row: Record<string, unknown>) {
  let res = await admin.from('subscriptions').update(row).eq(col, value).select('user_id')
  if (res.error && missingPaid(res.error.message)) res = await admin.from('subscriptions').update(withoutPaid(row)).eq(col, value).select('user_id')
  if (res.error) console.error('subscriptions update failed', res.error.message)
  return res
}

export async function upsertSubscription(admin: SupabaseClient, row: Record<string, unknown>) {
  let res = await admin.from('subscriptions').upsert(row, { onConflict: 'user_id' })
  if (res.error && missingPaid(res.error.message)) res = await admin.from('subscriptions').upsert(withoutPaid(row), { onConflict: 'user_id' })
  if (res.error) console.error('subscriptions upsert failed', res.error.message)
  return res
}
