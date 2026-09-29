import React from 'react'
import {
  AbsoluteFill,
  Sequence,
  useVideoConfig,
  Img,
  Audio,
} from 'remotion'
import { RemotionCaption } from './remotion-caption'
import { RemotionTransition } from './remotion-transition'

export type CompositionProps = {
  clips: Array<{
    url: string
    duration: number
    trimStart: number
    trimLength: number
    muted: boolean
    volume: number
    fit: 'crop' | 'cover' | 'contain'
    position: string
    speed: number
    filter: string
    rotate: number
    flipH: boolean
    flipV: boolean
    letterbox: boolean
  }>
  transition: string
  musicUrl: string | null
  captionStyle: {
    preset: string
    custom?: {
      font?: {
        family?: string
        size?: number
        color?: string
      }
      position?: 'top' | 'bottom' | 'center'
    }
  } | null
  speechClipIndices: number[]
  resolution: 'high' | 'low'
  outputOrientation: 'portrait' | 'landscape'
}

export const RemotionComposition: React.FC<CompositionProps> = ({
  clips,
  transition,
  musicUrl,
  captionStyle,
  speechClipIndices,
  resolution,
  outputOrientation,
}) => {
  const { width, height, fps } = useVideoConfig()

  let cumulativeTime = 0
  const clipTimings = clips.map((clip) => {
    const duration = clip.trimLength > 0 ? clip.trimLength : Math.max(0.1, clip.duration - clip.trimStart)
    const start = cumulativeTime
    cumulativeTime += duration
    return { start, duration }
  })

  const CSS_FILTER_MAP: Record<string, string> = {
    none: 'none',
    boost: 'contrast(1.2) saturate(1.4)',
    contrast: 'contrast(1.4)',
    darken: 'brightness(0.7)',
    lighten: 'brightness(1.3)',
    greyscale: 'grayscale(1)',
    muted: 'saturate(0.4) contrast(0.9)',
    negative: 'invert(1)',
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {clips.map((clip, i) => {
        const timing = clipTimings[i]
        const isSpeechClip = speechClipIndices.includes(i)

        let objectPosition = 'center'
        if (clip.position === 'top-left') objectPosition = '0% 0%'
        else if (clip.position === 'top-center') objectPosition = '50% 0%'
        else if (clip.position === 'top-right') objectPosition = '100% 0%'
        else if (clip.position === 'center-left') objectPosition = '0% 50%'
        else if (clip.position === 'center-right') objectPosition = '100% 50%'
        else if (clip.position === 'bottom-left') objectPosition = '0% 100%'
        else if (clip.position === 'bottom-center') objectPosition = '50% 100%'
        else if (clip.position === 'bottom-right') objectPosition = '100% 100%'

        return (
          <Sequence key={i} from={timing.start * fps} durationInFrames={Math.ceil(timing.duration * fps)}>
            {clip.letterbox && (
              <AbsoluteFill
                style={{
                  filter: CSS_FILTER_MAP[clip.filter] || 'none',
                }}
              >
                <video
                  src={clip.url}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'crop',
                    objectPosition,
                    opacity: 0.3,
                    filter: 'blur(20px)',
                  }}
                  crossOrigin="anonymous"
                />
              </AbsoluteFill>
            )}

            <AbsoluteFill
              style={{
                transform: `rotate(${clip.rotate}deg) ${clip.flipH ? 'scaleX(-1)' : ''} ${clip.flipV ? 'scaleY(-1)' : ''}`,
                filter: CSS_FILTER_MAP[clip.filter] || 'none',
              }}
            >
              <video
                src={clip.url}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: clip.fit,
                  objectPosition,
                  opacity: 1,
                }}
                muted={clip.muted}
                volume={clip.volume}
                crossOrigin="anonymous"
              />
            </AbsoluteFill>

            {i > 0 && transition && transition !== 'none' && (
              <RemotionTransition
                type={transition}
                duration={0.3}
                direction="in"
              />
            )}
          </Sequence>
        )
      })}

      {captionStyle && speechClipIndices.length > 0 && (
        <AbsoluteFill>
          {speechClipIndices.map((clipIndex) => {
            const timing = clipTimings[clipIndex]
            if (!timing) return null

            return (
              <Sequence
                key={`caption-${clipIndex}`}
                from={timing.start * fps}
                durationInFrames={Math.ceil(timing.duration * fps)}
              >
                <RemotionCaption
                  style={captionStyle}
                  width={width}
                  height={height}
                />
              </Sequence>
            )
          })}
        </AbsoluteFill>
      )}

      {musicUrl && (
        <Audio src={musicUrl} volume={0.6} startFrom={0} />
      )}
    </AbsoluteFill>
  )
}
