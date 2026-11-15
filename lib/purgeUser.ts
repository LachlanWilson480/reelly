import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

// Everything a person's account owns. Used by "Delete account" in Settings and by the job that deletes
// accounts after their subscription has lapsed. Order matters:
//   1. stop their Stripe billing (if that fails we stop, so nobody is charged for an account that no longer exists)
//   2. delete every file they uploaded or rendered, in every folder
//   3. delete their rows in every table
//   4. delete their login last
// Billing records stay in Stripe, because tax law requires us to keep them.

const TABLES = [
  'scheduled_posts', 'post_metrics', 'social_connections', 'draft_clips', 'clip_library', 'clip_albums',
  'carousels', 'renders', 'generated_ideas', 'generated_scripts', 'key_events', 'referral_codes', 'ai_spend',
  'business_profiles', 'subscriptions',
]
const BUCKETS = ['video-uploads', 'business-logos']

// Every file path under a folder, however deep. Storage lists one level at a time, 1000 at most per page.
async function listAll(admin: SupabaseClient, bucket: string, folder: string, depth = 0): Promise<string[]> {
  if (depth > 6) return []
  const out: string[] = []
  for (let offset = 0; offset < 100000; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 1000, offset })
    if (error || !data || data.length === 0) break
    for (const entry of data) {
      const path = `${folder}/${entry.name}`
      // Folders come back without an id
      if (entry.id === null || entry.id === undefined) out.push(...(await listAll(admin, bucket, path, depth + 1)))
      else out.push(path)
    }
    if (data.length < 1000) break
  }
  return out
}

export async function stopBilling(admin: SupabaseClient, userId: string) {
  const { data: sub } = await admin.from('subscriptions').select('stripe_subscription_id').eq('user_id', userId).maybeSingle()
  const subId = sub?.stripe_subscription_id
  if (!subId) return
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured')
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  try {
    const live = await stripe.subscriptions.retrieve(subId)
    if (live.status !== 'canceled' && live.status !== 'incomplete_expired') await stripe.subscriptions.cancel(subId)
  } catch (e) {
    // A subscription Stripe no longer has is already stopped
    if ((e as { code?: string })?.code !== 'resource_missing') throw e
  }
}

export async function purgeUser(admin: SupabaseClient, userId: string): Promise<{ files: number }> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Bad user id')
  await stopBilling(admin, userId)

  let files = 0
  for (const bucket of BUCKETS) {
    const paths = await listAll(admin, bucket, userId)
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100))
      if (error) throw new Error(`Could not delete files: ${error.message}`)
    }
    files += paths.length
  }

  for (const table of TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', userId)
    // A table that does not exist (yet) is fine; anything else stops the deletion so it can be retried
    if (error && !/does not exist|schema cache/i.test(error.message)) throw new Error(`Could not delete ${table}: ${error.message}`)
  }

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error && !/not found/i.test(error.message)) throw new Error(`Could not delete login: ${error.message}`)
  return { files }
}
