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

    if (!videoPath) {
      return NextResponse.json({ error: 'No video provided' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.storage
      .from('video-uploads')
      .createSignedUrl(videoPath, 3600)

    if (error || !data) {
      return NextResponse.json({ error: 'Failed to sign video URL' }, { status: 500 })
    }

    const edit = {
      timeline: {
        tracks: [
          {
            clips: [
              {
                asset: { type: 'video', src: data.signedUrl },
                start: 0,
                length: 'auto',
              },
            ],
          },
        ],
      },
      output: { format: 'mp3' },
    }

    const shotstackRes = await fetch('https://api.shotstack.io/edit/v1/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.SHOTSTACK_API_KEY!,
      },
      body: JSON.stringify(edit),
    })

    const shotstackData = await shotstackRes.json()

    if (!shotstackRes.ok) {
      console.error('Shotstack extract-audio error:', JSON.stringify(shotstackData, null, 2))
      return NextResponse.json({ error: 'Failed to start audio extraction' }, { status: 500 })
    }

    return NextResponse.json({ shotstackRenderId: shotstackData.response.id })
  } catch (error) {
    console.error('extract-audio error:', error)
    return NextResponse.json({ error: 'Failed to extract audio' }, { status: 500 })
  }
}
