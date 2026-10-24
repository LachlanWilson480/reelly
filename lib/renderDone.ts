import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Saves the result of a render. Used both when the app asks for the status and when the render server
// calls us the moment a render finishes, so videos still complete when nobody has the app open.
export async function applyRenderResult(
  renderId: string,
  result: { status: 'done' | 'failed'; outputUrl?: string | null; durationSeconds?: number | null }
) {
  const { data: row } = await supabaseAdmin
    .from('renders')
    .select('user_id, idea_id, title, source')
    .eq('id', renderId)
    .single()
  if (!row) return null

  const update: Record<string, unknown> = { status: result.status }
  if (result.outputUrl) update.output_url = result.outputUrl
  if (result.durationSeconds) update.duration_seconds = Math.round(result.durationSeconds)
  await supabaseAdmin.from('renders').update(update).eq('id', renderId)

  if (result.status !== 'done') return row

  // The video is ready (it now shows on the Publish page), so the idea and its filming instructions are finished with
  if (row.idea_id) {
    await supabaseAdmin.from('generated_ideas').update({ saved: false, filming_cleared: true }).eq('id', row.idea_id).eq('user_id', row.user_id)
  }
  if (row.source === 'script' && row.title) {
    await supabaseAdmin.from('generated_scripts').update({ dismissed: true }).eq('user_id', row.user_id).eq('topic', row.title)
    await supabaseAdmin.from('generated_ideas').update({ saved: false, filming_cleared: true }).eq('user_id', row.user_id).eq('source', 'script').eq('title', row.title)
  }

  // Email the user once per video. Claiming the flag first stops two callers sending it twice.
  if (process.env.RESEND_API_KEY) {
    const { data: claimed } = await supabaseAdmin
      .from('renders')
      .update({ notified: true })
      .eq('id', renderId)
      .or('notified.is.null,notified.eq.false')
      .select('id')
    if (claimed && claimed.length > 0) {
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(row.user_id)
        const { data: profile } = await supabaseAdmin
          .from('business_profiles')
          .select('notify_render_complete, business_name')
          .eq('user_id', row.user_id)
          .maybeSingle()
        const shouldNotify = profile?.notify_render_complete ?? true
        const email = authUser?.user?.email
        if (shouldNotify && email) {
          const resend = new Resend(process.env.RESEND_API_KEY)
          await resend.emails.send({
            from: 'Reelezy <noreply@reelezy.com>',
            to: email,
            subject: 'Your video is ready',
            html: `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #2C2C2A;">Your video is ready, ${profile?.business_name || 'there'}!</h2>
            <p style="color: #555;">Your latest render just finished. Log in to Reelezy to view and download it.</p>
            <a href="${siteUrl}/dashboard/scheduler" style="display: inline-block; background: #FF6A4D; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">View your video</a>
          </div>`,
          })
        }
      } catch (err) {
        console.error('render-done email failed:', err instanceof Error ? err.message : 'Unknown error')
      }
    }
  }

  return row
}
