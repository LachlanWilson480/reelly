import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type CaptionPreset = {
  font: Record<string, unknown>
  animation: Record<string, unknown>
  active?: Record<string, unknown>
  stroke?: Record<string, unknown>
  clipWidth: number
  clipHeight: number
}

const PRESETS: Record<string, CaptionPreset> = {
  bold_center: {
    font: { family: 'Montserrat ExtraBold', size: 36, color: '#FFFFFF', weight: 700 },
    animation: { style: 'pop' },
    active: { font: { color: '#D85A30' } },
    stroke: { width: 2, color: '#000000', opacity: 1 },
    clipWidth: 640,
    clipHeight: 200,
  },
  minimal_bottom: {
    font: { family: 'Inter', size: 26, color: '#FFFFFF', weight: 500 },
    animation: { style: 'fade' },
    clipWidth: 560,
    clipHeight: 160,
  },
  coral_pop: {
    font: { family: 'Montserrat ExtraBold', size: 34, color: '#F1EFE8', weight: 700 },
    animation: { style: 'bounce' },
    active: { font: { color: '#D85A30' } },
    clipWidth: 620,
    clipHeight: 180,
  },
  word_by_word: {
    font: { family: 'Montserrat ExtraBold', size: 44, color: '#FFFFFF', weight: 700 },
    animation: { style: 'karaoke' },
    active: { font: { color: '#D85A30' } },
    stroke: { width: 3, color: '#000000', opacity: 1 },
    clipWidth: 600,
    clipHeight: 220,
  },
  typewriter: {
    font: { family: 'Inter', size: 32, color: '#FFFFFF', weight: 600 },
    animation: { style: 'typewriter' },
    clipWidth: 600,
    clipHeight: 200,
  },
}

type ClipTrim = { trimStart?: number; trimLength?: number; duration?: number }
type ClipSetting = { muted?: boolean; volume?: number; fit?: 'crop' | 'cover' | 'contain'; position?: string; speed?: number; filter?: string; rotate?: number; flipH?: boolean; flipV?: boolean; letterbox?: boolean }

export async function POST(req: NextRequest) {
  try {
    const { userId, clipPaths, captionStyle, musicPath, speechClipIndex, speechClipIndices, clipTrims, clipSettings, outputOrientation } = await req.json()

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

    let musicUrl: string | null = null
    if (musicPath) {
      const { data, error } = await supabaseAdmin.storage
        .from('video-uploads')
        .createSignedUrl(musicPath, 3600)

      if (!error && data) {
        musicUrl = data.signedUrl
      }
    }

    const rawIndices: number[] = Array.isArray(speechClipIndices)
      ? speechClipIndices
      : typeof speechClipIndex === 'number'
      ? [speechClipIndex]
      : []
    const speechIndexSet = new Set(rawIndices.filter((i) => i >= 0 && i < signedUrls.length))

    const trims: ClipTrim[] = Array.isArray(clipTrims) ? clipTrims : []
    const settings: ClipSetting[] = Array.isArray(clipSettings) ? clipSettings : []

    // Compute each clip's real effective length up front: trimLength if explicitly set,
    // otherwise the actual measured source duration minus any trim start, otherwise a safe fallback.
    // This same number drives BOTH the video track's explicit start time AND the caption track's
    // start time, so they can never drift out of sync with each other.
    const effectiveLengths = signedUrls.map((_, i) => {
      const trim = trims[i] || {}
      if (typeof trim.trimLength === 'number' && trim.trimLength > 0) {
        return trim.trimLength
      }
      if (typeof trim.duration === 'number' && trim.duration > 0) {
        return Math.max(0.1, trim.duration - (trim.trimStart || 0))
      }
      return 5
    })

    let cumulativeTime = 0
    const clipStartTimes: number[] = effectiveLengths.map((len) => {
      const start = cumulativeTime
      cumulativeTime += len
      return start
    })

    const captionEntries: { start: number; length: number; alias: string }[] = []

    const backgroundClips: Record<string, unknown>[] = []
    const clips = signedUrls.map((url, i) => {
      const trim = trims[i] || {}
      const setting = settings[i] || {}
      const isSpeechClip = speechIndexSet.has(i)
      const alias = isSpeechClip ? `speech-${i}` : undefined

      const videoAsset: Record<string, unknown> = { type: 'video', src: url }

      if (typeof trim.trimStart === 'number' && trim.trimStart > 0) {
        videoAsset.trim = trim.trimStart
      }

      videoAsset.volume = setting.muted ? 0 : typeof setting.volume === 'number' ? setting.volume : 1

      if (typeof setting.speed === 'number' && setting.speed !== 1) {
        videoAsset.speed = setting.speed
      }

      const clipEntry: Record<string, unknown> = {
        asset: videoAsset,
        alias,
        start: clipStartTimes[i],
        length: effectiveLengths[i],
        transition: i > 0 ? { in: 'fade' } : undefined,
      }

      if (setting.letterbox) {
        clipEntry.fit = "contain"
        backgroundClips.push({
          asset: { type: "video", src: url, ...(typeof trim.trimStart === "number" && trim.trimStart > 0 ? { trim: trim.trimStart } : {}), volume: 0 },
          start: clipStartTimes[i],
          length: effectiveLengths[i],
          fit: "crop",
          filter: "blur",
        })
      } else if (setting.fit) {
        clipEntry.fit = setting.fit
      }
      if (setting.filter && setting.filter !== 'none') {
        clipEntry.filter = setting.filter
      }

      const transform: Record<string, unknown> = {}
      if (typeof setting.rotate === 'number' && setting.rotate !== 0) {
        transform.rotate = { angle: setting.rotate }
      }
      if (setting.flipH) {
        transform.flip = { horizontal: true }
      }
      if (setting.flipV) {
        transform.flip = { ...(transform.flip as Record<string, unknown> || {}), vertical: true }
      }
      if (Object.keys(transform).length > 0) {
        clipEntry.transform = transform
      }
      if (setting.position) {
        clipEntry.position = setting.position
      }

      if (isSpeechClip && alias) {
        captionEntries.push({ start: clipStartTimes[i], length: effectiveLengths[i], alias })
      }

      return clipEntry
    })

    const tracks: Record<string, unknown>[] = []

    if (captionEntries.length > 0) {
      const presetKey = typeof captionStyle === 'string' ? captionStyle : captionStyle?.preset
      const preset = PRESETS[presetKey] || PRESETS.bold_center

      const customFont = typeof captionStyle === 'object' ? captionStyle?.custom?.font : undefined
      const customPosition = typeof captionStyle === 'object' ? captionStyle?.custom?.position : undefined

      const font = { ...preset.font, ...customFont }
      const verticalAlign = customPosition || 'bottom'

      const captionClips = captionEntries.map((entry) => {
        const captionAsset: Record<string, unknown> = {
          type: 'rich-caption',
          src: `alias://${entry.alias}`,
          font,
          animation: preset.animation,
          align: { vertical: verticalAlign, horizontal: 'center' },
        }
        if (preset.active) captionAsset.active = preset.active
        if (preset.stroke) captionAsset.stroke = preset.stroke

        return {
          asset: captionAsset,
          start: entry.start,
          length: entry.length,
          width: preset.clipWidth,
          height: preset.clipHeight,
        }
      })

      tracks.push({ clips: captionClips })
    }

    tracks.push({ clips })

    if (backgroundClips.length > 0) {
      tracks.push({ clips: backgroundClips })
    }
    if (musicUrl) {
      tracks.push({
        clips: [
          {
            asset: { type: 'audio', src: musicUrl, volume: 0.6, effect: 'fadeInFadeOut' },
            start: 0,
            length: 'end',
          },
        ],
      })
    }

    const timeline = { tracks }

    const edit = {
      timeline,
      output: { format: 'mp4', size: outputOrientation === 'landscape' ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 } },
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
      console.error('Shotstack error:', JSON.stringify(shotstackData, null, 2))
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
        caption_style: captionStyle || null,
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
