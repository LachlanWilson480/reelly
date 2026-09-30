import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    const editorType = req.nextUrl.searchParams.get('editorType')
    if (!userId) return NextResponse.json({ error: 'No userId' }, { status: 400 })

    const query = supabaseAdmin
      .from('draft_clips')
      .select('*')
      .eq('user_id', userId)
      .order('slot_index', { ascending: true })

    if (editorType) query.eq('editor_type', editorType)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ drafts: data || [] })
  } catch (error) {
    console.error('draft-clips error:', error)
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 })
  }
}
