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
  for (const video of tries) {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: true })
    } catch (err) {
      if (video === tries[0]) throw err
      continue
    }
    if (shapeOk(stream, landscape)) return stream
    // Close it before asking again. Phones end an open camera as soon as another request starts.
    stream.getTracks().forEach((t) => t.stop())
  }
  // Nothing gave the right shape, so ask the original way once more and use whatever comes back
  return navigator.mediaDevices.getUserMedia({ video: { ...cam, width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: fps } }, audio: true })
}

// True on phones and tablets. There the camera's own full picture is shown and recorded as it comes, with no cropping.
export const isTouchDevice = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches
