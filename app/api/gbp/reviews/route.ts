import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { rateLimit } from '@/lib/rateLimit'
import { getConn, listReviews, replyToReview, deleteReply, failure, gbpEnabled } from '@/lib/googleBusiness'

async function ctx(req: NextRequest) {
  const authed = await getAuthedUser(req)
  if (!authed) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!gbpEnabled()) return { err: NextResponse.json({ error: 'This connection is not switched on yet' }, { status: 503 }) }
  const c = await getConn(authed.userId)
  if (!c || c.status !== 'connected') return { err: NextResponse.json({ error: 'Connect Google Business Profile first' }, { status: 400 }) }
  return { authed, c }
}

export async function GET(req: NextRequest) {
  const x = await ctx(req); if (x.err) return x.err
  try { return NextResponse.json(await listReviews(x.c!)) }
  catch (e) { const f = failure(e); return NextResponse.json({ error: f.message }, { status: f.status }) }
}

// Post (or change) a public reply
export async function POST(req: NextRequest) {
  const x = await ctx(req); if (x.err) return x.err
  const rl = await rateLimit(`gbp:reply:${x.authed!.userId}`, 20, 60_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Slow down a little and try again.' }, { status: 429 })
  const { review, comment } = await req.json().catch(() => ({}))
  if (typeof review !== 'string' || typeof comment !== 'string' || !comment.trim()) return NextResponse.json({ error: 'Write a reply first' }, { status: 400 })
  try { await replyToReview(x.c!, review, comment.trim()); return NextResponse.json({ ok: true }) }
  catch (e) { const f = failure(e); return NextResponse.json({ error: f.message }, { status: f.status }) }
}

export async function DELETE(req: NextRequest) {
  const x = await ctx(req); if (x.err) return x.err
  const { review } = await req.json().catch(() => ({}))
  if (typeof review !== 'string') return NextResponse.json({ error: 'Missing review' }, { status: 400 })
  try { await deleteReply(x.c!, review); return NextResponse.json({ ok: true }) }
  catch (e) { const f = failure(e); return NextResponse.json({ error: f.message }, { status: f.status }) }
}
