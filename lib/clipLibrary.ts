import { supabase } from '@/lib/supabase'
import { LIBRARY_LIMITS } from '@/lib/planLimits'

export type LibraryClip = {
  id: string
  name: string
  path: string
  size_bytes: number
  mime: string | null
  duration: number | null
  created_at: string
  album_id?: string | null
}

export type LibraryAlbum = { id: string; name: string; created_at: string }

export type LibraryPlan = 'free' | 'basic' | 'mid' | 'top'

const BUCKET = 'video-uploads'
export const MAX_LIBRARY_FILE_BYTES = LIBRARY_LIMITS.maxFileMb * 1024 * 1024

// How much each plan can keep in the library. 'mid' is the paid Basic plan; 'basic' and 'free' both mean no paid plan.
export function libraryLimitBytes(plan: LibraryPlan): number {
  const mb = plan === 'top' ? LIBRARY_LIMITS.top.storageMb : plan === 'mid' ? LIBRARY_LIMITS.basic.storageMb : LIBRARY_LIMITS.free.storageMb
  return mb * 1024 * 1024
}

// The most clips each plan can keep in the library
export function libraryMaxClips(plan: LibraryPlan): number {
  return plan === 'top' ? LIBRARY_LIMITS.top.maxClips : plan === 'mid' ? LIBRARY_LIMITS.basic.maxClips : LIBRARY_LIMITS.free.maxClips
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}

export const isVideoName = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(f.name)

// Sound files share the library with clips, but live in their own list
const AUDIO_EXT = /\.(mp3|m4a|wav|aac|ogg|oga|flac|opus|weba)$/i
export const isAudioFile = (f: { type?: string; name: string }) => (f.type || '').startsWith('audio/') || AUDIO_EXT.test(f.name)
export const isAudioClip = (c: LibraryClip) => (c.mime || '').startsWith('audio/') || AUDIO_EXT.test(c.name)

export async function listLibraryAll(): Promise<LibraryClip[]> {
  const { data, error } = await supabase.from('clip_library').select('*').order('created_at', { ascending: false })
  if (error || !data) return []
  return data as LibraryClip[]
}

// The video clips only
export async function listLibrary(): Promise<LibraryClip[]> {
  return (await listLibraryAll()).filter((c) => !isAudioClip(c))
}

export async function listAudioLibrary(): Promise<LibraryClip[]> {
  return (await listLibraryAll()).filter(isAudioClip)
}

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
  const out: Record<string, string> = {}
  ;(data || []).forEach((d) => { if (d.path && d.signedUrl) out[d.path] = d.signedUrl })
  return out
}

const videoLength = (file: File): Promise<number | null> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    const done = (n: number | null) => { URL.revokeObjectURL(url); resolve(n) }
    v.onloadedmetadata = () => done(isFinite(v.duration) ? Math.round(v.duration * 10) / 10 : null)
    v.onerror = () => done(null)
    setTimeout(() => done(null), 8000)
    v.src = url
  })

// Uploads a file and reports how far it has got (0 to 1). The Supabase library has no progress, so this sends the same request itself.
async function uploadWithProgress(path: string, file: File, onProgress: (fraction: number) => void): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!session?.access_token || !base || !anon) return false
  return new Promise<boolean>((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${base}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`)
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
    xhr.setRequestHeader('apikey', anon)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.setRequestHeader('cache-control', 'max-age=3600')
    if (file.type) xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total)) }
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
    xhr.onerror = () => resolve(false)
    xhr.onabort = () => resolve(false)
    xhr.send(file)
  })
}

// Saves a file to the library. Returns the new clip, or a plain-English reason it could not be saved.
export async function saveToLibrary(userId: string, file: File, usedBytes: number, limitBytes: number, albumId: string | null = null, usedCount = 0, maxCount = Infinity, onProgress?: (fraction: number) => void): Promise<{ clip?: LibraryClip; error?: string }> {
  if (!isVideoName(file) && !isAudioFile(file)) return { error: 'Only video or audio files can go in the library.' }
  if (file.size > MAX_LIBRARY_FILE_BYTES) return { error: 'That file is over 500 MB, which is too big for the library.' }
  if (usedCount >= maxCount) return { error: `Your library is full (${maxCount} clips). Delete a clip or upgrade your plan to add more.` }
  if (usedBytes + file.size > limitBytes) return { error: `Not enough library space. You have ${formatBytes(Math.max(0, limitBytes - usedBytes))} left.` }
  const safe = file.name.replace(/[^\w.-]+/g, '_')
  const path = `${userId}/library/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`
  const ok = onProgress
    ? await uploadWithProgress(path, file, onProgress)
    : !(await supabase.storage.from(BUCKET).upload(path, file, file.type ? { contentType: file.type } : undefined)).error
  if (!ok) return { error: 'The upload did not finish. Please try again.' }
  const duration = await videoLength(file)
  const { data, error } = await supabase.from('clip_library').insert({ user_id: userId, name: file.name, path, size_bytes: file.size, mime: file.type || null, duration, ...(albumId ? { album_id: albumId } : {}) }).select('*').single()
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path])
    return { error: error?.message && /library/i.test(error.message) ? error.message : 'Could not save the clip to your library. Please try again.' }
  }
  return { clip: data as LibraryClip }
}

// Saves a sound file to the library, unless the same file is already there
export async function saveAudioToLibrary(userId: string, file: File, plan: LibraryPlan): Promise<{ clip?: LibraryClip; error?: string; existed?: boolean }> {
  const all = await listLibraryAll()
  const dupe = all.find((c) => isAudioClip(c) && c.name === file.name && c.size_bytes === file.size)
  if (dupe) return { clip: dupe, existed: true }
  const used = all.reduce((n, c) => n + (c.size_bytes || 0), 0)
  return saveToLibrary(userId, file, used, libraryLimitBytes(plan), null, all.length, libraryMaxClips(plan))
}

export async function deleteFromLibrary(clip: LibraryClip): Promise<boolean> {
  const { error } = await supabase.from('clip_library').delete().eq('id', clip.id)
  if (error) return false
  await supabase.storage.from(BUCKET).remove([clip.path])
  return true
}

export async function renameInLibrary(id: string, name: string): Promise<boolean> {
  const { error } = await supabase.from('clip_library').update({ name }).eq('id', id)
  return !error
}

// Brings a library clip back as a normal file, so the editors treat it like any clip the person just chose
export async function libraryClipToFile(clip: LibraryClip): Promise<File | null> {
  return (await libraryClipToFileDetailed(clip)).file || null
}

// Reads a file in small pieces, the same way a video player does. Some connections drop a single big download but handle pieces fine.
async function fetchInPieces(url: string, total: number): Promise<Blob> {
  const PIECE = 6 * 1024 * 1024
  const AT_ONCE = 6
  if (!total || total <= PIECE) {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`status ${res.status}`)
    return await res.blob()
  }
  const count = Math.ceil(total / PIECE)
  const parts: Blob[] = new Array(count)
  const getPiece = async (i: number): Promise<Blob | 'stored'> => {
    const start = i * PIECE
    const end = Math.min(start + PIECE, total) - 1
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url, { cache: 'no-store', headers: { Range: `bytes=${start}-${end}` } })
        if (res.status === 200) return await res.blob() // the server sent the whole file at once
        if (res.status !== 206) throw new Error(`status ${res.status}`)
        parts[i] = await res.blob()
        return 'stored' as const
      } catch (e) {
        if (attempt === 2) throw e
      }
    }
  }
  // The first piece goes alone, to learn whether the server hands out pieces at all
  const first = await getPiece(0)
  if (first !== 'stored') return first
  let next = 1
  let whole: Blob | null = null
  const worker = async () => {
    while (next < count && !whole) {
      const r = await getPiece(next++)
      if (r !== 'stored') whole = r
    }
  }
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, count - 1) }, worker))
  return whole ?? new Blob(parts)
}

// Same, but says why it failed so the screen can show something useful
export async function libraryClipToFileDetailed(clip: LibraryClip): Promise<{ file?: File; error?: string }> {
  const make = (blob: Blob) => new File([blob], clip.name, { type: clip.mime || blob.type || 'video/mp4' })
  const why: string[] = []
  const urls = await signedUrls([clip.path]).catch(() => ({} as Record<string, string>))
  const url = urls[clip.path]
  if (!url) why.push('no link')
  else {
    // First through our own address (see next.config.js), then straight from storage
    const local = url.replace(/^https?:\/\/[^/]+\/storage\/v1\//, '/sb-storage/')
    for (const [label, u] of [['site', local], ['direct', url]] as const) {
      try {
        return { file: make(await fetchInPieces(u, clip.size_bytes)) }
      } catch (e) {
        why.push(`${label}: ${e instanceof Error ? e.message : 'failed'}`)
      }
    }
  }
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(clip.path)
    if (data) return { file: make(data) }
    why.push(`download: ${error?.message || 'failed'}`)
  } catch (e) {
    why.push(`download: ${e instanceof Error ? e.message : 'failed'}`)
  }
  return { error: why.join(', ') }
}

export async function listAlbums(): Promise<LibraryAlbum[]> {
  const { data, error } = await supabase.from('clip_albums').select('*').order('created_at', { ascending: true })
  if (error || !data) return []
  return data as LibraryAlbum[]
}

export async function createAlbum(userId: string, name: string): Promise<LibraryAlbum | null> {
  const { data, error } = await supabase.from('clip_albums').insert({ user_id: userId, name }).select('*').single()
  return error || !data ? null : (data as LibraryAlbum)
}

export async function renameAlbum(id: string, name: string): Promise<boolean> {
  const { error } = await supabase.from('clip_albums').update({ name }).eq('id', id)
  return !error
}

// The clips in a deleted album are kept and go back to "No album"
export async function deleteAlbum(id: string): Promise<boolean> {
  const { error } = await supabase.from('clip_albums').delete().eq('id', id)
  return !error
}

export async function moveToAlbum(clipId: string, albumId: string | null): Promise<boolean> {
  const { error } = await supabase.from('clip_library').update({ album_id: albumId }).eq('id', clipId)
  return !error
}
