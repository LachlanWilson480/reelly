import dns from 'node:dns/promises'
import net from 'node:net'

// Fetches a public web page for the website scan. Refuses anything that points at a private network.
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const v = ip.toLowerCase()
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:')
}

export function normaliseUrl(input: string): URL | null {
  const raw = input.trim()
  if (!raw || raw.length > 300) return null
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.username || u.password) return null
    if (!u.hostname.includes('.')) return null
    return u
  } catch { return null }
}

async function assertPublic(u: URL) {
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(host)) { if (isPrivateIp(host)) throw new Error('blocked'); return }
  const addrs = await dns.lookup(host, { all: true })
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) throw new Error('blocked')
}

// Returns the page's HTML (capped), following up to 3 redirects and checking every hop.
export async function fetchPublicHtml(start: URL, maxBytes = 1_500_000, timeoutMs = 8000): Promise<{ html: string; finalUrl: URL } | null> {
  let url = start
  for (let hop = 0; hop < 4; hop++) {
    try {
      await assertPublic(url)
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReelezyBot/1.0)', Accept: 'text/html' } })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc) return null
        url = new URL(loc, url)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
        continue
      }
      if (!res.ok) return null
      const type = res.headers.get('content-type') || ''
      if (!/html|text/i.test(type)) return null
      const reader = res.body?.getReader()
      if (!reader) return null
      const chunks: Uint8Array[] = []
      let total = 0
      while (total < maxBytes) {
        const { done, value } = await reader.read()
        if (done || !value) break
        chunks.push(value); total += value.length
      }
      reader.cancel().catch(() => {})
      return { html: new TextDecoder().decode(Buffer.concat(chunks)), finalUrl: url }
    } catch { return null }
  }
  return null
}
