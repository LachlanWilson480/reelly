import { tooMany } from '@/lib/limit'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { purgeUser } from '@/lib/purgeUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    { const limited = await tooMany('delete-account:' + authed.userId, 3, 3600000); if (limited) return limited }
    const userId = authed.userId

    // Stops their billing, then deletes every file, every row and finally the login (see lib/purgeUser.ts)
    await purgeUser(supabaseAdmin, userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('delete-account error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
