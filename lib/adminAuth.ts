import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// The Reelezy team: the email addresses in the ADMIN_EMAILS setting on Vercel, separated by commas
export async function getAdmin(req: NextRequest): Promise<{ userId: string; email: string } | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
  const email = user?.email?.trim().toLowerCase()
  if (!user || !email) return null
  const allowed = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  return allowed.includes(email) ? { userId: user.id, email } : null
}
