import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_FIELDS = ['status', 'scheduled_for', 'caption', 'tags', 'platforms', 'posted_at', 'error_text']

export async function POST(req: NextRequest) {
  try {
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = authed.userId

    const { postId, updates } = await req.json()
    if (!postId || !updates) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Whitelist allowed fields
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => ALLOWED_FIELDS.includes(key))
    )
    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .update(safeUpdates)
      .eq('id', postId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ post: data })
  } catch (error) {
    console.error('update-scheduled-post error:', error)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}
