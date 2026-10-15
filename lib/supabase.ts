import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Remember if this page load came from a password-reset email link. Must be read before
// Supabase processes (and clears) the URL hash.
let openedFromRecoveryLink = typeof window !== 'undefined' && window.location.hash.includes('type=recovery')

export function consumeRecoveryFlag(): boolean {
  const value = openedFromRecoveryLink
  openedFromRecoveryLink = false
  return value
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)