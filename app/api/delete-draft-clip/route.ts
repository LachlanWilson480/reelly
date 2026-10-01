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
    const { editorType, slotIndex } = await req.json()
    if (!editorType) return NextResponse.json({ error: 'Missing editorType' }, { status: 400 })

    const query = supabaseAdmin.from('draft_clips').delete().eq('user_id', userId)
    if (editorType) query.eq('editor_type', editorType)
    if (slotIndex !== undefined) query.eq('slot_index', slotIndex)

    await query
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('delete-draft-clip error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 })
  }
}
