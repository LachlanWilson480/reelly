// Server only. Google Business Profile: connect a person's profile, add photos and answer reviews.
// Needs Google's approval for the Business Profile API on our Google Cloud project before it works.
import { createHmac, timingSafeEqual } from 'crypto'
import { encryptToken, decryptToken } from '@/lib/tokenEncryption'
import { supabaseAdmin, siteOrigin } from '@/lib/platforms'
import type { PlanKey } from '@/lib/aiBudget'

const clientId = () => process.env.GBP_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || ''
const clientSecret = () => process.env.GBP_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET || ''
const V4 = 'https://mybusiness.googleapis.com/v4'
export const SCOPE = 'https://www.googleapis.com/auth/business.manage'
export const gbpRedirect = () => `${siteOrigin()}/api/gbp/callback`

// Stays "Coming soon" until GBP_ENABLED=true is set, which is done once Google has approved our access
export const gbpEnabled = () => process.env.GBP_ENABLED === 'true' && !!clientId() && !!clientSecret() && !!process.env.TOKEN_ENCRYPTION_KEY

export class GbpError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

// ---- signed state, same idea as the other platforms ----
const sign = (s: string) => createHmac('sha256', process.env.TOKEN_ENCRYPTION_KEY || '').update(s).digest('base64url')
export const makeState = (userId: string) => { const body = `${userId}.gbp.${Date.now()}`; return `${body}.${sign(body)}` }
export function readState(state: string | null): string | null {
  if (!state) return null
  const p = state.split('.')
  if (p.length !== 4 || p[1] !== 'gbp' || Date.now() - Number(p[2]) > 15 * 60_000) return null
  const a = Buffer.from(sign(p.slice(0, 3).join('.'))); const b = Buffer.from(p[3])
  return a.length === b.length && timingSafeEqual(a, b) ? p[0] : null
}
export const authUrl = (state: string) => {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  u.searchParams.set('client_id', clientId()); u.searchParams.set('redirect_uri', gbpRedirect()); u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', SCOPE); u.searchParams.set('access_type', 'offline'); u.searchParams.set('prompt', 'consent'); u.searchParams.set('state', state)
  return u.toString()
}

type Tokens = { access: string; refresh?: string; expiresAt?: string }
async function tokenCall(body: Record<string, string>): Promise<Tokens> {
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), ...body }) })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.access_token) throw new GbpError(res.status, 'Google would not confirm the connection')
  return { access: String(j.access_token), refresh: j.refresh_token ? String(j.refresh_token) : undefined, expiresAt: j.expires_in ? new Date(Date.now() + Number(j.expires_in) * 1000).toISOString() : undefined }
}

async function gapi(access: string, url: string, init: RequestInit = {}): Promise<Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${access}`, ...(init.headers || {}) } })
  if (res.status === 204) return {}
  const j = await res.json().catch(() => ({}))
  if (!res.ok) {
    const raw = String(j?.error?.message || `Google returned ${res.status}`)
    if (res.status === 429) throw new GbpError(429, 'Google is limiting requests right now. Try again in a minute.')
    if (res.status === 403) throw new GbpError(403, 'Google has not switched on Business Profile access for Reelezy yet, or this account cannot manage that profile.')
    throw new GbpError(res.status, raw.slice(0, 200))
  }
  return j
}

export type Loc = { path: string; title: string }
async function fetchLocations(access: string): Promise<Loc[]> {
  const accs = await gapi(access, 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20')
  const out: Loc[] = []
  for (const a of (accs.accounts || []) as { name: string }[]) {
    const r = await gapi(access, `https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title&pageSize=100`)
    for (const l of (r.locations || []) as { name: string; title?: string }[]) out.push({ path: `${a.name}/${l.name}`, title: l.title || 'Your business' })
  }
  return out
}

export async function finishConnect(userId: string, code: string): Promise<void> {
  const t = await tokenCall({ code, redirect_uri: gbpRedirect(), grant_type: 'authorization_code' })
  const locs = await fetchLocations(t.access)
  if (locs.length === 0) throw new GbpError(404, 'No Google Business Profile was found on that Google account')
  const { error } = await supabaseAdmin.from('social_connections').upsert({
    user_id: userId, platform: 'google_business', account_id: locs[0].path, account_name: locs[0].title,
    access_token_enc: encryptToken(t.access), refresh_token_enc: t.refresh ? encryptToken(t.refresh) : null, expires_at: t.expiresAt || null, status: 'connected',
  }, { onConflict: 'user_id,platform' })
  if (error) throw new Error('Could not save the connection')
}

export type GbpConn = { id: string; user_id: string; account_id: string | null; account_name: string | null; access_token_enc: string; refresh_token_enc: string | null; expires_at: string | null; status: string }
export async function getConn(userId: string): Promise<GbpConn | null> {
  const { data } = await supabaseAdmin.from('social_connections').select('*').eq('user_id', userId).eq('platform', 'google_business').maybeSingle()
  return (data as GbpConn | null) || null
}

async function accessFor(c: GbpConn): Promise<string> {
  const expiring = c.expires_at && new Date(c.expires_at).getTime() < Date.now() + 5 * 60_000
  if (!expiring) return decryptToken(c.access_token_enc)
  if (!c.refresh_token_enc) { await supabaseAdmin.from('social_connections').update({ status: 'expired' }).eq('id', c.id); throw new GbpError(401, 'Your Google connection expired. Reconnect it.') }
  try {
    const t = await tokenCall({ refresh_token: decryptToken(c.refresh_token_enc), grant_type: 'refresh_token' })
    await supabaseAdmin.from('social_connections').update({ access_token_enc: encryptToken(t.access), expires_at: t.expiresAt || null, status: 'connected' }).eq('id', c.id)
    return t.access
  } catch {
    await supabaseAdmin.from('social_connections').update({ status: 'expired' }).eq('id', c.id)
    throw new GbpError(401, 'Your Google connection expired. Reconnect it.')
  }
}

const here = (c: GbpConn) => { if (!c.account_id) throw new GbpError(400, 'Choose which business to use first'); return c.account_id }

export async function listLocations(c: GbpConn): Promise<Loc[]> { return fetchLocations(await accessFor(c)) }

export async function chooseLocation(c: GbpConn, path: string): Promise<Loc> {
  const found = (await listLocations(c)).find((l) => l.path === path)
  if (!found) throw new GbpError(400, 'That business is not on your Google account')
  await supabaseAdmin.from('social_connections').update({ account_id: found.path, account_name: found.title }).eq('id', c.id)
  return found
}

// ---- photos ----
export const PHOTO_CATEGORIES = ['AT_WORK', 'PRODUCT', 'INTERIOR', 'EXTERIOR', 'TEAMS', 'COVER', 'LOGO', 'ADDITIONAL'] as const
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number]

export async function listPhotos(c: GbpConn) {
  const j = await gapi(await accessFor(c), `${V4}/${here(c)}/media?pageSize=24`)
  return ((j.mediaItems || []) as Record<string, any>[]).filter((m) => m.mediaFormat === 'PHOTO' || !m.mediaFormat).map((m) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    name: String(m.name), url: String(m.thumbnailUrl || m.googleUrl || ''), category: String(m.locationAssociation?.category || 'ADDITIONAL'), created: String(m.createTime || ''),
  }))
}

export async function uploadPhoto(c: GbpConn, bytes: Uint8Array, mime: string, category: PhotoCategory) {
  const access = await accessFor(c); const loc = here(c)
  const start = await gapi(access, `${V4}/${loc}/media:startUpload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  const up = await fetch(`https://mybusiness.googleapis.com/upload/v1/media/${start.resourceName}?upload_type=media`, { method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': mime }, body: bytes as unknown as BodyInit })
  if (!up.ok) throw new GbpError(up.status, 'Google would not accept that photo. Try a different one.')
  await gapi(access, `${V4}/${loc}/media`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mediaFormat: 'PHOTO', locationAssociation: { category }, dataRef: { resourceName: start.resourceName } }) })
}

export async function deletePhoto(c: GbpConn, name: string) {
  if (!name.startsWith(`${here(c)}/media/`)) throw new GbpError(400, 'That photo is not on this business')
  await gapi(await accessFor(c), `${V4}/${name}`, { method: 'DELETE' })
}

// ---- reviews ----
const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }
export type Review = { name: string; reviewer: string; stars: number; comment: string; updated: string; reply: string | null }

export async function listReviews(c: GbpConn) {
  const j = await gapi(await accessFor(c), `${V4}/${here(c)}/reviews?pageSize=30&orderBy=${encodeURIComponent('updateTime desc')}`)
  const reviews: Review[] = ((j.reviews || []) as Record<string, any>[]).map((r) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    name: String(r.name), reviewer: String(r.reviewer?.displayName || 'A customer'), stars: STARS[String(r.starRating)] || 0,
    comment: String(r.comment || ''), updated: String(r.updateTime || r.createTime || ''), reply: r.reviewReply?.comment ? String(r.reviewReply.comment) : null,
  }))
  return { reviews, average: Number(j.averageRating || 0), total: Number(j.totalReviewCount || reviews.length) }
}

export async function replyToReview(c: GbpConn, reviewName: string, comment: string) {
  if (!reviewName.startsWith(`${here(c)}/reviews/`)) throw new GbpError(400, 'That review is not on this business')
  await gapi(await accessFor(c), `${V4}/${reviewName}/reply`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment: comment.slice(0, 4000) }) })
}
export async function deleteReply(c: GbpConn, reviewName: string) {
  if (!reviewName.startsWith(`${here(c)}/reviews/`)) throw new GbpError(400, 'That review is not on this business')
  await gapi(await accessFor(c), `${V4}/${reviewName}/reply`, { method: 'DELETE' })
}

// ---- helpers for the routes ----
export async function planOf(userId: string): Promise<PlanKey | null> {
  const { data } = await supabaseAdmin.from('subscriptions').select('plan, status').eq('user_id', userId).maybeSingle()
  if (!data || data.status !== 'active') return null
  return data.plan === 'basic' ? 'basic' : data.plan === 'top' ? 'top' : 'mid'
}
export const failure = (e: unknown) => {
  if (e instanceof GbpError) return { status: e.status === 401 ? 401 : e.status >= 400 && e.status < 600 ? e.status : 502, message: e.message }
  return { status: 500, message: 'Something went wrong with Google. Please try again.' }
}
