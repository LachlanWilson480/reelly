// True only for a storage path inside this person's own folder, e.g. "<userId>/film/clip.mp4".
// Blocks tricks like "<userId>/../someone-else/video.mp4", backslashes and absurdly long paths.
export function isOwnPath(path: unknown, userId: string): path is string {
  if (typeof path !== 'string' || path.length > 512) return false
  if (!path.startsWith(`${userId}/`)) return false
  if (path.includes('..') || path.includes('\\') || path.includes('//')) return false
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(path)) return false
  return true
}
