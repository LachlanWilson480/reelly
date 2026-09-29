import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()
    if (!code?.trim()) {
      return NextResponse.json({ error: 'No code provided' }, { status: 400 })
    }

    const { data } = await supabaseAdmin
      .from('discount_codes')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('active', true)
      .maybeSingle()

    if (!data) {
      return NextResponse.json({ error: 'Invalid or expired discount code' }, { status: 404 })
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This discount code has expired' }, { status: 400 })
    }

    if (data.max_uses !== null && data.uses >= data.max_uses) {
      return NextResponse.json({ error: 'This discount code has reached its limit' }, { status: 400 })
    }

    return NextResponse.json({ valid: true, percentOff: data.percent_off, code: data.code })
  } catch (error) {
    console.error('validate-discount error:', error)
    return NextResponse.json({ error: 'Failed to validate code' }, { status: 500 })
  }
}
