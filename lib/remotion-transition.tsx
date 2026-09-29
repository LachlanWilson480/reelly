import React from 'react'
import { AbsoluteFill, useFrame, interpolate, Easing } from 'remotion'

type TransitionType =
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'blur'
  | 'dissolve'

type RemotionTransitionProps = {
  type: TransitionType
  duration: number
  direction: 'in' | 'out'
}

export const RemotionTransition: React.FC<RemotionTransitionProps> = ({
  type,
  duration,
  direction,
}) => {
  const [opacity, setOpacity] = React.useState(direction === 'in' ? 0 : 1)
  const [transform, setTransform] = React.useState('translate(0, 0) scale(1)')

  useFrame((info) => {
    const totalFrames = duration * info.fps
    const progress = Math.min(info.frame / totalFrames, 1)
    const p = direction === 'out' ? 1 - progress : progress

    switch (type) {
      case 'fade':
        setOpacity(p)
        break
      case 'slide-left':
        setOpacity(p)
        setTransform(`translate(${interpolate(p, [0, 1], [100, 0])}%, 0)`)
        break
      case 'slide-right':
        setOpacity(p)
        setTransform(`translate(${interpolate(p, [0, 1], [-100, 0])}%, 0)`)
        break
      case 'slide-up':
        setOpacity(p)
        setTransform(`translate(0, ${interpolate(p, [0, 1], [100, 0])}%)`)
        break
      case 'slide-down':
        setOpacity(p)
        setTransform(`translate(0, ${interpolate(p, [0, 1], [-100, 0])}%)`)
        break
      case 'zoom-in':
        setOpacity(p)
        setTransform(`scale(${interpolate(p, [0, 1], [0.5, 1])})`)
        break
      case 'zoom-out':
        setOpacity(p)
        setTransform(`scale(${interpolate(p, [0, 1], [1.5, 1])})`)
        break
      case 'blur':
        setOpacity(1)
        const blurAmount = interpolate(p, [0, 1], [20, 0])
        setTransform(`blur(${blurAmount}px)`)
        break
      case 'dissolve':
        setOpacity(p)
        break
    }
  })

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform,
        backgroundColor: 'rgba(0,0,0,0.1)',
        pointerEvents: 'none',
      }}
    />
  )
}
