import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

// One line per route: returns a 429 reply when someone goes over the limit, or null when they are fine.
export async function tooMany(key: string, limit: number, windowMs: number): Promise<NextResponse | null> {
  const { allowed } = await rateLimit(key, limit, windowMs)
  return allowed ? null : NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 })
}

// The visitor's address, for routes that work without signing in
export const ipOf = (req: NextRequest) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
