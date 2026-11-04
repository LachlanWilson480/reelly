import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { gbpEnabled, makeState, authUrl, planOf } from '@/lib/googleBusiness'

export async function POST(req: NextRequest) {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!gbpEnabled()) return NextResponse.json({ error: 'This connection is not switched on yet' }, { status: 503 })
  if (!(await planOf(authed.userId))) return NextResponse.json({ error: 'Google Business Profile is part of the paid plans' }, { status: 403 })
  return NextResponse.json({ url: authUrl(makeState(authed.userId)) })
}
