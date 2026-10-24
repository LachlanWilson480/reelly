import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { applyRenderResult } from '@/lib/renderDone'

// Called by the render server the moment a render finishes or fails, so the result is saved
// even when the person has closed the app or switched their phone off.
export async function POST(req: NextRequest) {
  const secret = process.env.RENDER_SERVER_SECRET
  const given = req.headers.get('x-api-key') || ''
  const ok = !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret))
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { renderId, status, outputUrl, durationSeconds } = await req.json()
    if (typeof renderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(renderId)) {
      return NextResponse.json({ error: 'Invalid render id' }, { status: 400 })
    }
    if (status !== 'done' && status !== 'failed') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    const row = await applyRenderResult(renderId, {
      status,
      outputUrl: typeof outputUrl === 'string' ? outputUrl : null,
      durationSeconds: typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) ? durationSeconds : null,
    })
    if (!row) return NextResponse.json({ error: 'Render not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('render-callback error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Failed to save render result' }, { status: 500 })
  }
}
