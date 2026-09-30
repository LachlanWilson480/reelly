import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId, postId, updates } = await req.json()
    if (!userId || !postId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .update(updates)
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
