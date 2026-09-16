import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WARNING_DAYS_BEFORE = 10

function buildDeletionWarningEmail(deletionDate: string) {
  const formattedDate = new Date(deletionDate).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1EFE8;padding:40px 0;font-family:Arial,sans-serif;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#FAEEDA;border-radius:12px;padding:32px;">
          <tr>
            <td style="font-family:Arial,sans-serif;color:#2C2C2A;">
              <h1 style="font-size:20px;margin:0 0 16px;color:#2C2C2A;">Your Reelezy data is scheduled for deletion</h1>
              <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">
                Your subscription has ended and your account has been inactive.
                To protect your privacy, we automatically delete account data
                after a grace period.
              </p>
              <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">
                Your data - including your business profile, saved ideas, and
                rendered videos - is scheduled to be permanently deleted on
                <strong>${formattedDate}</strong>.
              </p>
              <p style="font-size:15px;line-height:1.5;margin:0 0 24px;">
                If you'd like to keep your data, simply resubscribe before
                this date and everything will stay exactly as you left it.
              </p>
              <a href="${process.env.NEXT_PUBLIC_SITE_URL}/plans"
                 style="display:inline-block;background-color:#D85A30;color:#FAEEDA;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:bold;">
                Resubscribe
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const warningThreshold = new Date(now.getTime() + WARNING_DAYS_BEFORE * 24 * 60 * 60 * 1000)

  const warned: string[] = []
  const deleted: string[] = []
  const errors: { user_id: string; error: string }[] = []

  try {
    const { data: toWarn, error: warnFetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, deletion_scheduled_at')
      .not('deletion_scheduled_at', 'is', null)
      .lte('deletion_scheduled_at', warningThreshold.toISOString())
      .gt('deletion_scheduled_at', now.toISOString())
      .eq('deletion_warning_sent', false)

    if (warnFetchError) throw warnFetchError

    for (const row of toWarn ?? []) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(row.user_id)
      const email = userData?.user?.email

      if (email && process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'Reelezy <noreply@send.reelezy.com>',
          to: email,
          subject: 'Your Reelezy data will be deleted soon',
          html: buildDeletionWarningEmail(row.deletion_scheduled_at as string),
        })
      }

      await supabaseAdmin
        .from('subscriptions')
        .update({ deletion_warning_sent: true })
        .eq('user_id', row.user_id)

      warned.push(row.user_id)
    }

    const { data: toDelete, error: deleteFetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id')
      .not('deletion_scheduled_at', 'is', null)
      .lte('deletion_scheduled_at', now.toISOString())

    if (deleteFetchError) throw deleteFetchError

    for (const row of toDelete ?? []) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(row.user_id)
      if (deleteError) {
        errors.push({ user_id: row.user_id, error: deleteError.message })
      } else {
        deleted.push(row.user_id)
      }
    }

    return NextResponse.json({ warned: warned.length, deleted: deleted.length, errors })
  } catch (error) {
    console.error('cleanup-inactive-accounts error:', error)
    return NextResponse.json({ error: 'Cleanup job failed' }, { status: 500 })
  }
}
