import { rateLimit } from '@/lib/rateLimit'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\u0000/g, '').slice(0, max) : null)

// Saves the title, description and hashtags the person edits on a finished video in Publish
export async function POST(req: NextRequest) {
  try {
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { allowed } = await rateLimit(`update-render-text:${authed.userId}`, 60, 60_000)
    if (!allowed) return NextResponse.json({ error: 'Too many changes. Please wait a moment.' }, { status: 429 })

    const body = await req.json().catch(() => ({}))
    const renderId = typeof body.renderId === 'string' ? body.renderId : ''
    if (!renderId) return NextResponse.json({ error: 'Missing video' }, { status: 400 })

    const update: Record<string, string | null> = {}
    if ('title' in body) update.title = clip(body.title, 200)
    if ('caption' in body) update.caption = clip(body.caption, 2200)
    if ('tags' in body) update.tags = clip(body.tags, 1000)
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })

    const { data, error } = await supabaseAdmin.from('renders').update(update).eq('id', renderId).eq('user_id', authed.userId).select('id').maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('update-render-text error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }
}
