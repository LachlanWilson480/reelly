import { Aws } from '@remotion/lambda'

export const initializeRemotionLambda = async () => {
  const region = process.env.AWS_REGION || 'us-east-1'

  Aws.setPublicBucket(process.env.REMOTION_BUCKET_NAME || 'reelezy-remotion-renders')

  Aws.setRegion(region)
}

export const renderVideoWithLambda = async (params: {
  videoUrl: string
  compositionId: string
  props: Record<string, unknown>
  width: number
  height: number
  fps: number
  durationInSeconds: number
}) => {
  try {
    const response = await Aws.renderMediaOnLambda({
      region: process.env.AWS_REGION || 'us-east-1',
      functionName: process.env.REMOTION_LAMBDA_FUNCTION || 'remotion-render',
      composition: params.compositionId,
      inputProps: params.props,
      serveUrl: 'https://remotion.dev/api/serve',
      codec: 'h264',
      audioCodec: 'aac',
      imageFormat: 'png',
      maxRetries: 3,
      privacy: 'public',
      webhook: process.env.REMOTION_WEBHOOK_URL || undefined,
    })

    return response
  } catch (error) {
    console.error('Remotion Lambda render error:', error)
    throw error
  }
}

export const getRenderStatusFromLambda = async (renderId: string) => {
  try {
    const response = await Aws.getRenderProgress({
      region: process.env.AWS_REGION || 'us-east-1',
      functionName: process.env.REMOTION_LAMBDA_FUNCTION || 'remotion-render',
      renderId,
    })

    return response
  } catch (error) {
    console.error('Get render status error:', error)
    throw error
  }
}

export const buildCompositionProps = (editorState: {
  clipPaths: string[]
  signedUrls: string[]
  clipTrims: Array<{ trimStart?: number; trimLength?: number; duration?: number }>
  clipSettings: Array<{
    muted?: boolean
    volume?: number
    fit?: 'crop' | 'cover' | 'contain'
    position?: string
    speed?: number
    filter?: string
    rotate?: number
    flipH?: boolean
    flipV?: boolean
    letterbox?: boolean
  }>
  transition: string
  musicUrl: string | null
  captionStyle: unknown
  speechClipIndices: number[]
  resolution: 'high' | 'low'
  outputOrientation: 'landscape' | 'portrait'
}) => {
  const effectiveLengths = editorState.signedUrls.map((_, i) => {
    const trim = editorState.clipTrims[i] || {}
    if (typeof trim.trimLength === 'number' && trim.trimLength > 0) {
      return trim.trimLength
    }
    if (typeof trim.duration === 'number' && trim.duration > 0) {
      return Math.max(0.1, trim.duration - (trim.trimStart || 0))
    }
    return 5
  })

  const clips = editorState.signedUrls.map((url, i) => {
    const trim = editorState.clipTrims[i] || {}
    const settings = editorState.clipSettings[i] || {}

    return {
      url,
      duration: effectiveLengths[i],
      trimStart: trim.trimStart || 0,
      trimLength: trim.trimLength || 0,
      muted: settings.muted || false,
      volume: typeof settings.volume === 'number' ? settings.volume : 1,
      fit: (settings.fit || 'crop') as 'crop' | 'cover' | 'contain',
      position: settings.position || 'center',
      speed: typeof settings.speed === 'number' ? settings.speed : 1,
      filter: settings.filter || 'none',
      rotate: typeof settings.rotate === 'number' ? settings.rotate : 0,
      flipH: settings.flipH || false,
      flipV: settings.flipV || false,
      letterbox: settings.letterbox || false,
    }
  })

  return {
    clips,
    transition: editorState.transition || 'fade',
    musicUrl: editorState.musicUrl || null,
    captionStyle: editorState.captionStyle || null,
    speechClipIndices: editorState.speechClipIndices || [],
    resolution: editorState.resolution || 'high',
    outputOrientation: editorState.outputOrientation || 'landscape',
  }
}

export const getOutputDimensions = (resolution: 'high' | 'low', orientation: 'landscape' | 'portrait') => {
  if (orientation === 'landscape') {
    return resolution === 'high'
      ? { width: 1920, height: 1080, fps: 30 }
      : { width: 960, height: 540, fps: 24 }
  }

  return resolution === 'high'
    ? { width: 1080, height: 1920, fps: 30 }
    : { width: 540, height: 960, fps: 24 }
}
