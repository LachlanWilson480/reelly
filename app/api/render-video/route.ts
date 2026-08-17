import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId, clipPaths } = await req.json()

    if (!clipPaths || clipPaths.length === 0) {
      return NextResponse.json({ error: 'No clips provided' }, { status: 400 })
    }

    const signedUrls: string[] = []
    for (const path of clipPaths) {
      const { data, error } = await supabaseAdmin.storage
        .from('video-uploads')
        .createSignedUrl(path, 3600)

      if (error || !data) {
        return NextResponse.json({ error: 'Failed to sign clip URLs' }, { status: 500 })
      }
      signedUrls.push(data.signedUrl)
    }

    const clips = signedUrls.map((url, i) => ({
      asset: { type: 'video', src: url },
      start: i === 0 ? 0 : 'auto',
      length: 'auto',
      transition: i > 0 ? { in: 'fade' } : undefined,
    }))

    const timeline = {
      tracks: [{ clips }],
    }

    const edit = {
      timeline,
      output: { format: 'mp4', resolution: 'sd' },
    }

    const shotstackRes = await fetch('https://api.shotstack.io/edit/stage/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.SHOTSTACK_API_KEY!,
      },
      body: JSON.stringify(edit),
    })

    const shotstackData = await shotstackRes.json()

    if (!shotstackRes.ok) {
      console.error('Shotstack error:', shotstackData)
      return NextResponse.json({ error: 'Render request failed' }, { status: 500 })
    }

    const renderId = shotstackData.response.id

    const { data: renderRow, error: dbError } = await supabaseAdmin
      .from('renders')
      .insert({
        user_id: userId,
        shotstack_render_id: renderId,
        status: 'queued',
        clip_paths: clipPaths,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to save render record' }, { status: 500 })
    }

    return NextResponse.json({ renderId: renderRow.id, shotstackRenderId: renderId })
  } catch (error) {
    console.error('render-video error:', error)
    return NextResponse.json({ error: 'Failed to start render' }, { status: 500 })
  }
}
