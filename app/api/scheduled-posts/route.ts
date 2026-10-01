import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = authed.userId

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_for', { ascending: true })

    if (error) throw error

    return NextResponse.json({ posts: data || [] })
  } catch (error) {
    console.error('scheduled-posts error:', error)
    return NextResponse.json({ error: 'Failed to fetch scheduled posts' }, { status: 500 })
  }
}
