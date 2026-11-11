// Remembers where to send someone after they log in, so a checkout they started is not lost.
const KEY = 'reelezy-after-login'

export function saveAfterLogin(path: string) {
  try { if (path.startsWith('/checkout')) localStorage.setItem(KEY, path) } catch {}
}

export function takeAfterLogin(fallback: string): string {
  try {
    const p = localStorage.getItem(KEY)
    if (p) { localStorage.removeItem(KEY); if (p.startsWith('/checkout')) return p }
  } catch {}
  return fallback
}
