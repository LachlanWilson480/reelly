import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// This route is called by Vercel Cron every minute
// Currently stubs out — will post to Instagram/TikTok once OAuth is connected
export async function GET(req: NextRequest) {
  try {
    // Verify this is a legitimate cron call
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

    // Find posts due to be published
    const { data: duePosts, error } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now.toISOString())
      .gte('scheduled_for', fiveMinutesAgo.toISOString())

    if (error) throw error
    if (!duePosts || duePosts.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    let processed = 0

    for (const post of duePosts) {
      try {
        // TODO: Get user's Instagram access token from business_profiles
        // const { data: profile } = await supabaseAdmin
        //   .from('business_profiles')
        //   .select('instagram_access_token, instagram_user_id')
        //   .eq('user_id', post.user_id)
        //   .single()
        //
        // if (profile?.instagram_access_token) {
        //   await postToInstagram(profile.instagram_access_token, profile.instagram_user_id, post)
        // }

        // For now mark as posted (stub)
        await supabaseAdmin
          .from('scheduled_posts')
          .update({ status: 'posted', posted_at: now.toISOString() })
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
