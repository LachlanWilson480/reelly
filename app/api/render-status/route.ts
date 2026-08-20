import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { renderId } = await req.json()

    const { data: renderRow } = await supabaseAdmin
      .from('renders')
      .select('shotstack_render_id, user_id, notified, status')
      .eq('id', renderId)
      .single()

    if (!renderRow) {
      return NextResponse.json({ error: 'Render not found' }, { status: 404 })
    }

    const shotstackRes = await fetch(
      `https://api.shotstack.io/edit/stage/render/${renderRow.shotstack_render_id}`,
      { headers: { 'x-api-key': process.env.SHOTSTACK_API_KEY! } }
    )

    const shotstackData = await shotstackRes.json()
    if (shotstackData.response.status === 'failed') console.log('RENDER FAILED:', JSON.stringify(shotstackData.response, null, 2))
    const status = shotstackData.response.status
    const outputUrl = shotstackData.response.url || null

    await supabaseAdmin
      .from('renders')
      .update({ status, output_url: outputUrl })
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
          from: 'Reelly <noreply@reelly.com.au>',
          to: email,
          subject: 'Your video is ready',
          html: `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #2C2C2A;">Your video is ready, ${profile?.business_name || 'there'}!</h2>
            <p style="color: #555;">Your latest render just finished. Log in to Reelly to view and download it.</p>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://reelly.com.au'}/dashboard" style="display: inline-block; background: #D85A30; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">View your video</a>
          </div>`,
        })
      }

      await supabaseAdmin.from('renders').update({ notified: true }).eq('id', renderId)
    }

    return NextResponse.json({ status, outputUrl })
  } catch (error) {
    console.error('render-status error:', error)
    return NextResponse.json({ error: 'Failed to check render status' }, { status: 500 })
  }
}
