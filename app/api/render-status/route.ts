import { rateLimit } from '@/lib/rateLimit'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applyRenderResult } from '@/lib/renderDone'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function resolveOutputUrl(outputUrl: string | null, renderId: string, siteUrl: string): string | null {
  if (!outputUrl) return null
  // If it's already a Supabase public URL, return it directly
  if (outputUrl.includes('supabase.co')) return outputUrl
  // Otherwise proxy it through Next.js
  return `${siteUrl}/api/render-proxy?renderId=${renderId}`
}

export async function POST(req: NextRequest) {
  try {
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = authed.userId

    const { renderId } = await req.json()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const { data: renderRow } = await supabaseAdmin
      .from('renders')
      .select('shotstack_render_id, user_id, notified, status, output_url, over_quota, idea_id, title, source')
      .eq('id', renderId)
      .single()

    if (!renderRow) return NextResponse.json({ error: 'Render not found' }, { status: 404 })
    if (renderRow.user_id !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const clearedIdeaId: string | null = renderRow.idea_id || null
    const clearedScriptTitle: string | null = renderRow.source === 'script' ? (renderRow.title || null) : null

    // If already done or failed in DB, return cached result
    if (renderRow.status === 'done' || renderRow.status === 'failed') {
      return NextResponse.json({
        clearedIdeaId: renderRow.status === 'done' ? clearedIdeaId : null,
        clearedScriptTitle: renderRow.status === 'done' ? clearedScriptTitle : null,
        status: renderRow.status,
        outputUrl: resolveOutputUrl(renderRow.output_url, renderId, siteUrl),
        progress: renderRow.status === 'done' ? 100 : 0,
        error: renderRow.status === 'failed' ? 'Render failed' : null,
        overQuota: renderRow.over_quota === true,
      })
    }

    // Poll render server
    const renderServerUrl = process.env.RENDER_SERVER_URL!
    const pollRes = await fetch(`${renderServerUrl}/renders/${renderRow.shotstack_render_id}`, {
      headers: { 'x-api-key': process.env.RENDER_SERVER_SECRET! },
    })

    if (!pollRes.ok) {
      console.error('Render server poll failed:', pollRes.status)
      return NextResponse.json({ error: 'Failed to check render status' }, { status: 500 })
    }

    const { status, progress, outputUrl: rawOutputUrl, durationSeconds, error: renderError } = await pollRes.json()
    console.log(`[render-status] renderId=${renderId} status=${status} progress=${progress} outputUrl=${rawOutputUrl}`)

    if (status === 'done' || status === 'failed') {
      await applyRenderResult(renderId, { status, outputUrl: rawOutputUrl, durationSeconds })
    } else {
      await supabaseAdmin.from('renders').update({ status }).eq('id', renderId)
    }

    const resolvedUrl = resolveOutputUrl(rawOutputUrl, renderId, siteUrl)
    return NextResponse.json({
      status, outputUrl: resolvedUrl, progress, error: renderError || null,
      clearedIdeaId: status === 'done' ? clearedIdeaId : null,
      clearedScriptTitle: status === 'done' ? clearedScriptTitle : null,
    })
  } catch (error) {
    console.error('render-status error:', error)
    return NextResponse.json({ error: 'Failed to check render status' }, { status: 500 })
  }
}
