import { NextRequest, NextResponse } from 'next/server'
import { fetchMetrics, supabaseAdmin, type Conn } from '@/lib/platforms'

export const maxDuration = 120

// Daily: pulls views and likes for posts from the last 30 days so the AI can learn what works
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: posts } = await supabaseAdmin.from('scheduled_posts').select('id, user_id, results').in('status', ['posted', 'partial']).gte('posted_at', since).limit(200)
  let updated = 0
  for (const post of posts || []) {
    const results = (post.results || {}) as Record<string, { status: string; id?: string }>
    for (const [platform, r] of Object.entries(results)) {
      if (r.status !== 'posted' || !r.id) continue
      try {
        const { data: conn } = await supabaseAdmin.from('social_connections').select('*').eq('user_id', post.user_id).eq('platform', platform).maybeSingle()
        if (!conn) continue
        const m = await fetchMetrics(conn as Conn, r.id)
        if (!m) continue
        await supabaseAdmin.from('post_metrics').upsert({ user_id: post.user_id, scheduled_post_id: post.id, platform, external_id: r.id, ...m, fetched_at: new Date().toISOString() }, { onConflict: 'scheduled_post_id,platform' })
        updated++
      } catch (e) { console.error('metrics failed', platform, e instanceof Error ? e.message : 'unknown') }
    }
  }
  return NextResponse.json({ updated })
}
