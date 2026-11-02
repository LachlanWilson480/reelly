import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Used by the login page after a failed sign-in, so a person with no account is sent to sign up
// instead of seeing a vague error. Limited per visitor so it cannot be used to list who has an account.
export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
    const rl = await rateLimit(`acct:${ip}`, 8, 10 * 60 * 1000)
    if (!rl.allowed) return NextResponse.json({ error: 'Too many tries. Please wait a few minutes.' }, { status: 429 })

    const { email } = await req.json()
    const target = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!target || target.length > 200 || !target.includes('@')) return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 })

    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw error
      if (data.users.some((u) => (u.email || '').toLowerCase() === target)) return NextResponse.json({ exists: true })
      if (data.users.length < 1000) break
    }
    return NextResponse.json({ exists: false })
  } catch (error) {
    console.error('account-exists error:', error instanceof Error ? error.message : 'Unknown error')
    // If we cannot tell, do not guess: the login page falls back to a plain message
    return NextResponse.json({ error: 'Could not check.' }, { status: 500 })
  }
}
