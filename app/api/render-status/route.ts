import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { Aws } from 'remotion/lambda'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { renderId } = await req.json()

    const { data: renderRow } = await supabaseAdmin
      .from('renders')
      .select('remotion_render_id, user_id, notified, status')
      .eq('id', renderId)
      .single()

    if (!renderRow) {
      return NextResponse.json({ error: 'Render not found' }, { status: 404 })
    }

    const region = process.env.AWS_REGION || 'us-east-1'
    Aws.setRegion(region)
    Aws.setPublicBucket(process.env.REMOTION_BUCKET_NAME || 'reelezy-remotion-renders')

    let remotionStatus
    try {
      remotionStatus = await Aws.getRenderProgress({
        region,
        functionName: process.env.REMOTION_LAMBDA_FUNCTION || 'remotion-prod',
        renderId: renderRow.remotion_render_id,
      })
    } catch (error) {
      console.error('Remotion status check error:', error)
      return NextResponse.json({ error: 'Failed to check render status' }, { status: 500 })
    }

    const status = remotionStatus.currentFrame >= remotionStatus.totalFrames ? 'done' : 'rendering'
    const outputUrl = remotionStatus.outputFile || null
    const durationSeconds = remotionStatus.currentFrame && remotionStatus.fps
      ? Math.round(remotionStatus.currentFrame / remotionStatus.fps)
      : null

    const updateData: Record<string, unknown> = { status, output_url: outputUrl }
    if (durationSeconds !== null) {
      updateData.duration_seconds = durationSeconds
    }

    await supabaseAdmin
      .from('renders')
      .update(updateData)
      .eq('id', renderId)

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
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.reelezy.com'}/dashboard" style="display: inline-block; background: #D85A30; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">View your video</a>
          </div>`,
        })
      }

      await supabaseAdmin.from('renders').update({ notified: true }).eq('id', renderId)
    }

    const progressMap: Record<string, number> = {
      queued: 10,
      fetching: 30,
      rendering: 60,
      saving: 90,
      done: 100,
      failed: 0,
    }
    const progress = progressMap[status] ?? 10

    return NextResponse.json({ status, outputUrl, progress, error: status === "failed" ? "Render failed" : undefined })
  } catch (error) {
    console.error('render-status error:', error)
    return NextResponse.json({ error: 'Failed to check render status' }, { status: 500 })
  }
}
