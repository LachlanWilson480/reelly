import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { shotstackRenderId, userId } = await req.json()

    if (!shotstackRenderId || !userId) {
      return NextResponse.json({ error: 'Missing render ID or user ID' }, { status: 400 })
    }

    const shotstackRes = await fetch(
      `https://api.shotstack.io/edit/v1/render/${shotstackRenderId}`,
      { headers: { 'x-api-key': process.env.SHOTSTACK_API_KEY! } }
    )

    const shotstackData = await shotstackRes.json()
    const status = shotstackData.response.status

    if (status !== 'done') {
      return NextResponse.json({ status, error: status === 'failed' ? shotstackData.response.error : undefined })
    }

    const audioUrl = shotstackData.response.url

    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
      return NextResponse.json({ status: 'failed', error: 'Failed to download extracted audio' })
    }
    const audioBuffer = await audioRes.arrayBuffer()

    const musicPath = `${userId}/extracted-audio-${Date.now()}.mp3`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('video-uploads')
      .upload(musicPath, Buffer.from(audioBuffer), { contentType: 'audio/mpeg' })

    if (uploadError) {
      return NextResponse.json({ status: 'failed', error: 'Failed to save extracted audio' })
    }

    return NextResponse.json({ status: 'done', musicPath })
  } catch (error) {
    console.error('extract-audio-status error:', error)
    return NextResponse.json({ error: 'Failed to check extraction status' }, { status: 500 })
  }
}
