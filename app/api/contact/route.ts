import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { rateLimit } from '@/lib/rateLimit'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
  const { allowed } = await rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000)
  if (!allowed) return NextResponse.json({ error: 'Too many messages. Please try again later.' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const name = String(body.name || '').trim().slice(0, 100)
  const email = String(body.email || '').trim().slice(0, 200)
  const message = String(body.message || '').trim().slice(0, 4000)
  if (body.website) return NextResponse.json({ ok: true }) // hidden field: bots fill it in
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter your name, a valid email and a message.' }, { status: 400 })
  }
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Messages are unavailable right now. Please email info@reelezy.com.' }, { status: 503 })

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Reelezy <noreply@reelezy.com>',
      to: 'info@reelezy.com',
      replyTo: email,
      subject: `Website message from ${name}`.replace(/[\r\n]/g, ' '),
      html: `<div style="font-family: sans-serif; max-width: 560px;"><p><b>${esc(name)}</b> (${esc(email)})</p><p style="white-space: pre-wrap;">${esc(message)}</p></div>`,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not send your message. Please email info@reelezy.com.' }, { status: 500 })
  }
}
