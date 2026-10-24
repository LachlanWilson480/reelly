// Remembers the videos that are rendering so the "ready" popup can follow them across pages
// (and across a closed tab) until the person has seen them.

export type TrackedRender = {
  id: string
  title: string
  ts: number
  state: 'pending' | 'done' | 'failed'
  outputUrl?: string | null
}

export const TRACK_KEY = 'reelezy-renders'
export const TRACK_EVENT = 'reelezy-renders-changed'

export function readTracked(): TrackedRender[] {
  try {
    const raw = localStorage.getItem(TRACK_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((r) => r && typeof r.id === 'string') : []
  } catch {
    return []
  }
}

export function writeTracked(list: TrackedRender[]) {
  try {
    localStorage.setItem(TRACK_KEY, JSON.stringify(list.slice(-40)))
    window.dispatchEvent(new Event(TRACK_EVENT))
  } catch {}
}

export function trackRenders(items: { id: string; title?: string | null }[]) {
  const list = readTracked()
  for (const it of items) {
    if (!list.some((r) => r.id === it.id)) list.push({ id: it.id, title: it.title || '', ts: Date.now(), state: 'pending' })
  }
  writeTracked(list)
}
