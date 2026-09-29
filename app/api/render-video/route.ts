import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASIC_CAP_MIN = 10
const PRO_CAP_MIN = 25
const PREMIUM_CAP_MIN = 60

async function getPlan(userId: string | undefined): Promise<'free' | 'basic' | 'mid' | 'top'> {
  if (!userId) return 'free'
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data || data.status !== 'active') return 'free'
  if (data.plan === 'basic') return 'basic'
  if (data.plan === 'top') return 'top'
  return 'mid'
}

export async function POST(req: NextRequest) {
  try {
    const { userId, clipPaths, captionStyle, musicPath, musicUrl: directMusicUrl, speechClipIndex, speechClipIndices, clipTrims, clipSettings, outputOrientation, resolution, transition } = await req.json()

    if (!clipPaths || clipPaths.length === 0) {
      return NextResponse.json({ error: 'No clips provided' }, { status: 400 })
    }

    if (userId) {
      const plan = await getPlan(userId)

      if (plan === 'free') {
        return NextResponse.json(
          { error: 'Video rendering is not available on the Free plan.' },
          { status: 403 }
        )
      }

      const capMin = plan === 'top' ? PREMIUM_CAP_MIN : plan === 'mid' ? PRO_CAP_MIN : BASIC_CAP_MIN

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const { data: monthRenders } = await supabaseAdmin
        .from('renders')
        .select('duration_seconds')
        .eq('user_id', userId)
        .gte('created_at', monthStart)

      const usedSeconds = (monthRenders || []).reduce((sum, r) => sum + (r.duration_seconds || 0), 0)
      const usedMinutes = usedSeconds / 60

      if (usedMinutes >= capMin) {
        return NextResponse.json(
          { error: `You've used your ${capMin} minutes this month.` },
          { status: 403 }
        )
      }
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

    let musicUrl: string | null = directMusicUrl || null
    if (!musicUrl && musicPath) {
      const { data, error } = await supabaseAdmin.storage
        .from('video-uploads')
        .createSignedUrl(musicPath, 3600)

      if (!error && data) {
        musicUrl = data.signedUrl
      }
    }

    const { data: renderRow, error: dbError } = await supabaseAdmin
      .from('renders')
      .insert({
        user_id: userId,
        status: 'queued',
        clip_paths: clipPaths,
        caption_style: captionStyle || null,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to save render record' }, { status: 500 })
    }

    return NextResponse.json({ renderId: renderRow.id })
  } catch (error) {
    console.error('render-video error:', error)
    return NextResponse.json({ error: 'Failed to start render' }, { status: 500 })
  }
}
