import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { rateLimit } from '@/lib/rateLimit'
import { getConn, listPhotos, uploadPhoto, deletePhoto, failure, gbpEnabled, PHOTO_CATEGORIES, type PhotoCategory } from '@/lib/googleBusiness'

const MAX_BYTES = 4_000_000 // Vercel rejects request bodies over 4.5MB, the page shrinks photos first
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
  try { return NextResponse.json({ photos: await listPhotos(x.c!) }) }
  catch (e) { const f = failure(e); return NextResponse.json({ error: f.message }, { status: f.status }) }
}

export async function POST(req: NextRequest) {
  const x = await ctx(req); if (x.err) return x.err
  const rl = await rateLimit(`gbp:photo:${x.authed!.userId}`, 20, 60_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Slow down a little and try again.' }, { status: 429 })
  if (Number(req.headers.get('content-length') || 0) > MAX_BYTES + 50_000) return NextResponse.json({ error: 'That photo is too large' }, { status: 413 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file'); const category = String(form?.get('category') || 'ADDITIONAL') as PhotoCategory
  if (!(file instanceof File) || !['image/jpeg', 'image/png'].includes(file.type)) return NextResponse.json({ error: 'Choose a JPG or PNG photo' }, { status: 400 })
  if (file.size > MAX_BYTES || file.size < 10_000) return NextResponse.json({ error: file.size < 10_000 ? 'Google needs photos of at least 10 KB' : 'That photo is too large' }, { status: 413 })
  if (!PHOTO_CATEGORIES.includes(category)) return NextResponse.json({ error: 'Unknown photo type' }, { status: 400 })
  try { await uploadPhoto(x.c!, new Uint8Array(await file.arrayBuffer()), file.type, category); return NextResponse.json({ ok: true }) }
  catch (e) { const f = failure(e); return NextResponse.json({ error: f.message }, { status: f.status }) }
}

export async function DELETE(req: NextRequest) {
  const x = await ctx(req); if (x.err) return x.err
  const { name } = await req.json().catch(() => ({}))
  if (typeof name !== 'string') return NextResponse.json({ error: 'Missing photo' }, { status: 400 })
  try { await deletePhoto(x.c!, name); return NextResponse.json({ ok: true }) }
  catch (e) { const f = failure(e); return NextResponse.json({ error: f.message }, { status: f.status }) }
}
