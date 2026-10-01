import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = authed.userId

    // Delete all storage files for this user
    const { data: files } = await supabaseAdmin.storage
      .from('video-uploads')
      .list(userId, { limit: 1000 })

    if (files && files.length > 0) {
      const paths = files.map((f) => `${userId}/${f.name}`)
      await supabaseAdmin.storage.from('video-uploads').remove(paths)
    }

    // Also delete draft subfolder
    const { data: draftFiles } = await supabaseAdmin.storage
      .from('video-uploads')
      .list(`${userId}/drafts`, { limit: 1000 })

    if (draftFiles && draftFiles.length > 0) {
      const draftPaths = draftFiles.map((f) => `${userId}/drafts/${f.name}`)
      await supabaseAdmin.storage.from('video-uploads').remove(draftPaths)
    }

    // Delete all DB rows
    await supabaseAdmin.from('business_profiles').delete().eq('user_id', userId)
    await supabaseAdmin.from('renders').delete().eq('user_id', userId)
    await supabaseAdmin.from('generated_ideas').delete().eq('user_id', userId)
    await supabaseAdmin.from('generated_scripts').delete().eq('user_id', userId)
    await supabaseAdmin.from('carousels').delete().eq('user_id', userId)
    await supabaseAdmin.from('scheduled_posts').delete().eq('user_id', userId)
    await supabaseAdmin.from('draft_clips').delete().eq('user_id', userId)
    await supabaseAdmin.from('subscriptions').delete().eq('user_id', userId)
    await supabaseAdmin.from('key_events').delete().eq('user_id', userId)

    // Delete the auth user last
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) {
      console.error('delete-account auth error:', error.message)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('delete-account error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
