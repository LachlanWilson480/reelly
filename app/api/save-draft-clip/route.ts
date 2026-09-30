import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId, editorType, slotIndex, filePath, fileName, ideaId } = await req.json()
    if (!userId || !filePath) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Upsert — replace existing draft for same slot
    await supabaseAdmin
      .from('draft_clips')
      .delete()
      .eq('user_id', userId)
      .eq('editor_type', editorType)
      .eq('slot_index', slotIndex)

    const { data, error } = await supabaseAdmin
      .from('draft_clips')
      .insert({ user_id: userId, editor_type: editorType, slot_index: slotIndex, file_path: filePath, file_name: fileName, idea_id: ideaId || null })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ draft: data })
  } catch (error) {
    console.error('save-draft-clip error:', error)
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 })
  }
}
