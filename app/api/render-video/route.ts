import { rateLimit } from '@/lib/rateLimit'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ClipTrim = { trimStart?: number; trimLength?: number; duration?: number }
type ClipSetting = { muted?: boolean; volume?: number; fit?: 'crop' | 'cover' | 'contain'; position?: string; speed?: number; filter?: string; rotate?: number; flipH?: boolean; flipV?: boolean; letterbox?: boolean }

const BASIC_CAP_MIN = 25
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
    const authed = await getAuthedUser(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = authed.userId

    const rl = await rateLimit(`ai:${userId}`, 5, 60000)
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })

    const { clipPaths, musicPath, musicUrl: directMusicUrl, clipTrims, clipSettings, outputOrientation, resolution, cutDeadSpace, captionStyle, perClipTransitions, ideaId, ideaTitle, ideaCaption, ideaTags } = await req.json()

    if (!clipPaths || clipPaths.length === 0) {
      return NextResponse.json({ error: 'No clips provided' }, { status: 400 })
    }

    for (const path of clipPaths) {
      if (!path.startsWith(`${userId}/`)) {
        return NextResponse.json({ error: 'Invalid clip path' }, { status: 403 })
      }
    }
    if (musicPath && !musicPath.startsWith(`${userId}/`)) {
      return NextResponse.json({ error: 'Invalid music path' }, { status: 403 })
    }

    const plan = await getPlan(userId)

    // Free plan: 2 reels max, 60s total lifetime, watermark all renders
    const FREE_REEL_LIMIT = 2
    const FREE_CAP_SECONDS = 60
    if (plan === 'free') {
      const { data: allRenders } = await supabaseAdmin
        .from('renders')
        .select('duration_seconds')
        .eq('user_id', userId)
      const totalReels = (allRenders || []).length
      if (totalReels >= FREE_REEL_LIMIT) {
        return NextResponse.json({ error: 'Free plan includes 2 reels. Upgrade to create more videos.' }, { status: 403 })
      }
    }

    const capMin = plan === 'top' ? PREMIUM_CAP_MIN : plan === 'mid' ? PRO_CAP_MIN : BASIC_CAP_MIN
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const { data: monthRenders } = plan !== 'free' ? await supabaseAdmin
      .from('renders')
      .select('duration_seconds')
      .eq('user_id', userId)
      .gte('created_at', monthStart) : { data: [] }

    const usedSeconds = (monthRenders || []).reduce((sum: number, r: { duration_seconds: number | null }) => sum + (r.duration_seconds || 0), 0)
    if (plan !== 'free' && usedSeconds / 60 >= capMin) {
      return NextResponse.json(
        { error: `You've used your ${capMin} minutes of render time for this month. Upgrade for more render time.` },
        { status: 403 }
      )
    }

    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    const { count: globalDailyRenders } = await supabaseAdmin
      .from('renders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dayStart.toISOString())
    if ((globalDailyRenders || 0) >= 500) {
      return NextResponse.json({ error: 'Daily render limit reached. Please try again tomorrow.' }, { status: 429 })
    }

    const signedUrls: string[] = []
    for (const p of clipPaths) {
      const { data, error } = await supabaseAdmin.storage.from('video-uploads').createSignedUrl(p, 3600)
      if (error || !data) return NextResponse.json({ error: 'Failed to sign clip URLs' }, { status: 500 })
      signedUrls.push(data.signedUrl)
    }

    let musicUrl: string | null = directMusicUrl || null
    if (!musicUrl && musicPath) {
      const { data, error } = await supabaseAdmin.storage.from('video-uploads').createSignedUrl(musicPath, 3600)
      if (!error && data) musicUrl = data.signedUrl
    }

    const trims: ClipTrim[] = Array.isArray(clipTrims) ? clipTrims : []
    const settings: ClipSetting[] = Array.isArray(clipSettings) ? clipSettings : []

    const clips = signedUrls.map((src, i) => {
      const trim = trims[i] || {}
      const setting = settings[i] || {}
      const trimStart = trim.trimStart ?? 0
      const durationInSeconds =
        typeof trim.trimLength === 'number' && trim.trimLength > 0
          ? trim.trimLength
          : typeof trim.duration === 'number' && trim.duration > 0
          ? Math.max(0.1, trim.duration - trimStart)
          : 5

      return {
        src,
        trimStart: trimStart > 0 ? trimStart : undefined,
        trimLength: trim.trimLength,
        duration: trim.duration,
        volume: setting.muted ? 0 : typeof setting.volume === 'number' ? setting.volume : 1,
        speed: setting.speed,
        fit: setting.fit,
        filter: setting.filter !== 'none' ? setting.filter : undefined,
        rotate: setting.rotate,
        flipH: setting.flipH,
        flipV: setting.flipV,
        letterbox: setting.letterbox,
        durationInSeconds,
        transition: Array.isArray(perClipTransitions) ? (perClipTransitions[i] || 'none') : 'none',
      }
    })

    // Insert DB row FIRST so we have the renderId to pass to the render server
    const { data: renderRow, error: dbError } = await supabaseAdmin
      .from('renders')
      .insert({
        user_id: userId,
        shotstack_render_id: 'pending',
        status: 'queued',
        clip_paths: clipPaths,
        caption_style: null,
        idea_id: ideaId || null,
        title: ideaTitle || null,
        caption: ideaCaption || null,
        tags: ideaTags || null,
      })
      .select()
      .single()

    if (dbError) return NextResponse.json({ error: 'Failed to save render record' }, { status: 500 })

    // Calculate free plan quota
    let overQuota = false
    if (plan === 'free') {
      const { data: allRenders } = await supabaseAdmin.from('renders').select('duration_seconds').eq('user_id', userId)
      const totalUsed = (allRenders || []).reduce((sum: number, r: { duration_seconds: number | null }) => sum + (r.duration_seconds || 0), 0)
      overQuota = totalUsed >= 60
    }

    // Mark over_quota in DB so frontend can block download
    if (overQuota) {
      await supabaseAdmin.from('renders').update({ over_quota: true }).eq('id', renderRow.id)
    }

    // Call render server with the real renderId
    const renderServerUrl = process.env.RENDER_SERVER_URL!
    const renderRes = await fetch(`${renderServerUrl}/renders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.RENDER_SERVER_SECRET!,
      },
      body: JSON.stringify({
        clips,
        musicSrc: musicUrl || undefined,
        outputOrientation,
        resolution,
        cutDeadSpace: cutDeadSpace === true,
        captionStyle: captionStyle || null,
        userId,
        renderId: renderRow.id,
        watermark: plan === 'free',
      }),
    })

    if (!renderRes.ok) {
      const err = await renderRes.json()
      console.error('Render server error:', err)
      return NextResponse.json({ error: 'Render request failed' }, { status: 500 })
    }

    const { jobId } = await renderRes.json()

    // Update the row with the real job ID
    await supabaseAdmin
      .from('renders')
      .update({ shotstack_render_id: jobId })
      .eq('id', renderRow.id)

    return NextResponse.json({ renderId: renderRow.id, shotstackRenderId: jobId })
  } catch (error) {
    console.error('render-video error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Failed to start render' }, { status: 500 })
  }
}
