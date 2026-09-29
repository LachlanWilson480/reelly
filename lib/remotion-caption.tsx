import React, { useMemo } from 'react'
import { useFrame, interpolate, Easing, AbsoluteFill } from 'remotion'

type CaptionStyle = {
  preset: string
  custom?: {
    font?: {
      family?: string
      size?: number
      color?: string
    }
    position?: 'top' | 'bottom' | 'center'
  }
}

type RemotionCaptionProps = {
  style: CaptionStyle
  width: number
  height: number
}

const CAPTION_PRESETS: Record<
  string,
  {
    font: { family: string; size: number; color: string; weight: number }
    animation: { style: string }
    stroke?: { width: number; color: string; opacity: number }
    position: 'top' | 'bottom' | 'center'
  }
> = {
  bold_center: {
    font: { family: 'Montserrat', size: 48, color: '#FFFFFF', weight: 700 },
    animation: { style: 'pop' },
    stroke: { width: 2, color: '#000000', opacity: 1 },
    position: 'bottom',
  },
  minimal_bottom: {
    font: { family: 'Inter', size: 32, color: '#FFFFFF', weight: 500 },
    animation: { style: 'fade' },
    position: 'bottom',
  },
  coral_pop: {
    font: { family: 'Montserrat', size: 44, color: '#F1EFE8', weight: 700 },
    animation: { style: 'bounce' },
    stroke: { width: 2, color: '#D85A30', opacity: 1 },
    position: 'center',
  },
  word_by_word: {
    font: { family: 'Montserrat', size: 56, color: '#FFFFFF', weight: 700 },
    animation: { style: 'karaoke' },
    stroke: { width: 3, color: '#000000', opacity: 1 },
    position: 'bottom',
  },
  typewriter: {
    font: { family: 'Inter', size: 40, color: '#FFFFFF', weight: 600 },
    animation: { style: 'typewriter' },
    position: 'bottom',
  },
}

export const RemotionCaption: React.FC<RemotionCaptionProps> = ({
  style,
  width,
  height,
}) => {
  const presetKey = style.preset || 'bold_center'
  const preset = CAPTION_PRESETS[presetKey] || CAPTION_PRESETS.bold_center

  const fontFamily = style.custom?.font?.family || preset.font.family
  const fontSize = style.custom?.font?.size || preset.font.size
  const fontColor = style.custom?.font?.color || preset.font.color
  const position = style.custom?.position || preset.position

  const animationStyle = preset.animation.style

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <CaptionText
        text="[AI-generated caption]"
        fontFamily={fontFamily}
        fontSize={fontSize}
        fontColor={fontColor}
        stroke={preset.stroke}
        animationStyle={animationStyle}
        position={position}
        width={width}
        height={height}
      />
    </AbsoluteFill>
  )
}

type CaptionTextProps = {
  text: string
  fontFamily: string
  fontSize: number
  fontColor: string
  stroke?: { width: number; color: string; opacity: number }
  animationStyle: string
  position: 'top' | 'bottom' | 'center'
  width: number
  height: number
}

const CaptionText: React.FC<CaptionTextProps> = ({
  text,
  fontFamily,
  fontSize,
  fontColor,
  stroke,
  animationStyle,
  position,
  width,
  height,
}) => {
  const [scale, setScale] = React.useState(1)
  const [opacity, setOpacity] = React.useState(1)

  useFrame((info) => {
    const progress = info.frame / (info.fps * 0.5)
    const clamped = Math.min(progress, 1)

    switch (animationStyle) {
      case 'pop':
        setScale(interpolate(clamped, [0, 1], [0.8, 1], { easing: Easing.out(Easing.elastic(1)) }))
        setOpacity(interpolate(clamped, [0, 1], [0, 1]))
        break
      case 'fade':
        setOpacity(interpolate(clamped, [0, 1], [0, 1]))
        break
      case 'bounce':
        setScale(interpolate(clamped, [0, 0.5, 1], [0.8, 1.1, 1], { easing: Easing.out(Easing.elastic(1)) }))
        setOpacity(interpolate(clamped, [0, 1], [0, 1]))
        break
      case 'typewriter':
        setOpacity(interpolate(clamped, [0, 1], [0, 1]))
        break
      case 'karaoke':
        setOpacity(1)
        break
      default:
        break
    }
  })

  const verticalPosition = position === 'top' ? '10%' : position === 'center' ? '50%' : '80%'

  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        top: verticalPosition,
        left: '50%',
        transform: `translateX(-50%) translateY(-50%) scale(${scale})`,
        opacity,
        textAlign: 'center',
        fontFamily,
        fontSize,
        fontWeight: 700,
        color: fontColor,
        textShadow: stroke
          ? `${stroke.width}px ${stroke.width}px 0 ${stroke.color}`
          : 'none',
        padding: '0 20px',
        maxWidth: '90%',
        lineHeight: '1.2',
      }}
    >
      {text}
    </div>
  )
}
