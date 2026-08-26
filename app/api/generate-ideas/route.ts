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

const BASIC_ANGLES = [
  'answer a question customers ask you all the time, on camera, in your own words',
  'explain one thing most customers get wrong or don\'t know about your industry',
  'show and narrate one specific tool, product, or part of your setup and why you use it',
  'give one genuinely useful tip anyone could use, related to your work',
  'talk through how you decide pricing or what affects cost for a typical job',
  'share one opinion or preference you have in your trade and why (e.g. a method, brand, or approach you favour)',
  'explain what a first-time customer should expect when they come to you',
  'bust a common myth or misconception about your industry',
  'talk about something you wish more customers knew before booking',
  'give a 3-step breakdown of part of your process, explained simply',
]

const MID_EXTRA_ANGLES = [
  'compare two options/approaches customers often choose between, and explain how you\'d help them decide',
  'tell a quick, honest story about a mistake or lesson learned early in your career',
  'explain the difference between a cheap/DIY approach and a professional one for something in your trade',
  'share a "what I look for" checklist when assessing a new job or project',
  'explain what makes your approach or business different from others in the same trade',
  'answer a question you wish customers asked, but usually don\'t',
  'give a seasonal tip relevant to the time of year for your trade',
  'explain a term or piece of jargon from your industry that confuses customers',
]

async function getPlan(userId: string | undefined): Promise<'basic' | 'mid'> {
  if (!userId) return 'mid'
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data || data.status !== 'active') return 'mid' // no active subscription yet (pilot phase) -> full access
  return data.plan === 'basic' ? 'basic' : 'mid'
}

function pickAngles(pool: string[], count: number): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

const WEEKLY_BASIC_LIMIT = 3

export async function POST(req: NextRequest) {
  try {
    const { profile, customization, userId } = await req.json()

    const plan = await getPlan(userId)

    // Weekly usage limit enforcement for Basic plan only
    let usageInfo: { used: number; limit: number } | null = null
    if (plan === 'basic' && userId) {
      const { data: usageRow } = await supabaseAdmin
        .from('business_profiles')
        .select('ideas_generated_this_week, usage_reset_at')
        .eq('user_id', userId)
        .maybeSingle()

      const now = new Date()
      const resetAt = usageRow?.usage_reset_at ? new Date(usageRow.usage_reset_at) : now
      const weekMs = 7 * 24 * 60 * 60 * 1000
      const needsReset = now.getTime() - resetAt.getTime() > weekMs
      const currentCount = needsReset ? 0 : (usageRow?.ideas_generated_this_week || 0)

      if (currentCount >= WEEKLY_BASIC_LIMIT) {
        return NextResponse.json(
          { error: `You've used all ${WEEKLY_BASIC_LIMIT} idea generations for this week on the Basic plan. Upgrade to Mid for unlimited generations.` },
          { status: 403 }
        )
      }

      await supabaseAdmin
        .from('business_profiles')
        .update({
          ideas_generated_this_week: currentCount + 1,
          usage_reset_at: needsReset ? now.toISOString() : (usageRow?.usage_reset_at || now.toISOString()),
        })
        .eq('user_id', userId)
      usageInfo = { used: currentCount + 1, limit: WEEKLY_BASIC_LIMIT }
    }

    // Basic plan: custom guidance is a Mid-only feature, ignore it if somehow present
    const effectiveCustomization = plan === 'mid' ? customization : null
    const customNote = effectiveCustomization ? `\n\nAdditional guidance from the business owner (follow this, but never at the expense of safety, realism, or the constraints above):\n${effectiveCustomization}` : ''

    const ideaCount = plan === 'mid' ? Math.max(1, Math.min(7, profile.videos_per_week || 6)) : 3
    const anglePool = plan === 'mid' ? [...BASIC_ANGLES, ...MID_EXTRA_ANGLES] : BASIC_ANGLES
    const angles = pickAngles(anglePool, ideaCount)
    const angleLines = angles.map((a, i) => `${i + 1}. ${a}`).join('\n')

    const locationType = profile.location_type || 'fixed'
    const locationGuidance = locationType === 'mobile'
      ? "This business is MOBILE — they travel to customers rather than customers visiting a shop. Do NOT suggest ideas that rely on a physical storefront, shop interior, or 'come visit us at our location' framing. Instead lean into what's always with them: their van/vehicle, tools, uniform, expertise, and opinions. Local suburb mentions should reference their general service area, not a specific address customers can visit."
      : locationType === 'both'
      ? "This business operates BOTH from a fixed location AND travels to customers. Ideas can reference their shop/studio space when relevant, but don't assume every idea needs to happen at a fixed premises — some should work anywhere (van, tools, expertise)."
      : "This business operates from a FIXED location that customers visit. Feel free to suggest ideas that show their shop/studio space, ambiance, and physical setup where relevant, alongside expertise-based ideas."
    const prompt = `You help busy small business owners in Sydney create short-form social media content by themselves, alone, on their phone, in a few spare minutes. They are NOT content creators, have NO crew, and NO time to spare.

CRITICAL CONSTRAINT — read this carefully: this business owner CANNOT control or predict what job, customer, or scenario will show up on any given day. Never invent or narrate a SPECIFIC fictional customer, address, or live job as if it is happening right now (e.g. never write something like "I just arrived at a place in Coogee where the customer..." or "we're at a house right now where..."). That is dishonest content and impossible to guarantee they can film that day.

If the business owner's style guidance below asks for a "problem → solution" format, that is fine and encouraged — but the problem must be framed as a COMMON, GENERAL problem this business sees all the time (e.g. "One thing I get called out for constantly is...", "If your power keeps tripping, here's usually why...", "Say your switchboard does this — here's what's going on"), never as a specific customer or job happening at this exact moment. This way it's honest, always true, and filmable today regardless of what's actually on the schedule.

IMPORTANT — factual accuracy: you are not a domain expert in this business's trade, so NEVER state a specific technical fact, cause, diagnosis, safety claim, or "why" answer yourself (e.g. never assert a specific electrical fault cause, a specific health/legal claim, or any specific technical explanation). If an idea involves explaining a cause, reason, or technical detail, write the hook so it sets up the topic and then hands off to the business owner to explain the specific technical answer themselves, in their own words, since they are the actual expert — for example "explain what usually causes this in your own words" rather than stating a cause yourself. This keeps every video factually safe regardless of the industry.

Business: ${profile.business_name}
Industry: ${profile.industry}
Suburb: ${profile.suburb}
Tone: ${profile.tone || 'not specified'}
Ideal customer: ${profile.target_audience || 'not specified'}
Core services: ${profile.core_services || 'not specified'}

LOCATION TYPE: ${locationGuidance}
Generate exactly ${ideaCount} ideas. Each of the ${ideaCount} ideas must be built around one of these specific angles (use exactly one angle per idea, in this order, and make each idea concretely and specifically about THIS business's actual services and customers listed above — not generic industry advice that could apply to any business in this trade):
${angleLines}

Each video should be 15-30 seconds, filmable in one continuous take, alone, on a phone, with zero setup beyond what's already in their normal workspace. Zero editing skill required beyond what Reelly automatically handles (captions, trimming, music).

For each idea, provide:
- A short, specific title referencing a real detail from this business (not a generic template title — avoid phrases like "Behind the scenes", "Day in the life", "3 quick tips" unless the content genuinely is a numbered list)
- A one-sentence hook: literally what to say or do in the first 3 seconds, in plain words, specific to this business, following the CRITICAL CONSTRAINT above
- A one-sentence description of the actual point or payoff of the video — what it communicates or the actual answer/opinion/tip being shared. This is NOT staging or camera direction (never write things like 'start at the van' or 'walk toward X' here — that belongs in filming instructions elsewhere). If the angle is a personal opinion, preference, or general tip (not a technical diagnosis), state the actual specific answer or opinion here, don't leave it vague — only technical/diagnostic causes should be left for the business owner to explain themselves.
- 3-4 relevant hashtags, including the suburb where natural

${customNote}

IMPORTANT JSON FORMATTING RULE: never use a double-quote character (") anywhere inside any string value (e.g. if quoting what someone says or a phrase, use single quotes ' ' instead). This is critical for valid JSON output.
Respond ONLY with valid JSON, no markdown formatting, no code fences, in this exact structure:
[
  { "title": "...", "hook": "...", "description": "...", "tags": "#tag1 #tag2 #tag3" }
]`

    const model = plan === 'mid' ? 'claude-sonnet-5' : 'claude-haiku-4-5'

    const message = await anthropic.messages.create({
      model,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '[]'
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const safeCleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')
    const ideas = JSON.parse(safeCleaned)
    return NextResponse.json({ ideas, plan, usage: usageInfo })
  } catch (error) {
    console.error('generate-ideas error:', error)
    return NextResponse.json({ error: 'Failed to generate ideas' }, { status: 500 })
  }
}
