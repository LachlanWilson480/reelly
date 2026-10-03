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

    const { videoPath } = await req.json()
    if (!videoPath) return NextResponse.json({ error: 'No video provided' }, { status: 400 })

    if (!videoPath.startsWith(`${userId}/`)) {
      return NextResponse.json({ error: 'Invalid video path' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin.storage
      .from('video-uploads')
      .createSignedUrl(videoPath, 3600)

    if (error || !data) {
      return NextResponse.json({ error: 'Failed to sign video URL' }, { status: 500 })
    }

    // Call render server to extract audio synchronously
    const renderServerUrl = process.env.RENDER_SERVER_URL!
    const extractRes = await fetch(`${renderServerUrl}/extract-audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.RENDER_SERVER_SECRET!,
      },
      body: JSON.stringify({ videoUrl: data.signedUrl }),
    })

    if (!extractRes.ok) {
      console.error('Extract audio failed:', extractRes.status)
      return NextResponse.json({ error: 'Failed to extract audio' }, { status: 500 })
    }

    const audioBuffer = await extractRes.arrayBuffer()

    // Upload MP3 to Supabase
    const musicPath = `${userId}/extracted-audio-${Date.now()}.mp3`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('video-uploads')
      .upload(musicPath, Buffer.from(audioBuffer), { contentType: 'audio/mpeg' })

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to save extracted audio' }, { status: 500 })
    }

    return NextResponse.json({ musicPath })
  } catch (error) {
    console.error('extract-audio error:', error)
    return NextResponse.json({ error: 'Failed to extract audio' }, { status: 500 })
  }
}
