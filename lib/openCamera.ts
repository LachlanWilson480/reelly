// Opens the camera and checks the picture really is the shape that was asked for.
// Some phones hand back a wide (landscape) picture even when the phone is held upright. Fitting that wide picture into
// a tall box crops away most of the sides, which looks like the camera is zoomed in and is also low quality.
// So if the shape is wrong, try other ways of asking until the shape is right, then fall back to the camera's own default.
type Size = { width?: { ideal?: number }; height?: { ideal?: number }; frameRate?: { ideal?: number } }

const shapeOk = (stream: MediaStream, landscape: boolean) => {
  const st = stream.getVideoTracks()[0]?.getSettings?.()
  if (!st || !st.width || !st.height) return true
  return (st.width > st.height) === landscape
}

export async function openCameraStream(cam: MediaTrackConstraints, landscape: boolean, size: Size): Promise<MediaStream> {
  const w = size.width?.ideal || 1080
  const h = size.height?.ideal || 1920
  const fps = size.frameRate?.ideal || 30
  const shortSide = Math.min(w, h)
  const longSide = Math.max(w, h)
  const tries: MediaTrackConstraints[] = [
    { ...cam, width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: fps } },
    // Same shape, but fixed instead of preferred
    { ...cam, width: { exact: w }, height: { exact: h } },
    // Sizes given the other way round, which some phones read as the camera's own sideways shape
    { ...cam, width: { ideal: h }, height: { ideal: w }, frameRate: { ideal: fps } },
    // Ask for the shape only
    { ...cam, aspectRatio: { ideal: landscape ? longSide / shortSide : shortSide / longSide } },
  ]
  let first: MediaStream | null = null
  for (const video of tries) {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: true })
    } catch (err) {
      if (!first && video === tries[0]) throw err
      continue
    }
    if (shapeOk(stream, landscape)) {
      first?.getTracks().forEach((t) => t.stop())
      return stream
    }
    if (!first) first = stream
    else stream.getTracks().forEach((t) => t.stop())
  }
  // Nothing gave the right shape, so use the first picture as it is
  if (first) return first
  return navigator.mediaDevices.getUserMedia({ video: cam, audio: true })
}
