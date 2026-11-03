import { rateLimit } from '@/lib/rateLimit'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseTikTokOptions } from '@/lib/tiktok'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = authed.userId
    const { ideaId, title, caption, tags, videoUrl, scheduledFor, platforms, tiktok } = await req.json()

    if (!title || !scheduledFor) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ error: 'Choose at least one place to post' }, { status: 400 })
    }

    const tiktokOptions = platforms.includes('tiktok') ? parseTikTokOptions(tiktok) : null
    if (platforms.includes('tiktok') && !tiktokOptions) {
      return NextResponse.json({ error: 'Choose your TikTok settings first' }, { status: 400 })
    }

    if (new Date(scheduledFor) < new Date()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .insert({
        user_id: userId,
        idea_id: ideaId || null,
        title,
        caption: caption || null,
        tags: tags || null,
        video_url: videoUrl || null,
        scheduled_for: scheduledFor,
        platforms: Array.isArray(platforms) ? platforms.filter((p: unknown) => typeof p === 'string' && ['youtube', 'tiktok', 'instagram', 'linkedin', 'facebook'].includes(p)) : [],
        status: 'scheduled',
        tiktok_options: tiktokOptions,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ post: data })
  } catch (error) {
    console.error('schedule-post error:', error instanceof Error ? error.message : JSON.stringify(error))
    return NextResponse.json({ error: 'Failed to schedule post' }, { status: 500 })
  }
}
