import { NextRequest, NextResponse } from 'next/server'
import { postVideo, supabaseAdmin, isConfigured, type Conn } from '@/lib/platforms'
import { isPlatform } from '@/lib/platforms'

export const maxDuration = 300

type Result = { status: 'posted' | 'failed' | 'not_connected'; id?: string; url?: string; error?: string }

// Called by Vercel Cron. Posts every due video to each connected account, and records exactly what happened per platform.
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const { data: duePosts, error } = await supabaseAdmin
      .from('scheduled_posts').select('*').eq('status', 'scheduled')
      .lte('scheduled_for', now.toISOString()).gte('scheduled_for', weekAgo.toISOString())
      .order('scheduled_for', { ascending: true }).limit(10)
    if (error) throw error
    if (!duePosts || duePosts.length === 0) {
      // Extra detail so an empty result can be explained: how many scheduled posts this job can see at all
      const { count, error: countError } = await supabaseAdmin.from('scheduled_posts').select('id', { count: 'exact', head: true }).eq('status', 'scheduled')
      return NextResponse.json({ processed: 0, visibleRows: count, countError: countError?.message || null, checkedAt: now.toISOString() })
    }

    let processed = 0
    for (const post of duePosts) {
      // Claim it first so an overlapping run cannot post it twice
      const { data: claimed } = await supabaseAdmin.from('scheduled_posts').update({ status: 'posting', attempts: (post.attempts || 0) + 1 }).eq('id', post.id).eq('status', 'scheduled').select('id')
      if (!claimed || claimed.length === 0) continue

      const results: Record<string, Result> = { ...(post.results || {}) }
      const { data: conns } = await supabaseAdmin.from('social_connections').select('*').eq('user_id', post.user_id).in('platform', post.platforms)
      for (const platform of post.platforms as string[]) {
        if (!isPlatform(platform) || results[platform]?.status === 'posted') continue
        const conn = (conns as Conn[] | null)?.find((c) => c.platform === platform)
        if (!conn || conn.status !== 'connected' || !isConfigured(platform)) { results[platform] = { status: 'not_connected', error: 'Account not connected' }; continue }
        if (!post.video_url) { results[platform] = { status: 'failed', error: 'No video attached' }; continue }
        try {
          const out = await postVideo(conn, { title: post.title, caption: post.caption || '', videoUrl: post.video_url, tiktok: post.tiktok_options })
          results[platform] = { status: 'posted', id: out.id, url: out.url }
        } catch (e) {
          results[platform] = { status: 'failed', error: (e instanceof Error ? e.message : 'Unknown error').slice(0, 300) }
        }
      }

      const list = Object.values(results)
      const posted = list.filter((r) => r.status === 'posted').length
      const status = posted === list.length ? 'posted' : posted > 0 ? 'partial' : list.every((r) => r.status === 'not_connected') ? 'needs_connection' : 'failed'
      const firstError = list.find((r) => r.error)?.error || null
      await supabaseAdmin.from('scheduled_posts').update({ status, results, posted_at: posted > 0 ? new Date().toISOString() : null, error_text: status === 'posted' ? null : firstError }).eq('id', post.id)
      processed++
    }
    return NextResponse.json({ processed })
  } catch (error) {
    console.error('cron error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
