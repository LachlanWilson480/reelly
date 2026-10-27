import { supabase } from '@/lib/supabase'
import { PLAN_LIMITS } from '@/lib/planLimits'

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
export const MAX_LIBRARY_FILE_BYTES = 500 * 1024 * 1024

// How much each plan can keep in the library. 'mid' is the paid Basic plan; 'basic' and 'free' both mean no paid plan.
export function libraryLimitBytes(plan: LibraryPlan): number {
  const mb = plan === 'top' ? PLAN_LIMITS.top.storageMb : plan === 'mid' ? PLAN_LIMITS.basic.storageMb : 500
  return mb * 1024 * 1024
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}

export const isVideoName = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(f.name)

export async function listLibrary(): Promise<LibraryClip[]> {
  const { data, error } = await supabase.from('clip_library').select('*').order('created_at', { ascending: false })
  if (error || !data) return []
  return data as LibraryClip[]
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

// Saves a file to the library. Returns the new clip, or a plain-English reason it could not be saved.
export async function saveToLibrary(userId: string, file: File, usedBytes: number, limitBytes: number, albumId: string | null = null): Promise<{ clip?: LibraryClip; error?: string }> {
  if (!isVideoName(file)) return { error: 'Only video files can go in the library.' }
  if (file.size > MAX_LIBRARY_FILE_BYTES) return { error: 'That clip is over 500 MB, which is too big for the library.' }
  if (usedBytes + file.size > limitBytes) return { error: `Not enough library space. You have ${formatBytes(Math.max(0, limitBytes - usedBytes))} left.` }
  const safe = file.name.replace(/[^\w.-]+/g, '_')
  const path = `${userId}/library/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`
  const up = await supabase.storage.from(BUCKET).upload(path, file, file.type ? { contentType: file.type } : undefined)
  if (up.error) return { error: 'The upload did not finish. Please try again.' }
  const duration = await videoLength(file)
  const { data, error } = await supabase.from('clip_library').insert({ user_id: userId, name: file.name, path, size_bytes: file.size, mime: file.type || null, duration, ...(albumId ? { album_id: albumId } : {}) }).select('*').single()
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path])
    return { error: 'Could not save the clip to your library. Please try again.' }
  }
  return { clip: data as LibraryClip }
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
  const PIECE = 4 * 1024 * 1024
  if (!total || total <= PIECE) {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`status ${res.status}`)
    return await res.blob()
  }
  const parts: Blob[] = []
  let pos = 0
  while (pos < total) {
    const end = Math.min(pos + PIECE, total) - 1
    let done = false
    for (let attempt = 0; attempt < 3 && !done; attempt++) {
      try {
        const res = await fetch(url, { cache: 'no-store', headers: { Range: `bytes=${pos}-${end}` } })
        if (res.status === 200) return await res.blob() // the server sent the whole file at once
        if (res.status !== 206) throw new Error(`status ${res.status}`)
        parts.push(await res.blob())
        pos = end + 1
        done = true
      } catch (e) {
        if (attempt === 2) throw e
      }
    }
  }
  return new Blob(parts)
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
