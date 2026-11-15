import { NextRequest, NextResponse } from 'next/server'
import { tooMany } from '@/lib/limit'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { supabaseAdmin } from '@/lib/platforms'

// Where a finished video is kept in our own storage, if it is there. Only a file in our Supabase project that
// belongs to this person or this video is ever touched.
function storageObject(url: string | null, renderId: string, userId: string): { bucket: string; path: string } | null {
  if (!url || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  try {
    const u = new URL(url)
    if (u.host !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host) return null
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/)
    if (!m) return null
    const bucket = decodeURIComponent(m[1])
    const path = decodeURIComponent(m[2])
    if (path.includes('..') || (!path.startsWith(`${userId}/`) && !path.includes(renderId))) return null
    return { bucket, path }
  } catch {
    return null
  }
}

// Deletes a finished video from Publish: the video file goes, and so do any posts still waiting to go out with it.
// Anything already posted on a platform stays there. The record itself is kept, marked deleted with no video,
// because the free minute and the monthly render minutes are counted from it.
export async function POST(req: NextRequest) {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  { const limited = await tooMany('delete-render:' + authed.userId, 30, 60000); if (limited) return limited }

  const { renderId } = await req.json().catch(() => ({}))
  if (typeof renderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(renderId)) return NextResponse.json({ error: 'Missing video' }, { status: 400 })

  const { data: render } = await supabaseAdmin.from('renders').select('id, status, output_url').eq('id', renderId).eq('user_id', authed.userId).maybeSingle()
  if (!render) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  if (render.status === 'deleted') return NextResponse.json({ ok: true })
  if (['queued', 'rendering', 'processing'].includes(render.status)) return NextResponse.json({ error: 'This video is still being made. Try again when it is finished.' }, { status: 409 })

  const { data: sending } = await supabaseAdmin.from('scheduled_posts').select('id').eq('user_id', authed.userId).eq('idea_id', renderId).eq('status', 'posting').limit(1)
  if (sending && sending.length > 0) return NextResponse.json({ error: 'This video is being posted right now. Try again in a minute.' }, { status: 409 })

  // Posts still waiting to go out would have no video, so they go too
  const { error: postsError } = await supabaseAdmin.from('scheduled_posts').delete().eq('user_id', authed.userId).eq('idea_id', renderId).in('status', ['scheduled', 'not_connected'])
  if (postsError) return NextResponse.json({ error: 'Could not delete the video. Please try again.' }, { status: 500 })

  const obj = storageObject(render.output_url, renderId, authed.userId)
  if (obj) {
    const { error: fileError } = await supabaseAdmin.storage.from(obj.bucket).remove([obj.path])
    if (fileError) console.error('delete-render storage error:', fileError.message)
  }

  let { error } = await supabaseAdmin.from('renders').update({ status: 'deleted', output_url: null }).eq('id', renderId).eq('user_id', authed.userId)
  // If the database only allows its older statuses, 'cleared' with no video still takes it off every list
  if (error && /check|constraint|invalid input/i.test(error.message)) {
    ({ error } = await supabaseAdmin.from('renders').update({ status: 'cleared', output_url: null }).eq('id', renderId).eq('user_id', authed.userId))
  }
  if (error) return NextResponse.json({ error: 'Could not delete the video. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
