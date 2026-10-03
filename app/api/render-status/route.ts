import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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
      .select('shotstack_render_id, user_id, notified, status, output_url')
      .eq('id', renderId)
      .single()

    if (!renderRow) return NextResponse.json({ error: 'Render not found' }, { status: 404 })
    if (renderRow.user_id !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    // If already done or failed in DB, return cached result
    if (renderRow.status === 'done' || renderRow.status === 'failed') {
      return NextResponse.json({
        status: renderRow.status,
        outputUrl: resolveOutputUrl(renderRow.output_url, renderId, siteUrl),
        progress: renderRow.status === 'done' ? 100 : 0,
        error: renderRow.status === 'failed' ? 'Render failed' : null,
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

    const updateData: Record<string, unknown> = { status }
    if (rawOutputUrl) updateData.output_url = rawOutputUrl
    if (durationSeconds) updateData.duration_seconds = Math.round(durationSeconds)
    await supabaseAdmin.from('renders').update(updateData).eq('id', renderId)

    if (status === 'done' && !renderRow.notified && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(renderRow.user_id)
      const { data: profile } = await supabaseAdmin
        .from('business_profiles')
        .select('notify_render_complete, business_name')
        .eq('user_id', renderRow.user_id)
        .maybeSingle()

      const shouldNotify = profile?.notify_render_complete ?? true
      const email = authUser?.user?.email

      if (shouldNotify && email) {
        await resend.emails.send({
          from: 'Reelezy <noreply@reelezy.com>',
          to: email,
          subject: 'Your video is ready',
          html: `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #2C2C2A;">Your video is ready, ${profile?.business_name || 'there'}!</h2>
            <p style="color: #555;">Your latest render just finished. Log in to Reelezy to view and download it.</p>
            <a href="${siteUrl}/dashboard" style="display: inline-block; background: #D85A30; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">View your video</a>
          </div>`,
        })
      }
      await supabaseAdmin.from('renders').update({ notified: true }).eq('id', renderId)
    }

    const resolvedUrl = resolveOutputUrl(rawOutputUrl, renderId, siteUrl)
    return NextResponse.json({ status, outputUrl: resolvedUrl, progress, error: renderError || null })
  } catch (error) {
    console.error('render-status error:', error)
    return NextResponse.json({ error: 'Failed to check render status' }, { status: 500 })
  }
}
