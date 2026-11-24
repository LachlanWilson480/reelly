import { NextRequest, NextResponse } from 'next/server'
import { getAdmin } from '@/lib/adminAuth'

// Tells the app whether the signed-in person is on the Reelezy team, so the Admin link only shows for them
export async function GET(req: NextRequest) {
  const me = await getAdmin(req)
  return NextResponse.json({ admin: !!me })
}
