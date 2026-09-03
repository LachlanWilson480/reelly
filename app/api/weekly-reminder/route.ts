import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { data: profiles } = await supabaseAdmin
      .from('business_profiles')
      .select('user_id, business_name, notify_weekly_reminder')
      .eq('notify_weekly_reminder', true)

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    let sent = 0

    for (const profile of profiles) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.user_id)
      const email = authUser?.user?.email
      if (!email) continue

      await resend.emails.send({
        from: 'Reelly <noreply@reelly.com.au>',
        to: email,
        subject: 'A fresh batch of content ideas is waiting',
        html: `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #2C2C2A;">Time for this week's content, ${profile.business_name || 'there'}</h2>
          <p style="color: #555;">Jump into Reelly and generate a fresh set of content ideas built for your business - it only takes a couple of minutes.</p>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://reelly.com.au'}/dashboard" style="display: inline-block; background: #D85A30; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Generate ideas</a>
        </div>`,
      })
      sent++
    }

    return NextResponse.json({ sent })
  } catch (error) {
    console.error('weekly-reminder error:', error)
    return NextResponse.json({ error: 'Failed to send reminders' }, { status: 500 })
  }
}
