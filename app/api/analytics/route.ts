import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { supabaseAdmin } from '@/lib/platforms'

// Totals and best posts, for the Overview and Publish pages
export async function GET(req: NextRequest) {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabaseAdmin.from('post_metrics').select('scheduled_post_id, platform, views, likes, comments, shares, scheduled_posts(title)').eq('user_id', authed.userId)
  type Row = { scheduled_post_id: string; platform: string; views: number; likes: number; comments: number; shares: number; scheduled_posts: { title: string } | { title: string }[] | null }
  const rows = (data || []) as unknown as Row[]
  const totals = rows.reduce((a, r) => ({ views: a.views + r.views, likes: a.likes + r.likes, comments: a.comments + r.comments, shares: a.shares + r.shares }), { views: 0, likes: 0, comments: 0, shares: 0 })
  const byPost = new Map<string, { title: string; views: number; likes: number; platforms: string[] }>()
  for (const r of rows) {
    const t = Array.isArray(r.scheduled_posts) ? r.scheduled_posts[0]?.title : r.scheduled_posts?.title
    const cur = byPost.get(r.scheduled_post_id) || { title: t || 'Untitled', views: 0, likes: 0, platforms: [] }
    cur.views += r.views; cur.likes += r.likes; cur.platforms.push(r.platform)
    byPost.set(r.scheduled_post_id, cur)
  }
  const top = [...byPost.values()].sort((a, b) => b.views - a.views).slice(0, 5)
  return NextResponse.json({ totals, top, tracked: byPost.size })
}
