// Turns one photo into a short silent video clip, so a photo can sit in the timeline like any filmed clip.
// The photo fills the frame (centre-cropped to 9:16 or 16:9) and drifts in slowly so it does not look frozen.

const MIMES = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

export type PhotoClip = { blob: Blob; ext: string; type: string }

export async function photoToClip(file: File, landscape: boolean, seconds = 3): Promise<PhotoClip> {
  if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot turn photos into clips.')
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new Error('That photo could not be opened. Try a JPG or PNG.')

  const outW = landscape ? 1920 : 1080
  const outH = landscape ? 1080 : 1920
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) { bitmap.close(); throw new Error('Could not prepare the photo.') }

  // "Cover" fit: scale so the photo fills the frame, then crop the overflow equally on both sides.
  const cover = Math.max(outW / bitmap.width, outH / bitmap.height)
  const drawPhoto = (zoom: number) => {
    const w = bitmap.width * cover * zoom
    const h = bitmap.height * cover * zoom
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, outW, outH)
    ctx.drawImage(bitmap, (outW - w) / 2, (outH - h) / 2, w, h)
  }
  drawPhoto(1)

  const stream = canvas.captureStream(30)
  const mimeType = MIMES.find((m) => MediaRecorder.isTypeSupported(m)) || ''
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 }) : new MediaRecorder(stream, { videoBitsPerSecond: 8_000_000 })
  const type = (recorder.mimeType || mimeType || 'video/webm').split(';')[0]
  const ext = type.includes('mp4') ? 'mp4' : 'webm'
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type }))
    recorder.onerror = () => reject(new Error('The photo could not be turned into a clip.'))
  })

  recorder.start(250)
  const startedAt = performance.now()
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - startedAt) / 1000
      drawPhoto(1 + 0.08 * Math.min(1, t / seconds))
      if (t >= seconds) resolve()
      else requestAnimationFrame(tick)
    }
    tick()
  })
  recorder.stop()
  const blob = await done
  stream.getVideoTracks().forEach((t) => t.stop())
  bitmap.close()
  if (blob.size === 0) throw new Error('The photo could not be turned into a clip.')
  return { blob, ext, type }
}
