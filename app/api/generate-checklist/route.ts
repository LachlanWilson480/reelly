import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getPlan(userId: string | undefined): Promise<'basic' | 'mid'> {
  if (!userId) return 'mid'
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data || data.status !== 'active') return 'mid'
  return data.plan === 'basic' ? 'basic' : 'mid'
}

export async function POST(req: NextRequest) {
  try {
    const { ideas, profile, customization, userId, styleOverride } = await req.json()

    const plan = await getPlan(userId)

    if (styleOverride && plan !== 'mid') {
      return NextResponse.json({ error: 'Regenerating in a different style is a Mid plan feature. Upgrade to unlock it.' }, { status: 403 })
    }

    const effectiveCustomization = plan === 'mid' ? customization : null

    const ideasList = ideas
      .map((idea: { title: string; hook: string; description: string; notes?: string }, i: number) => {
        const notesLine = idea.notes ? ` Owner's notes (priority if conflicting): ${idea.notes}` : ''
        return `${i + 1}. Title: ${idea.title}\n   Opening line already chosen: "${idea.hook}"\n   Point of the video: ${idea.description}${notesLine}`
      })
      .join('\n\n')

    const customNote = effectiveCustomization ? `\n\nOwner's style guidance: ${effectiveCustomization}` : ''
    const styleNote = styleOverride ? `\n\nDelivery style for this version: ${styleOverride}` : ''

    const prompt = `You are a filming coach turning a chosen video idea into a precise filming checklist for ${profile.business_name}, a ${profile.industry} in ${profile.suburb}, Sydney. They film ALONE on a phone, no crew, under 10 minutes total including setup.

Rules for every checklist step:
- Continue the idea's existing opening line naturally — don't invent a new opening.
- Dialogue must sound like a real person talking (contractions, casual, short sentences) — never like an ad or script.
- Time each step generously: roughly 2 words per second of dialogue, rounded up, plus 1-2 seconds buffer for movement. A 12-word line needs at least 7-8 seconds; a 20-word line needs at least 12-13 seconds. Never compress. Total video 20-45 seconds.
- Camera must move or change somehow in most steps (walk, pan, point at something, change distance) — not a static talking head throughout.
- Common-sense observations (damage, heat, smell) are fine to state directly. Specific regulatory/technical facts (certification timeframes, standard numbers, thresholds) must instead be handed to the owner to say in their own words, since you could be wrong or outdated on those.
- Never use a double-quote character inside any string value — use single quotes ' ' instead.
- Use as few steps as the idea needs (often 3-6). Each step is one plain-text string combining: time range, camera position/movement, brief lighting note only if relevant, and the actual words to say.

Example step showing correct pacing (24 words, 11 seconds — note how generous that is): "0:00 to 0:11 - Hold phone at chest height facing the van, and say: G'day, it's Jake from Jake's Plumbing, and mate, if your hot water system is making a weird banging noise, you're not going crazy."

${ideasList}${customNote}${styleNote}

You must produce a real, non-empty checklist for every idea listed above — never respond with an empty array or skip an idea. Respond ONLY with valid JSON, no markdown, no code fences, no other text before or after. Every "checklist" value must be an array of plain strings (never objects), one object per idea in the same order:
[
  { "checklist": ["step 1", "step 2"] }
]`

    const model = plan === 'mid' ? 'claude-sonnet-5' : 'claude-haiku-4-5'

    let normalizedChecklists: unknown[] = []
    let attempts = 0

    while (attempts < 3 && normalizedChecklists.length === 0) {
      attempts++
      const message = await anthropic.messages.create({
        model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })

      const textBlock = message.content.find((block) => block.type === 'text')
      const rawText = textBlock && 'text' in textBlock ? textBlock.text : '[]'
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      const safeCleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')

      try {
        const parsed = JSON.parse(safeCleaned)
        const asArray = Array.isArray(parsed) ? parsed : [parsed]
        if (asArray.length > 0 && asArray.every((c: { checklist?: unknown[] }) => c?.checklist && c.checklist.length > 0)) {
          normalizedChecklists = asArray
        }
      } catch {
        // retry on parse failure too
      }
    }

    if (normalizedChecklists.length === 0) {
      return NextResponse.json({ error: 'The AI had trouble generating this checklist. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ checklists: normalizedChecklists })
  } catch (error) {
    console.error('generate-checklist error:', error)
    return NextResponse.json({ error: 'Failed to generate checklist' }, { status: 500 })
  }
}
