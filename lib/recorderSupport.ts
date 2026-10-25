// Shared helpers for recording video with MediaRecorder, tuned for iPhone Safari and home-screen apps.

const MIMES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']

// The first format this browser can record that has not already produced an empty file.
// Returns '' to let the browser choose its own format once every option has been tried.
export function pickRecorderMime(skip: Set<string>): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return MIMES.find((t) => !skip.has(t) && MediaRecorder.isTypeSupported(t)) || ''
}

export function streamIsLive(stream: MediaStream | null): boolean {
  if (!stream) return false
  const tracks = stream.getTracks()
  return tracks.length > 0 && tracks.every((t) => t.readyState === 'live')
}

// Safari is far more reliable when an mp4 recording is delivered in one piece when it stops
export function beginRecorder(recorder: MediaRecorder, mime: string) {
  if (mime.includes('mp4')) recorder.start()
  else recorder.start(1000)
}

// Ask for the last data before stopping so the final seconds are never lost
export function finishRecorder(recorder: MediaRecorder) {
  if (recorder.state === 'recording') {
    try { recorder.requestData() } catch {}
  }
  if (recorder.state !== 'inactive') recorder.stop()
}
