import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { rateLimit } from '@/lib/rateLimit'
import { modelForPlan, thinkingOff } from '@/lib/aiModel'
import { aiGate, recordAiSpend, clampInput, bodyTooBig } from '@/lib/aiBudget'
import { cleanAiText } from '@/lib/cleanText'
import { planOf } from '@/lib/googleBusiness'
import { supabaseAdmin } from '@/lib/platforms'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MAX_TOKENS = 220

// Suggests a short, warm public reply to a customer review. The owner reads and edits it before posting.
export async function POST(req: NextRequest) {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (bodyTooBig(req)) return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  const rl = await rateLimit(`ai:gbpreply:${authed.userId}`, 8, 60_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Slow down a little and try again.' }, { status: 429 })
  const body = clampInput(await req.json().catch(() => ({})), 1200)
  const stars = Math.min(5, Math.max(1, Number(body.stars) || 5))
  const comment = typeof body.comment === 'string' ? body.comment : ''
  const reviewer = typeof body.reviewer === 'string' ? body.reviewer.split(' ')[0].slice(0, 40) : ''
  const plan = (await planOf(authed.userId)) || 'free'
  const { data: profile } = await supabaseAdmin.from('business_profiles').select('business_name, industry').eq('user_id', authed.userId).maybeSingle()
  const gate = await aiGate(authed.userId, plan, modelForPlan(plan), MAX_TOKENS)
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })
  try {
    const msg = await anthropic.messages.create({
      model: gate.model, max_tokens: MAX_TOKENS, thinking: thinkingOff(gate.model),
      system: 'You write public replies to Google reviews for a small Australian business owner. Use plain, warm Australian English, 2 to 3 short sentences, first person ("we" or "I"). Thank them by first name if given. For 4-5 stars be glad and specific to what they said. For 1-3 stars apologise briefly, do not argue or blame, and invite them to get in touch directly. Never invent facts, offers, discounts, names or phone numbers. No emojis, no dashes used as punctuation. Reply with the reply text only.',
      messages: [{ role: 'user', content: `Business: ${profile?.business_name || 'our business'}${profile?.industry ? ` (${profile.industry})` : ''}\nReviewer: ${reviewer || 'a customer'}\nStars: ${stars}\nReview: ${comment || '(no written comment)'}` }],
    })
    await recordAiSpend(authed.userId, gate.model, msg)
    const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    return NextResponse.json({ reply: cleanAiText(text).slice(0, 800) })
  } catch {
    return NextResponse.json({ error: 'Could not write a reply right now. Try again.' }, { status: 502 })
  }
}
