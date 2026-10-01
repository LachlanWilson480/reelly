import { getAuthedUser } from '@/lib/getAuthedUser'
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
  const userId = authed.userId
    const { ideaId, title, caption, tags, videoUrl, scheduledFor, platforms } = await req.json()

    if (! || !title || !scheduledFor) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (new Date(scheduledFor) < new Date()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .insert({
        user_id:,
        idea_id: ideaId || null,
        title,
        caption: caption || null,
        tags: tags || null,
        video_url: videoUrl || null,
        scheduled_for: scheduledFor,
        platforms: platforms || ['instagram'],
        status: 'scheduled',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ post: data })
  } catch (error) {
    console.error('schedule-post error:', error)
    return NextResponse.json({ error: 'Failed to schedule post' }, { status: 500 })
  }
}
