import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { supabaseAdmin } from '@/lib/platforms'

// Removes a scheduled post from the person's list. It does not remove anything already posted on a platform.
export async function POST(req: NextRequest) {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { postId } = await req.json().catch(() => ({}))
  if (typeof postId !== 'string' || !postId) return NextResponse.json({ error: 'Missing post' }, { status: 400 })
  const { data: post } = await supabaseAdmin.from('scheduled_posts').select('status').eq('id', postId).eq('user_id', authed.userId).maybeSingle()
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (post.status === 'posting') return NextResponse.json({ error: 'This post is being sent right now. Try again in a minute.' }, { status: 409 })
  const { error } = await supabaseAdmin.from('scheduled_posts').delete().eq('id', postId).eq('user_id', authed.userId)
  if (error) return NextResponse.json({ error: 'Could not delete the post' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
