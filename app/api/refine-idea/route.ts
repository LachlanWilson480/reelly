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

async function isMidPlan(userId: string | undefined): Promise<boolean> {
  if (!userId) return true
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data || data.status !== 'active') return true
  return data.plan !== 'basic'
}

export async function POST(req: NextRequest) {
  try {
    const { idea, instruction, profile, userId } = await req.json()

    const allowed = await isMidPlan(userId)
    if (!allowed) {
      return NextResponse.json({ error: 'Refining ideas is a Pro plan feature. Upgrade to unlock it.' }, { status: 403 })
    }

    const prompt = `You are refining a single existing social media video idea for a small business owner based on their feedback. Keep the same overall angle/topic, but adjust it based on their instruction below.

Business: ${profile.business_name}, a ${profile.industry} in ${profile.suburb}, Sydney. Tone: ${profile.tone || 'not specified'}.

Current idea:
Title: ${idea.title}
Hook: ${idea.hook}
Description: ${idea.description}
Tags: ${idea.tags}

The business owner's instruction for how to change this idea: "${instruction}"

Apply the same realism constraints as before: nothing that depends on a specific fictional customer/job happening live, no invented technical/regulatory facts (hand those off to the owner to explain themselves), 15-30 second video, filmable alone on a phone.

IMPORTANT JSON FORMATTING RULE: never use a double-quote character (") anywhere inside any string value (use single quotes ' ' instead). This is critical for valid JSON output.
Respond ONLY with valid JSON, no markdown, no code fences, in this exact structure:
{ "title": "...", "hook": "...", "description": "...", "tags": "#tag1 #tag2 #tag3" }`

    const message = await anthropic.messages.create({
      thinking: { type: "disabled" },      model: 'claude-sonnet-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '{}'
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const safeCleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')
    const refined = JSON.parse(safeCleaned)

    const flaggedIndices = await moderateTexts([`${refined.title}. ${refined.hook} ${refined.description}`])
    if (flaggedIndices.size > 0) {
      return NextResponse.json({ error: 'Generated content did not pass our safety check. Please try again.' }, { status: 422 })
    }

    return NextResponse.json({ idea: refined })
  } catch (error) {
    console.error('refine-idea error:', error)
    return NextResponse.json({ error: 'Failed to refine idea' }, { status: 500 })
  }
}
