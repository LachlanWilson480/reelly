import { rateLimit } from '@/lib/rateLimit'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { moderateTexts } from '@/lib/moderateContent'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getPlan(userId: string | undefined): Promise<'basic' | 'mid' | 'top'> {
  if (!userId) return 'basic'
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data || data.status !== 'active') return 'basic'
  if (data.plan === 'basic') return 'basic'
  if (data.plan === 'top') return 'top'
  return 'mid'
}

const LENGTH_GUIDANCE: Record<string, string> = {
  short: 'about 15-20 seconds when read aloud at a natural pace (roughly 35-50 words)',
  medium: 'about 30-45 seconds when read aloud at a natural pace (roughly 70-110 words)',
  long: 'about 60-90 seconds when read aloud at a natural pace (roughly 140-220 words)',
}

const FREE_LIFETIME_SCRIPT_LIMIT = 1
const BASIC_WEEKLY_SCRIPT_LIMIT = 20
const PRO_WEEKLY_SCRIPT_LIMIT = 96

export async function POST(req: NextRequest) {
  try {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = authed.userId
    const rl = await rateLimit(`ai:${userId}`, 10, 60000)
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
    const { topic, length, style, profile } = await req.json()

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return NextResponse.json({ error: 'Please describe what the video is about.' }, { status: 400 })
    }

    const plan = await getPlan(userId)

    if (plan === 'basic') {
      return NextResponse.json(
        { error: 'The Script Generator is available on the Basic and Pro plans. Upgrade to unlock it.' },
        { status: 403 }
      )
    }

    if (plan !== 'top') {
      const { data: usageRow } = await supabaseAdmin
        .from('business_profiles')
        .select('scripts_generated_this_week, usage_reset_at')
        .eq('user_id', userId)
        .maybeSingle()

      const now = new Date()
      const dayOfWeek = now.getDay()
      const daysSinceMonday = (dayOfWeek + 6) % 7
      const mostRecentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday, 0, 0, 0, 0)

      const resetAt = usageRow?.usage_reset_at ? new Date(usageRow.usage_reset_at) : null
      const needsReset = !resetAt || resetAt.getTime() < mostRecentMonday.getTime()
      const currentCount = needsReset ? 0 : (usageRow?.scripts_generated_this_week || 0)

      if (plan === 'free') {
        // Free plan: lifetime limit of 1 script
        const { count } = await supabaseAdmin
          .from('scripts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
        if ((count || 0) >= FREE_LIFETIME_SCRIPT_LIMIT) {
          return NextResponse.json({ error: 'Free plan includes 1 custom script. Upgrade to create more.' }, { status: 403 })
        }
      }
      const weeklyScriptLimit = BASIC_WEEKLY_SCRIPT_LIMIT
      if (currentCount >= weeklyScriptLimit) {
        return NextResponse.json(
          { error: `You've reached your limit of ${weeklyScriptLimit} scripts this week. Upgrade to Pro for 96 scripts per week.` },
          { status: 403 }
        )
      }

      await supabaseAdmin
        .from('business_profiles')
        .update({
          scripts_generated_this_week: currentCount + 1,
          usage_reset_at: needsReset ? now.toISOString() : (usageRow?.usage_reset_at || now.toISOString()),
        })
        .eq('user_id', userId)
    }

    const model = plan === 'top' ? 'claude-sonnet-5' : 'claude-haiku-4-5'

    const lengthKey = typeof length === 'string' && LENGTH_GUIDANCE[length] ? length : 'medium'
    const lengthInstruction = LENGTH_GUIDANCE[lengthKey]
    const styleInstruction = typeof style === 'string' && style.trim() ? style.trim() : 'natural and conversational'

    const businessContext = profile
      ? `Business context (use only where genuinely relevant, don't force it in): ${profile.business_name || 'a small business'}, a ${profile.industry || 'business'}${profile.suburb ? ` in ${profile.suburb}` : ''}. Tone: ${profile.tone || 'not specified'}.`
      : ''

    const prompt = `Write a word-for-word video script based on this topic: "${topic.trim()}"

${businessContext}

Requirements:
- Style/tone: ${styleInstruction}
- Length: ${lengthInstruction}
- Write ONLY the spoken words, as one flowing piece of text - no timestamps, no camera directions, no step numbers, no stage directions in brackets.
- It must sound like a real person talking out loud (contractions, natural phrasing) - never like a formal ad or a written essay.
- Give it a clear structure: a strong opening line that hooks attention in the first sentence, a middle that delivers on the topic, and a closing line with a natural call-to-action or takeaway.
- Never invent specific technical, medical, legal, or safety claims - keep any expert-specific claims general or hand them off conversationally (e.g. "ask your provider about...").
- Never use a double-quote character inside the script text - use single quotes instead.

Respond ONLY with valid JSON, no markdown, no code fences, no other text before or after. Use this exact structure:
{ "script": "..." }`

    const message = await anthropic.messages.create({
      thinking: { type: 'disabled' },
      model,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '{}'
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const objectMatch = cleaned.match(/\{[\s\S]*\}/)
    const parsed = objectMatch ? JSON.parse(objectMatch[0]) : {}
    const script = typeof parsed.script === 'string' ? parsed.script : ''

    if (!script) {
      return NextResponse.json({ error: 'The AI had trouble generating this script. Please try again.' }, { status: 500 })
    }

    const flaggedIndices = await moderateTexts([script])
    if (flaggedIndices.size > 0) {
      return NextResponse.json({ error: 'Generated content did not pass our safety check. Please try again.' }, { status: 422 })
    }

    return NextResponse.json({ script })
  } catch (error) {
    console.error('generate-script error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Failed to generate script' }, { status: 500 })
  }
}
