import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { renderId } = await req.json()

    const { data: renderRow } = await supabaseAdmin
      .from('renders')
      .select('status, output_url')
      .eq('id', renderId)
      .single()

    if (!renderRow) {
      return NextResponse.json({ error: 'Render not found' }, { status: 404 })
    }

    const status = renderRow.status
    const outputUrl = renderRow.output_url

    const progressMap: Record<string, number> = {
      queued: 10,
      rendering: 60,
      done: 100,
      failed: 0,
    }
    const progress = progressMap[status] ?? 10

    return NextResponse.json({ status, outputUrl, progress })
  } catch (error) {
    console.error('render-status error:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
