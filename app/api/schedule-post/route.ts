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
    const rl = await rateLimit(`schedule:${userId}`, 30, 60_000)
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })

    const { ideaId, title, caption, tags, scheduledFor, platforms, tiktok } = await req.json()

    if (typeof title !== 'string' || !title.trim() || typeof scheduledFor !== 'string' || typeof ideaId !== 'string') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (title.length > 200 || (caption != null && (typeof caption !== 'string' || caption.length > 5000)) || (tags != null && (typeof tags !== 'string' || tags.length > 1000))) {
      return NextResponse.json({ error: 'That text is too long' }, { status: 400 })
    }

    // The video always comes from the person's own finished video, never from an address sent by the browser
    const { data: render } = await supabaseAdmin.from('renders').select('id, output_url').eq('id', ideaId).eq('user_id', userId).maybeSingle()
    if (!render?.output_url) return NextResponse.json({ error: 'Video not found' }, { status: 404 })

    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ error: 'Choose at least one place to post' }, { status: 400 })
    }

    const tiktokOptions = platforms.includes('tiktok') ? parseTikTokOptions(tiktok) : null
    if (platforms.includes('tiktok') && !tiktokOptions) {
      return NextResponse.json({ error: 'Choose your TikTok settings first' }, { status: 400 })
    }

    const when = new Date(scheduledFor)
    if (Number.isNaN(when.getTime()) || when < new Date()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 })
    }
    if (when.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Pick a date within the next year' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .insert({
        user_id: userId,
        idea_id: render.id,
        title: title.trim(),
        caption: caption || null,
        tags: tags || null,
        video_url: render.output_url,
        scheduled_for: when.toISOString(),
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
