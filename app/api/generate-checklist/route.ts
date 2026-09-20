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
  if (!userId) return 'top'
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data || data.status !== 'active') return 'top'
  if (data.plan === 'basic') return 'basic'
  if (data.plan === 'top') return 'top'
  return 'mid'
}

export async function POST(req: NextRequest) {
  try {
    const { idea, profile, customization, userId, styleOverride } = await req.json()

    if (!idea) {
      return NextResponse.json({ error: 'No idea provided' }, { status: 400 })
    }

    const plan = await getPlan(userId)

    if (styleOverride && plan === 'basic') {
      return NextResponse.json({ error: 'Regenerating in a different style is a Pro plan feature. Upgrade to unlock it.' }, { status: 403 })
    }

    const effectiveCustomization = (plan === 'mid' || plan === 'top') ? customization : null
    const notesLine = idea.notes ? ` Owner's notes (priority if conflicting): ${idea.notes}` : ''
    const customNote = effectiveCustomization ? `\n\nOwner's style guidance: ${effectiveCustomization}` : ''
    const brandNote = profile.brand_personality ? `\n\nBrand personality: ${profile.brand_personality}` : ""
    const avoidNote = profile.words_to_avoid ? `\n\nNever use these words/phrases: ${profile.words_to_avoid}` : ""
    const styleNote = styleOverride ? `\n\nDelivery style for this version: ${styleOverride}` : ''

    const locationType = profile.location_type || 'fixed'
    const locationGuidance = locationType === 'mobile'
      ? "This business travels to customers rather than having a shop customers visit  -  never suggest filming steps set inside a shop/storefront or walking to a shop door. Use their van, tools, and current surroundings instead."
      : locationType === 'both'
      ? "This business sometimes works from a fixed location and sometimes travels  -  shop/studio setting is fine if it fits this specific idea, but don't assume it."
      : "This business works from a fixed shop/studio location  -  filming there is fine and encouraged where it fits the idea."

    const prompt = `You are a filming coach turning a chosen video idea into a precise filming checklist for ${profile.business_name}, a ${profile.industry} in ${profile.suburb}, Sydney. They film ALONE on a phone, no crew, under 10 minutes total including setup. ${locationGuidance}

Rules for every checklist step:
- Continue the idea's existing opening line naturally  -  don't invent a new opening.
- Dialogue must sound like a real person talking (contractions, casual, short sentences)  -  never like an ad or script.
- Time each step generously: roughly 2 words per second of dialogue, rounded up, plus 1-2 seconds buffer for movement. A 12-word line needs at least 7-8 seconds; a 20-word line needs at least 12-13 seconds. Never compress. Total video 20-45 seconds.
- Camera must move or change somehow in most steps (walk, pan, point at something, change distance)  -  not a static talking head throughout.
- Common-sense observations (damage, heat, smell) are fine to state directly. Specific regulatory/technical facts (certification timeframes, standard numbers, thresholds) must instead be handed to the owner to say in their own words, since you could be wrong or outdated on those.
- Never use a double-quote character inside any string value  -  use single quotes ' ' instead.
- Use as few steps as the idea needs (often 3-6). Each step is one plain-text string combining: time range, camera position/movement, brief lighting note only if relevant, and the actual words to say.

Example step showing correct pacing (24 words, 11 seconds  -  note how generous that is): "0:00 to 0:11 - Hold phone at chest height facing the van, and say: G'day, it's Jake from Jake's Plumbing, and mate, if your hot water system is making a weird banging noise, you're not going crazy."

The idea:
Title: ${idea.title}
Opening line already chosen: "${idea.hook}"
Point of the video: ${idea.description}${notesLine}${customNote}${styleNote}${brandNote}${avoidNote}

You must produce a real, non-empty checklist  -  never respond with an empty array. The video must have a clear structure: a hook/opening (first 2-3 seconds), a middle that delivers the actual content, and a closing line with a soft call-to-action (e.g. inviting a follow, a question, or a reason to book/get in touch)  -  never just trail off after the content.

Also provide:
- "prep": a short array of 2-4 plain-text items listing exactly what to grab/set up before filming (e.g. "Phone", "Your work van or a tool relevant to this video", "Good natural light  -  film facing a window or outdoors"). Always include the phone; add other items only if genuinely needed for this specific idea.
- "caption": a ready-to-post social caption (2-4 sentences) in the business's tone, expanding on the video's point, ending with 2-4 relevant hashtags.
- "script": the full word-for-word script as one flowing block of text the owner can read or memorize before filming - just the spoken words in order, with no timestamps, camera directions, or step numbers. Should read naturally out loud, exactly matching the dialogue used across the checklist steps.

Respond ONLY with valid JSON, no markdown, no code fences, no other text before or after. Use this exact structure:
{ "prep": ["item 1", "item 2"], "checklist": ["step 1", "step 2"], "caption": "...", "script": "..." }`

    const model = (plan === 'mid' || plan === 'top') ? 'claude-sonnet-5' : 'claude-haiku-4-5'

    let result: { prep?: string[]; checklist?: string[]; caption?: string; script?: string } | null = null
    let attempts = 0

    while (attempts < 3 && !result) {
      attempts++
      const message = await anthropic.messages.create({
        thinking: { type: 'disabled' },
        model,
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      })

      const textBlock = message.content.find((block) => block.type === 'text')
      const rawText = textBlock && 'text' in textBlock ? textBlock.text : '{}'
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      const safeCleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')

      try {
        const parsed = JSON.parse(safeCleaned)
        if (parsed?.checklist && Array.isArray(parsed.checklist) && parsed.checklist.length > 0) {
          result = parsed
        }
      } catch {
        // retry on parse failure too
      }
    }

    if (!result) {
      return NextResponse.json({ error: 'The AI had trouble generating this checklist. Please try again.' }, { status: 500 })
    }

    const moderationTexts = [
      ...(Array.isArray(result.checklist) ? result.checklist : []),
      ...(Array.isArray(result.prep) ? result.prep : []),
      ...(result.caption ? [result.caption] : []),
      ...(result.script ? [result.script] : []),
    ]
    const flaggedIndices = await moderateTexts(moderationTexts)
    if (flaggedIndices.size > 0) {
      return NextResponse.json({ error: 'Generated content did not pass our safety check. Please try again.' }, { status: 422 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('generate-checklist error:', error)
    return NextResponse.json({ error: 'Failed to generate checklist' }, { status: 500 })
  }
}
