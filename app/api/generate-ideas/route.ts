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

async function getPlan(userId: string | undefined): Promise<'basic' | 'mid' | 'top'> {
  if (!userId) return 'top'
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data || data.status !== 'active') return 'top' // no active subscription yet (pilot phase) -> full access
  if (data.plan === 'basic') return 'basic'
  if (data.plan === 'top') return 'top'
  return 'mid'
}

type SeasonalEvent = { name: string; windowDays: number } & (
  | { type: "fixed"; month: number; day: number }
  | { type: "nthWeekday"; month: number; weekday: number; n: number }
  | { type: "lastWeekday"; month: number; weekday: number }
  | { type: "easterOffset"; offsetDays: number }
)

// Computes the date of Easter Sunday for a given year (Meeus/Jones/Butcher Gregorian algorithm).
function computeEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

// weekday: 0=Sunday...6=Saturday. n: 1=first, 2=second, etc.
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstOfMonth = new Date(year, month - 1, 1)
  const firstWeekday = firstOfMonth.getDay()
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7
  return new Date(year, month - 1, day)
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastOfMonth = new Date(year, month, 0)
  const diff = (lastOfMonth.getDay() - weekday + 7) % 7
  return new Date(year, month - 1, lastOfMonth.getDate() - diff)
}

function getEventDate(e: SeasonalEvent, year: number): Date {
  if (e.type === "fixed") return new Date(year, e.month - 1, e.day)
  if (e.type === "nthWeekday") return nthWeekdayOfMonth(year, e.month, e.weekday, e.n)
  if (e.type === "lastWeekday") return lastWeekdayOfMonth(year, e.month, e.weekday)
  const easter = computeEaster(year)
  const d = new Date(easter)
  d.setDate(d.getDate() + e.offsetDays)
  return d
}

const AU_EVENTS: SeasonalEvent[] = [
  { name: "New Year", type: "fixed", month: 1, day: 1, windowDays: 14 },
  { name: "Australia Day", type: "fixed", month: 1, day: 26, windowDays: 21 },
  { name: "Valentine's Day", type: "fixed", month: 2, day: 14, windowDays: 21 },
  { name: "Easter", type: "easterOffset", offsetDays: 0, windowDays: 28 },
  { name: "ANZAC Day", type: "fixed", month: 4, day: 25, windowDays: 14 },
  { name: "Mother's Day", type: "nthWeekday", month: 5, weekday: 0, n: 2, windowDays: 21 },
  { name: "Winter school holidays", type: "fixed", month: 7, day: 1, windowDays: 21 },
  { name: "Father's Day", type: "nthWeekday", month: 9, weekday: 0, n: 1, windowDays: 21 },
  { name: "Halloween", type: "fixed", month: 10, day: 31, windowDays: 21 },
  { name: "Melbourne Cup", type: "nthWeekday", month: 11, weekday: 2, n: 1, windowDays: 14 },
  { name: "Christmas / EOFY holiday season", type: "fixed", month: 12, day: 25, windowDays: 35 },
]

const UK_EVENTS: SeasonalEvent[] = [
  { name: "New Year", type: "fixed", month: 1, day: 1, windowDays: 14 },
  { name: "Valentine's Day", type: "fixed", month: 2, day: 14, windowDays: 21 },
  { name: "Mother's Day (Mothering Sunday)", type: "easterOffset", offsetDays: -21, windowDays: 14 },
  { name: "Easter", type: "easterOffset", offsetDays: 0, windowDays: 28 },
  { name: "Father's Day", type: "nthWeekday", month: 6, weekday: 0, n: 3, windowDays: 21 },
  { name: "Halloween", type: "fixed", month: 10, day: 31, windowDays: 21 },
  { name: "Bonfire Night", type: "fixed", month: 11, day: 5, windowDays: 10 },
  { name: "Christmas", type: "fixed", month: 12, day: 25, windowDays: 35 },
]

const US_EVENTS: SeasonalEvent[] = [
  { name: "New Year", type: "fixed", month: 1, day: 1, windowDays: 14 },
  { name: "Valentine's Day", type: "fixed", month: 2, day: 14, windowDays: 21 },
  { name: "Easter", type: "easterOffset", offsetDays: 0, windowDays: 28 },
  { name: "Mother's Day", type: "nthWeekday", month: 5, weekday: 0, n: 2, windowDays: 21 },
  { name: "Memorial Day", type: "lastWeekday", month: 5, weekday: 1, windowDays: 14 },
  { name: "Father's Day", type: "nthWeekday", month: 6, weekday: 0, n: 3, windowDays: 21 },
  { name: "Independence Day", type: "fixed", month: 7, day: 4, windowDays: 14 },
  { name: "Labor Day", type: "nthWeekday", month: 9, weekday: 1, n: 1, windowDays: 14 },
  { name: "Halloween", type: "fixed", month: 10, day: 31, windowDays: 21 },
  { name: "Thanksgiving", type: "nthWeekday", month: 11, weekday: 4, n: 4, windowDays: 21 },
  { name: "Christmas", type: "fixed", month: 12, day: 25, windowDays: 35 },
]

function getEventsForCountry(country: string | null | undefined): SeasonalEvent[] {
  if (country === "UK") return UK_EVENTS
  if (country === "US") return US_EVENTS
  return AU_EVENTS
}

function isEventInWindow(e: SeasonalEvent, now: Date): boolean {
  const eventDate = getEventDate(e, now.getFullYear())
  const diffDays = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays >= -3 && diffDays <= e.windowDays
}

function getUpcomingSeasonalEvent(country: string | null | undefined): string | null {
  const now = new Date()
  const events = getEventsForCountry(country)
  for (const e of events) {
    if (isEventInWindow(e, now)) return e.name
  }
  return null
}

// Only lets the business owner's own free-text seasonal note through if it doesn't
// name a specific known holiday that has already passed for the year. Generic text
// ("summer is our busy season") always passes through unchanged. This stops a
// one-off mention like "Halloween promotions" from being fed to the AI year-round.
function filterSeasonalContext(text: string | null | undefined, country: string | null | undefined): string | null {
  if (!text || !text.trim()) return null
  const now = new Date()
  const lowerText = text.toLowerCase()
  const events = getEventsForCountry(country)
  for (const e of events) {
    const nameLower = e.name.toLowerCase()
    const mentioned = nameLower.split(/[\s/()]+/).some((word) => word.length > 3 && lowerText.includes(word))
    if (mentioned && !isEventInWindow(e, now)) {
      return null
    }
  }
  return text
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
    const effectiveCustomization = (plan === 'mid' || plan === 'top') ? customization : null
    const customNote = effectiveCustomization ? `\n\nAdditional guidance from the business owner (follow this, but never at the expense of safety, realism, or the constraints above):\n${effectiveCustomization}` : ''

    const ideaCount = (plan === 'mid' || plan === 'top') ? Math.max(1, Math.min(7, profile.videos_per_week || 6)) : 3
    const anglePool = (plan === 'mid' || plan === 'top') ? [...BASIC_ANGLES, ...MID_EXTRA_ANGLES] : BASIC_ANGLES
    const angles = pickAngles(anglePool, ideaCount)
    const angleLines = angles.map((a, i) => `${i + 1}. ${a}`).join('\n')

    const locationType = profile.location_type || 'fixed'
    const locationGuidance = locationType === 'mobile'
      ? "This business is MOBILE  -  they travel to customers rather than customers visiting a shop. Do NOT suggest ideas that rely on a physical storefront, shop interior, or 'come visit us at our location' framing. Instead lean into what's always with them: their van/vehicle, tools, uniform, expertise, and opinions. Local suburb mentions should reference their general service area, not a specific address customers can visit."
      : locationType === 'both'
      ? "This business operates BOTH from a fixed location AND travels to customers. Ideas can reference their shop/studio space when relevant, but don't assume every idea needs to happen at a fixed premises  -  some should work anywhere (van, tools, expertise)."
      : "This business operates from a FIXED location that customers visit. Feel free to suggest ideas that show their shop/studio space, ambiance, and physical setup where relevant, alongside expertise-based ideas."

    const upcomingEvent = getUpcomingSeasonalEvent(profile.country)
    const filteredSeasonalContext = filterSeasonalContext(profile.local_seasonal_context, profile.country)
    const ownSeasonalNote = filteredSeasonalContext ? ` The business owner also says their own busy/relevant times are: ${filteredSeasonalContext}.` : ""
    const countryLabel = profile.country === "UK" ? "the UK" : profile.country === "US" ? "the US" : "Australia"
    const seasonalGuidance = (upcomingEvent || ownSeasonalNote)
      ? `SEASONAL AWARENESS (optional, use only where it genuinely fits  -  do not force every idea to be seasonal): ${upcomingEvent ? `${upcomingEvent} is coming up soon in ${countryLabel}.` : ""}${ownSeasonalNote} If one of the ${ideaCount} ideas can naturally tie into this without feeling forced or gimmicky, do so for at most one idea  -  the rest should stay on the evergreen angles listed below.`
      : ""
    const prompt = `You help busy small business owners in Sydney create short-form social media content by themselves, alone, on their phone, in a few spare minutes. They are NOT content creators, have NO crew, and NO time to spare.

CRITICAL CONSTRAINT  -  read this carefully: this business owner CANNOT control or predict what job, customer, or scenario will show up on any given day. Never invent or narrate a SPECIFIC fictional customer, address, or live job as if it is happening right now (e.g. never write something like "I just arrived at a place in Coogee where the customer..." or "we're at a house right now where..."). That is dishonest content and impossible to guarantee they can film that day.

If the business owner's style guidance below asks for a "problem → solution" format, that is fine and encouraged  -  but the problem must be framed as a COMMON, GENERAL problem this business sees all the time (e.g. "One thing I get called out for constantly is...", "If your power keeps tripping, here's usually why...", "Say your switchboard does this  -  here's what's going on"), never as a specific customer or job happening at this exact moment. This way it's honest, always true, and filmable today regardless of what's actually on the schedule.

IMPORTANT  -  factual accuracy: you are not a domain expert in this business's trade, so NEVER state a specific technical fact, cause, diagnosis, safety claim, or "why" answer yourself (e.g. never assert a specific electrical fault cause, a specific health/legal claim, or any specific technical explanation). If an idea involves explaining a cause, reason, or technical detail, write the hook so it sets up the topic and then hands off to the business owner to explain the specific technical answer themselves, in their own words, since they are the actual expert  -  for example "explain what usually causes this in your own words" rather than stating a cause yourself. This keeps every video factually safe regardless of the industry.

Business: ${profile.business_name}
Industry: ${profile.industry}
Suburb: ${profile.suburb}
Tone: ${profile.tone || 'not specified'}
Ideal customer: ${profile.target_audience || 'not specified'}
Core services: ${profile.core_services || 'not specified'}
${profile.brand_personality ? `Brand personality: ${profile.brand_personality}` : ""}
${profile.words_to_avoid ? `Words/phrases to avoid: ${profile.words_to_avoid}` : ""}
${profile.signature_service ? `Signature service they're known for: ${profile.signature_service}` : ""}
${profile.common_objections ? `Common objections/hesitations customers have: ${profile.common_objections}` : ""}
${profile.current_promotions ? `Current promotions/offers: ${profile.current_promotions}` : ""}
${profile.customer_problem ? `The core problem customers come to them with: ${profile.customer_problem}` : ""}
LOCATION TYPE: ${locationGuidance}

${seasonalGuidance}

Generate exactly ${ideaCount} ideas. Each of the ${ideaCount} ideas must be built around one of these specific angles (use exactly one angle per idea, in this order, and make each idea concretely and specifically about THIS business's actual services and customers listed above  -  not generic industry advice that could apply to any business in this trade):
${angleLines}

Each video should be 15-30 seconds, filmable in one continuous take, alone, on a phone, with zero setup beyond what's already in their normal workspace. Zero editing skill required beyond what Reelezy automatically handles (captions, trimming, music).

For each idea, provide:
- A short, specific title referencing a real detail from this business (not a generic template title  -  avoid phrases like "Behind the scenes", "Day in the life", "3 quick tips" unless the content genuinely is a numbered list)
- A one-sentence hook: literally what to say or do in the first 3 seconds, in plain words, specific to this business, following the CRITICAL CONSTRAINT above
- A one-sentence description of the actual point or payoff of the video  -  what it communicates or the actual answer/opinion/tip being shared. This is NOT staging or camera direction (never write things like 'start at the van' or 'walk toward X' here  -  that belongs in filming instructions elsewhere). If the angle is a personal opinion, preference, or general tip (not a technical diagnosis), state the actual specific answer or opinion here, don't leave it vague  -  only technical/diagnostic causes should be left for the business owner to explain themselves.
- 3-4 relevant hashtags, including the suburb where natural

${customNote}


If the business has listed words/phrases to avoid, current promotions, a signature service, common customer objections, brand personality, or a core customer problem above, weave these in naturally where relevant - they should meaningfully shape the ideas, not just sit unused.

IMPORTANT JSON FORMATTING RULE: never use a double-quote character (") anywhere inside any string value (e.g. if quoting what someone says or a phrase, use single quotes ' ' instead). This is critical for valid JSON output.
Respond ONLY with valid JSON, no markdown formatting, no code fences, in this exact structure:
[
  { "title": "...", "hook": "...", "description": "...", "tags": "#tag1 #tag2 #tag3" }
]`

    const model = (plan === 'mid' || plan === 'top') ? 'claude-sonnet-5' : 'claude-haiku-4-5'

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

    const moderationTexts = ideas.map((idea: { title: string; hook: string; description: string }) =>
      `${idea.title}. ${idea.hook} ${idea.description}`
    )
    const flaggedIndices = await moderateTexts(moderationTexts)
    const safeIdeas = ideas.filter((_: unknown, i: number) => !flaggedIndices.has(i))

    if (safeIdeas.length === 0 && ideas.length > 0) {
      return NextResponse.json({ error: 'Generated content did not pass our safety check. Please try again.' }, { status: 422 })
    }

    return NextResponse.json({ ideas: safeIdeas, plan, usage: usageInfo })
  } catch (error) {
    console.error('generate-ideas error:', error)
    return NextResponse.json({ error: 'Failed to generate ideas' }, { status: 500 })
  }
}
