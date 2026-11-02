// Server only. Connecting, posting to and reading numbers from each social platform.
import { createHmac, timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { encryptToken, decryptToken } from '@/lib/tokenEncryption'
import type { PlatformId } from '@/lib/socialProfiles'

export const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const GRAPH = 'https://graph.facebook.com/v21.0'
const LI_VERSION = '202410'

type Cfg = { idEnv: string; secretEnv: string; authUrl: string; tokenUrl: string; scope: string; idParam?: string }
const CFG: Record<PlatformId, Cfg> = {
  youtube: { idEnv: 'YOUTUBE_CLIENT_ID', secretEnv: 'YOUTUBE_CLIENT_SECRET', authUrl: 'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl: 'https://oauth2.googleapis.com/token', scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly' },
  linkedin: { idEnv: 'LINKEDIN_CLIENT_ID', secretEnv: 'LINKEDIN_CLIENT_SECRET', authUrl: 'https://www.linkedin.com/oauth/v2/authorization', tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken', scope: 'openid profile w_member_social' },
  facebook: { idEnv: 'META_APP_ID', secretEnv: 'META_APP_SECRET', authUrl: 'https://www.facebook.com/v21.0/dialog/oauth', tokenUrl: `${GRAPH}/oauth/access_token`, scope: 'pages_show_list,pages_manage_posts,pages_read_engagement' },
  instagram: { idEnv: 'META_APP_ID', secretEnv: 'META_APP_SECRET', authUrl: 'https://www.facebook.com/v21.0/dialog/oauth', tokenUrl: `${GRAPH}/oauth/access_token`, scope: 'pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish,instagram_manage_insights' },
  tiktok: { idEnv: 'TIKTOK_CLIENT_KEY', secretEnv: 'TIKTOK_CLIENT_SECRET', authUrl: 'https://www.tiktok.com/v2/auth/authorize/', tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/', scope: 'user.info.basic,video.publish,video.upload', idParam: 'client_key' },
}

export const isPlatform = (v: unknown): v is PlatformId => typeof v === 'string' && v in CFG
export const isConfigured = (p: PlatformId) => !!process.env[CFG[p].idEnv] && !!process.env[CFG[p].secretEnv] && !!process.env.TOKEN_ENCRYPTION_KEY
export const siteOrigin = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.reelezy.com').replace(/\/$/, '')
export const redirectUri = (p: PlatformId) => `${siteOrigin()}/api/social/callback/${p}`

// ---- signed state so the callback knows which user started the connection ----
const sign = (s: string) => createHmac('sha256', process.env.TOKEN_ENCRYPTION_KEY || '').update(s).digest('base64url')
export function makeState(userId: string, platform: PlatformId): string {
  const body = `${userId}.${platform}.${Date.now()}`
  return `${body}.${sign(body)}`
}
export function readState(state: string | null, platform: PlatformId): string | null {
  if (!state) return null
  const parts = state.split('.')
  if (parts.length !== 4) return null
  const body = parts.slice(0, 3).join('.')
  const a = Buffer.from(sign(body)); const b = Buffer.from(parts[3])
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (parts[1] !== platform || Date.now() - Number(parts[2]) > 15 * 60_000) return null
  return parts[0]
}

export function authorizeUrl(platform: PlatformId, state: string): string {
  const c = CFG[platform]
  const u = new URL(c.authUrl)
  u.searchParams.set(c.idParam || 'client_id', process.env[c.idEnv]!)
  u.searchParams.set('redirect_uri', redirectUri(platform))
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', c.scope)
  u.searchParams.set('state', state)
  if (platform === 'youtube') { u.searchParams.set('access_type', 'offline'); u.searchParams.set('prompt', 'consent') }
  return u.toString()
}

type Tokens = { access: string; refresh?: string; expiresAt?: string }
const inSeconds = (s?: number) => (s ? new Date(Date.now() + s * 1000).toISOString() : undefined)

async function form(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Token request failed (${res.status})`)
  return j as Record<string, unknown>
}

export async function exchangeCode(platform: PlatformId, code: string): Promise<Tokens> {
  const c = CFG[platform]
  const body: Record<string, string> = { code, redirect_uri: redirectUri(platform), grant_type: 'authorization_code' }
  if (platform === 'tiktok') { body.client_key = process.env[c.idEnv]!; body.client_secret = process.env[c.secretEnv]! }
  else { body.client_id = process.env[c.idEnv]!; body.client_secret = process.env[c.secretEnv]! }
  const j = await form(c.tokenUrl, body)
  return { access: String(j.access_token), refresh: j.refresh_token ? String(j.refresh_token) : undefined, expiresAt: inSeconds(Number(j.expires_in) || undefined) }
}

async function refreshTokens(platform: PlatformId, refresh: string): Promise<Tokens> {
  const c = CFG[platform]
  const body: Record<string, string> = { refresh_token: refresh, grant_type: 'refresh_token' }
  if (platform === 'tiktok') { body.client_key = process.env[c.idEnv]!; body.client_secret = process.env[c.secretEnv]! }
  else { body.client_id = process.env[c.idEnv]!; body.client_secret = process.env[c.secretEnv]! }
  const j = await form(c.tokenUrl, body)
  return { access: String(j.access_token), refresh: j.refresh_token ? String(j.refresh_token) : refresh, expiresAt: inSeconds(Number(j.expires_in) || undefined) }
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const res = await fetch(url, { headers })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned ${res.status}`)
  return j
}

// Turns the code from the sign-in page into a stored, encrypted connection
export async function completeConnection(platform: PlatformId, userId: string, code: string): Promise<void> {
  let t = await exchangeCode(platform, code)
  let accountId = ''; let accountName = ''
  if (platform === 'youtube') {
    const j = await getJson('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { Authorization: `Bearer ${t.access}` })
    const ch = j.items?.[0]
    if (!ch) throw new Error('No YouTube channel found on that Google account')
    accountId = ch.id; accountName = ch.snippet?.title || ''
  } else if (platform === 'linkedin') {
    const j = await getJson('https://api.linkedin.com/v2/userinfo', { Authorization: `Bearer ${t.access}` })
    accountId = j.sub; accountName = j.name || ''
  } else if (platform === 'tiktok') {
    const j = await getJson('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', { Authorization: `Bearer ${t.access}` })
    accountId = j.data?.user?.open_id || ''; accountName = j.data?.user?.display_name || ''
  } else {
    // Facebook and Instagram: swap for a long lived token, then use the page token
    const c = CFG[platform]
    const long = await form(c.tokenUrl, { grant_type: 'fb_exchange_token', client_id: process.env[c.idEnv]!, client_secret: process.env[c.secretEnv]!, fb_exchange_token: t.access }).catch(() => null)
    const user = long ? String(long.access_token) : t.access
    const pages = await getJson(`${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(user)}`)
    const list: any[] = pages.data || [] // eslint-disable-line @typescript-eslint/no-explicit-any
    if (platform === 'facebook') {
      const pg = list[0]
      if (!pg) throw new Error('No Facebook Page found. Posting needs a Facebook Page you manage')
      accountId = pg.id; accountName = pg.name; t = { access: pg.access_token }
    } else {
      const pg = list.find((x) => x.instagram_business_account)
      if (!pg) throw new Error('No Instagram business account is linked to a Facebook Page you manage')
      accountId = pg.instagram_business_account.id; accountName = pg.instagram_business_account.username || pg.name; t = { access: pg.access_token }
    }
  }
  const { error } = await supabaseAdmin.from('social_connections').upsert({
    user_id: userId, platform, account_id: accountId, account_name: accountName,
    access_token_enc: encryptToken(t.access), refresh_token_enc: t.refresh ? encryptToken(t.refresh) : null,
    expires_at: t.expiresAt || null, status: 'connected',
  }, { onConflict: 'user_id,platform' })
  if (error) throw new Error('Could not save the connection')
}

export type Conn = { id: string; user_id: string; platform: PlatformId; account_id: string | null; account_name: string | null; access_token_enc: string; refresh_token_enc: string | null; expires_at: string | null; status: string }

async function freshToken(conn: Conn): Promise<string> {
  const expiring = conn.expires_at && new Date(conn.expires_at).getTime() < Date.now() + 5 * 60_000
  if (!expiring) return decryptToken(conn.access_token_enc)
  if (!conn.refresh_token_enc) {
    await supabaseAdmin.from('social_connections').update({ status: 'expired' }).eq('id', conn.id)
    throw new Error(`Your ${conn.platform} connection expired. Reconnect it`)
  }
  try {
    const t = await refreshTokens(conn.platform, decryptToken(conn.refresh_token_enc))
    await supabaseAdmin.from('social_connections').update({ access_token_enc: encryptToken(t.access), refresh_token_enc: t.refresh ? encryptToken(t.refresh) : conn.refresh_token_enc, expires_at: t.expiresAt || null, status: 'connected' }).eq('id', conn.id)
    return t.access
  } catch {
    await supabaseAdmin.from('social_connections').update({ status: 'expired' }).eq('id', conn.id)
    throw new Error(`Your ${conn.platform} connection expired. Reconnect it`)
  }
}

export type PostInput = { title: string; caption: string; videoUrl: string }
export type PostOutcome = { id: string; url?: string }

async function ok(res: Response, what: string) {
  if (res.ok) return
  const text = (await res.text().catch(() => '')).slice(0, 200)
  throw new Error(`${what} failed (${res.status}) ${text}`.trim())
}
const fetchVideo = async (url: string): Promise<Uint8Array> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not read the rendered video')
  return new Uint8Array(await res.arrayBuffer())
}

export async function postVideo(conn: Conn, post: PostInput): Promise<PostOutcome> {
  const token = await freshToken(conn)
  const text = post.caption || post.title
  switch (conn.platform) {
    case 'youtube': {
      const bytes = await fetchVideo(post.videoUrl)
      const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(bytes.length) },
        body: JSON.stringify({ snippet: { title: post.title.slice(0, 95), description: `${text}\n\n#Shorts`.slice(0, 4800) }, status: { privacyStatus: 'public', selfDeclaredMadeForKids: false } }),
      })
      await ok(init, 'YouTube upload start')
      const loc = init.headers.get('location'); if (!loc) throw new Error('YouTube did not return an upload address')
      const up = await fetch(loc, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: bytes as unknown as BodyInit })
      await ok(up, 'YouTube upload')
      const j = await up.json()
      return { id: j.id, url: `https://www.youtube.com/watch?v=${j.id}` }
    }
    case 'linkedin': {
      const bytes = await fetchVideo(post.videoUrl)
      const owner = `urn:li:person:${conn.account_id}`
      const H = { Authorization: `Bearer ${token}`, 'LinkedIn-Version': LI_VERSION, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' }
      const init = await fetch('https://api.linkedin.com/rest/videos?action=initializeUpload', { method: 'POST', headers: H, body: JSON.stringify({ initializeUploadRequest: { owner, fileSizeBytes: bytes.length, uploadCaptions: false, uploadThumbnail: false } }) })
      await ok(init, 'LinkedIn upload start')
      const { value } = await init.json()
      const etags: string[] = []
      for (const part of value.uploadInstructions as { uploadUrl: string; firstByte: number; lastByte: number }[]) {
        const r = await fetch(part.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes.slice(part.firstByte, part.lastByte + 1) as unknown as BodyInit })
        await ok(r, 'LinkedIn upload')
        etags.push(r.headers.get('etag') || '')
      }
      const fin = await fetch('https://api.linkedin.com/rest/videos?action=finalizeUpload', { method: 'POST', headers: H, body: JSON.stringify({ finalizeUploadRequest: { video: value.video, uploadToken: value.uploadToken || '', uploadedPartIds: etags } }) })
      await ok(fin, 'LinkedIn finalize')
      const pub = await fetch('https://api.linkedin.com/rest/posts', { method: 'POST', headers: H, body: JSON.stringify({ author: owner, commentary: text.slice(0, 2900), visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, content: { media: { title: post.title.slice(0, 200), id: value.video } }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false }) })
      await ok(pub, 'LinkedIn post')
      return { id: pub.headers.get('x-restli-id') || value.video }
    }
    case 'facebook': {
      const res = await fetch(`${GRAPH}/${conn.account_id}/videos`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ file_url: post.videoUrl, description: text, title: post.title.slice(0, 100), access_token: token }) })
      await ok(res, 'Facebook upload')
      const j = await res.json()
      return { id: String(j.id), url: `https://www.facebook.com/${j.id}` }
    }
    case 'instagram': {
      const mk = await fetch(`${GRAPH}/${conn.account_id}/media`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ media_type: 'REELS', video_url: post.videoUrl, caption: text.slice(0, 2200), access_token: token }) })
      await ok(mk, 'Instagram upload start')
      const { id: container } = await mk.json()
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 4000))
        const s = await getJson(`${GRAPH}/${container}?fields=status_code&access_token=${encodeURIComponent(token)}`)
        if (s.status_code === 'FINISHED') break
        if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error('Instagram could not process the video')
        if (i === 19) throw new Error('Instagram took too long to process the video')
      }
      const pub = await fetch(`${GRAPH}/${conn.account_id}/media_publish`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ creation_id: container, access_token: token }) })
      await ok(pub, 'Instagram publish')
      const j = await pub.json()
      return { id: String(j.id) }
    }
    case 'tiktok': {
      const bytes = await fetchVideo(post.videoUrl)
      if (bytes.length > 64 * 1024 * 1024) throw new Error('Video is too large for TikTok upload (64 MB)')
      const init = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ post_info: { title: text.slice(0, 2000), privacy_level: process.env.TIKTOK_PRIVACY || 'SELF_ONLY' }, source_info: { source: 'FILE_UPLOAD', video_size: bytes.length, chunk_size: bytes.length, total_chunk_count: 1 } }),
      })
      await ok(init, 'TikTok upload start')
      const j = await init.json()
      if (j.error?.code && j.error.code !== 'ok') throw new Error(`TikTok: ${j.error.message || j.error.code}`)
      const up = await fetch(j.data.upload_url, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Range': `bytes 0-${bytes.length - 1}/${bytes.length}` }, body: bytes as unknown as BodyInit })
      await ok(up, 'TikTok upload')
      return { id: String(j.data.publish_id) }
    }
  }
}

export type Metrics = { views: number; likes: number; comments: number; shares: number }
// Returns null when the platform does not give us numbers for this post
export async function fetchMetrics(conn: Conn, externalId: string): Promise<Metrics | null> {
  const token = await freshToken(conn)
  if (conn.platform === 'youtube') {
    const j = await getJson(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(externalId)}`, { Authorization: `Bearer ${token}` })
    const s = j.items?.[0]?.statistics; if (!s) return null
    return { views: +s.viewCount || 0, likes: +s.likeCount || 0, comments: +s.commentCount || 0, shares: 0 }
  }
  if (conn.platform === 'facebook') {
    const j = await getJson(`${GRAPH}/${externalId}?fields=views,likes.summary(true).limit(0),comments.summary(true).limit(0)&access_token=${encodeURIComponent(token)}`)
    return { views: +j.views || 0, likes: j.likes?.summary?.total_count || 0, comments: j.comments?.summary?.total_count || 0, shares: 0 }
  }
  if (conn.platform === 'instagram') {
    const j = await getJson(`${GRAPH}/${externalId}/insights?metric=views,likes,comments,shares&access_token=${encodeURIComponent(token)}`)
    const m: Record<string, number> = {}
    for (const row of j.data || []) m[row.name] = row.values?.[0]?.value ?? row.total_value?.value ?? 0
    return { views: m.views || 0, likes: m.likes || 0, comments: m.comments || 0, shares: m.shares || 0 }
  }
  return null // TikTok and LinkedIn do not give these numbers to this kind of app
}
