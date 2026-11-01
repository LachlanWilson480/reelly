import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// This route is called by Vercel Cron every minute
// Posting connections are not live yet, so due posts are flagged 'needs_connection' (never 'posted').
export async function GET(req: NextRequest) {
  try {
    // Verify this is a legitimate cron call
    const authHeader = req.headers.get('authorization')
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Find posts due to be published
    const { data: duePosts, error } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now.toISOString())
      .gte('scheduled_for', dayAgo.toISOString())

    if (error) throw error
    if (!duePosts || duePosts.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    let processed = 0

    for (const post of duePosts) {
      try {
        // Direct posting needs a connection to each platform (or a posting service). Until one is set up,
        // never claim the post went out: mark it so the person knows to post it by hand.
        await supabaseAdmin
          .from('scheduled_posts')
          .update({ status: 'needs_connection', error_text: 'Posting connections are not live yet. Download the video and post it yourself.' })
          .eq('id', post.id)

        processed++
      } catch (err) {
        await supabaseAdmin
          .from('scheduled_posts')
          .update({ status: 'failed', error_text: err instanceof Error ? err.message : 'Unknown error' })
          .eq('id', post.id)
      }
    }

    return NextResponse.json({ processed })
  } catch (error) {
    console.error('cron error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
