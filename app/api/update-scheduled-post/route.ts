import { rateLimit } from '@/lib/rateLimit'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// People can only change the time, the text, where it posts, or cancel it. Status and result fields are set by the system.
const ALLOWED_FIELDS = ['status', 'scheduled_for', 'caption', 'tags', 'platforms']
const PLATFORM_IDS = ['youtube', 'tiktok', 'instagram', 'linkedin', 'facebook']

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
    if (typeof postId !== 'string') return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    const u = safeUpdates as Record<string, unknown>
    const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 })
    if ('status' in u && u.status !== 'cancelled') return bad('That change is not allowed')
    if ('caption' in u && u.caption !== null && (typeof u.caption !== 'string' || u.caption.length > 5000)) return bad('That text is too long')
    if ('tags' in u && u.tags !== null && (typeof u.tags !== 'string' || u.tags.length > 1000)) return bad('That text is too long')
    if ('platforms' in u && (!Array.isArray(u.platforms) || u.platforms.length === 0 || !u.platforms.every((p) => typeof p === 'string' && PLATFORM_IDS.includes(p)))) return bad('Choose where to post')
    if ('scheduled_for' in u) {
      const t = new Date(String(u.scheduled_for))
      if (Number.isNaN(t.getTime()) || t.getTime() < Date.now() || t.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) return bad('Pick a time within the next year')
      u.scheduled_for = t.toISOString()
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
    console.error('update-scheduled-post error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}
