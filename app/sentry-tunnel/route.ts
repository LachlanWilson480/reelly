// Browser error reports arrive at /monitoring and are passed on to Sentry here, without cookies
// or other headers. Only our own Sentry project is accepted, and each visitor is rate limited
// so nobody can use up the monthly error allowance.
import { NextRequest } from 'next/server'
import { POST as forwardToSentry } from '@sentry/nextjs/tunnel'
import { tooMany, ipOf } from '@/lib/limit'

export async function POST(req: NextRequest) {
  const limited = await tooMany(`sentry:${ipOf(req)}`, 30, 60 * 1000)
  if (limited) return limited
  return forwardToSentry(req)
}
