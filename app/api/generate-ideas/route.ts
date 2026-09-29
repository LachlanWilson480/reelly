import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { moderateTexts } from '@/lib/moderateContent'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASIC_ANGLES = [
  "answer a question customers ask you all the time, on camera, in your own words",
  "explain one thing most customers get wrong or don't know about your industry",
  "show and narrate one specific tool, product, or part of your setup and why you use it",
  "give one genuinely useful tip anyone could use, related to your work",
  "talk through how you decide pricing or what affects cost for a typical job",
  "share one opinion or preference you have in your trade and why (e.g. a method, brand, or approach you favour)",
  "explain what a first-time customer should expect when they come to you",
  "bust a common myth or misconception about your industry",
  "talk about something you wish more customers knew before booking",
  "give a 3-step breakdown of part of your process, explained simply",
]

const MID_EXTRA_ANGLES = [
  "compare two options/approaches customers often choose between, and explain how you'd help them decide",
  "tell a quick, honest story about a mistake or lesson learned early in your career",
  "explain the difference between a cheap/DIY approach and a professional one for something in your trade",
  "share a 'what I look for' checklist when assessing a new job or project",
  "explain what makes your approach or business different from others in the same trade",
  "answer a question you wish customers asked, but usually don't",
  "give a seasonal tip relevant to the time of year for your trade",
  "explain a term or piece of jargon from your industry that confuses customers",
]

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

type SeasonalEvent = { name: string; windowDays: number; micro?: boolean } & (
  | { type: 'fixed'; month: number; day: number }
  | { type: 'nthWeekday'; month: number; weekday: number; n: number }
  | { type: 'lastWeekday'; month: number; weekday: number }
  | { type: 'easterOffset'; offsetDays: number }
)

function computeEaster(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month - 1, 1)
  const day = 1 + ((weekday - first.getDay() + 7) % 7) + (n - 1) * 7
  return new Date(year, month - 1, day)
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month, 0)
  const diff = (last.getDay() - weekday + 7) % 7
  return new Date(year, month - 1, last.getDate() - diff)
}

function getEventDate(e: SeasonalEvent, year: number): Date {
  if (e.type === 'fixed') return new Date(year, e.month - 1, e.day)
  if (e.type === 'nthWeekday') return nthWeekdayOfMonth(year, e.month, e.weekday, e.n)
  if (e.type === 'lastWeekday') return lastWeekdayOfMonth(year, e.month, e.weekday)
  const easter = computeEaster(year)
  const d = new Date(easter)
  d.setDate(d.getDate() + e.offsetDays)
  return d
}

// Major civic/retail events per country
const AU_EVENTS: SeasonalEvent[] = [
  { name: 'New Year', type: 'fixed', month: 1, day: 1, windowDays: 14 },
  { name: 'Australia Day', type: 'fixed', month: 1, day: 26, windowDays: 21 },
  { name: "Valentine's Day", type: 'fixed', month: 2, day: 14, windowDays: 21 },
  { name: 'Easter', type: 'easterOffset', offsetDays: 0, windowDays: 28 },
  { name: 'ANZAC Day', type: 'fixed', month: 4, day: 25, windowDays: 14 },
  { name: "Mother's Day", type: 'nthWeekday', month: 5, weekday: 0, n: 2, windowDays: 21 },
  { name: 'Winter school holidays', type: 'fixed', month: 7, day: 1, windowDays: 21 },
  { name: "Father's Day", type: 'nthWeekday', month: 9, weekday: 0, n: 1, windowDays: 21 },
  { name: 'Halloween', type: 'fixed', month: 10, day: 31, windowDays: 21 },
  { name: 'Melbourne Cup', type: 'nthWeekday', month: 11, weekday: 2, n: 1, windowDays: 14 },
  { name: 'Christmas / end-of-year holiday season', type: 'fixed', month: 12, day: 25, windowDays: 35 },
]

const UK_EVENTS: SeasonalEvent[] = [
  { name: 'New Year', type: 'fixed', month: 1, day: 1, windowDays: 14 },
  { name: "Valentine's Day", type: 'fixed', month: 2, day: 14, windowDays: 21 },
  { name: "Mother's Day (Mothering Sunday)", type: 'easterOffset', offsetDays: -21, windowDays: 14 },
  { name: 'Easter', type: 'easterOffset', offsetDays: 0, windowDays: 28 },
  { name: "Father's Day", type: 'nthWeekday', month: 6, weekday: 0, n: 3, windowDays: 21 },
  { name: 'Halloween', type: 'fixed', month: 10, day: 31, windowDays: 21 },
  { name: 'Bonfire Night', type: 'fixed', month: 11, day: 5, windowDays: 10 },
  { name: 'Christmas', type: 'fixed', month: 12, day: 25, windowDays: 35 },
]

const US_EVENTS: SeasonalEvent[] = [
  { name: 'New Year', type: 'fixed', month: 1, day: 1, windowDays: 14 },
  { name: "Valentine's Day", type: 'fixed', month: 2, day: 14, windowDays: 21 },
  { name: 'Easter', type: 'easterOffset', offsetDays: 0, windowDays: 28 },
  { name: "Mother's Day", type: 'nthWeekday', month: 5, weekday: 0, n: 2, windowDays: 21 },
  { name: 'Memorial Day', type: 'lastWeekday', month: 5, weekday: 1, windowDays: 14 },
  { name: "Father's Day", type: 'nthWeekday', month: 6, weekday: 0, n: 3, windowDays: 21 },
  { name: 'Independence Day', type: 'fixed', month: 7, day: 4, windowDays: 14 },
  { name: 'Labor Day', type: 'nthWeekday', month: 9, weekday: 1, n: 1, windowDays: 14 },
  { name: 'Halloween', type: 'fixed', month: 10, day: 31, windowDays: 21 },
  { name: 'Thanksgiving', type: 'nthWeekday', month: 11, weekday: 4, n: 4, windowDays: 21 },
  { name: 'Christmas', type: 'fixed', month: 12, day: 25, windowDays: 35 },
]

// Micro/social days — global, relevant across all countries
// micro: true means tighter window and lower priority (only surface if no major event active)
const MICRO_EVENTS: SeasonalEvent[] = [
  { name: 'Pancake Day (Shrove Tuesday)', type: 'easterOffset', offsetDays: -47, windowDays: 7, micro: true },
  { name: 'International Women\'s Day', type: 'fixed', month: 3, day: 8, windowDays: 7, micro: true },
  { name: 'World Sleep Day', type: 'fixed', month: 3, day: 15, windowDays: 5, micro: true },
  { name: 'Earth Day', type: 'fixed', month: 4, day: 22, windowDays: 7, micro: true },
  { name: 'Mental Health Awareness Week', type: 'fixed', month: 5, day: 13, windowDays: 7, micro: true },
  { name: 'World Environment Day', type: 'fixed', month: 6, day: 5, windowDays: 5, micro: true },
  { name: 'International Friendship Day', type: 'fixed', month: 7, day: 30, windowDays: 5, micro: true },
  { name: 'World Mental Health Day', type: 'fixed', month: 10, day: 10, windowDays: 7, micro: true },
  { name: 'Small Business Saturday', type: 'fixed', month: 11, day: 30, windowDays: 7, micro: true },
  { name: 'Black Friday / Cyber Monday', type: 'nthWeekday', month: 11, weekday: 5, n: 4, windowDays: 7, micro: true },
  { name: "New Year's Eve", type: 'fixed', month: 12, day: 31, windowDays: 5, micro: true },
]

function getEventsForCountry(country: string | null | undefined): SeasonalEvent[] {
  const major = country === 'UK' ? UK_EVENTS : country === 'US' ? US_EVENTS : AU_EVENTS
  return [...major, ...MICRO_EVENTS]
}

function isEventInWindow(e: SeasonalEvent, now: Date): boolean {
  const eventDate = getEventDate(e, now.getFullYear())
  const diffDays = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays >= -3 && diffDays <= e.windowDays
}

// Returns up to 2 upcoming events: first available major, then first available micro (if different)
function getUpcomingEvents(country: string | null | undefined): { major: string | null; micro: string | null } {
  const now = new Date()
  const all = getEventsForCountry(country)
  let major: string | null = null
  let micro: string | null = null
  for (const e of all) {
    if (!isEventInWindow(e, now)) continue
    if (e.micro && !micro) micro = e.name
    if (!e.micro && !major) major = e.name
    if (major && micro) break
  }
  return { major, micro }
}

function filterSeasonalContext(text: string | null | undefined, country: string | null | undefined): string | null {
  if (!text?.trim()) return null
  const now = new Date()
  const lowerText = text.toLowerCase()
  const events = getEventsForCountry(country)
  for (const e of events) {
    const nameLower = e.name.toLowerCase()
    const mentioned = nameLower.split(/[\s/()]+/).some((w) => w.length > 3 && lowerText.includes(w))
    if (mentioned && !isEventInWindow(e, now)) return null
  }
  return text
}

function pickAngles(pool: string[], count: number): string[] {
  return [...pool].sort(() => Math.random() - 0.5).slice(0, count)
}

// Compresses all 30+ profile fields into a tight brief.
// Skips empty/null fields entirely. Shortens labels to save tokens.
// Groups fields so Claude understands which are high-signal vs context.
function compressProfile(profile: Record<string, string | null | undefined>): string {
  const lines: string[] = []

  // Core identity — always present
  const core: Array<[string, string | null | undefined]> = [
    ['Biz', profile.business_name],
    ['Industry', profile.industry],
    ['Suburb', profile.suburb],
    ['Tone', profile.tone],
    ['Audience', profile.target_audience],
    ['Services', profile.core_services],
  ]
  for (const [k, v] of core) {
    if (v?.trim()) lines.push(`${k}: ${v.trim()}`)
  }

  // Brand & voice
  const brand: Array<[string, string | null | undefined]> = [
    ['Brand personality', profile.brand_personality],
    ['Avoid', profile.words_to_avoid],
    ['Taglines', profile.taglines],
    ['Ref brand', profile.reference_brand],
    ['Aesthetic', profile.brand_colors],
  ]
  const brandLines = brand.filter(([, v]) => v?.trim()).map(([k, v]) => `${k}: ${v!.trim()}`)
  if (brandLines.length) lines.push('BRAND: ' + brandLines.join(' | '))

  // Business context
  const biz: Array<[string, string | null | undefined]> = [
    ['Yrs', profile.years_in_business],
    ['Team', profile.team_size],
    ['Price', profile.price_positioning],
    ['Source', profile.customer_source],
    ['Website', profile.website],
  ]
  const bizLines = biz.filter(([, v]) => v?.trim()).map(([k, v]) => `${k}: ${v!.trim()}`)
  if (bizLines.length) lines.push('BIZ: ' + bizLines.join(' | '))

  // Audience & selling
  const sell: Array<[string, string | null | undefined]> = [
    ['Problem', profile.customer_problem],
    ['Objections', profile.common_objections],
    ['Signature', profile.signature_service],
    ['USP', profile.key_selling_point],
    ['Promos', profile.current_promotions],
    ['Launches', profile.upcoming_launches],
  ]
  for (const [k, v] of sell) {
    if (v?.trim()) lines.push(`${k}: ${v.trim()}`)
  }

  // Content history
  const content: Array<[string, string | null | undefined]> = [
    ['BestContent', profile.past_content],
    ['AvoidContent', profile.worst_content],
    ['Formats', profile.preferred_formats],
    ['PostFreq', profile.posting_frequency],
    ['CompetitorAdmire', profile.competitor_content],
  ]
  const contentLines = content.filter(([, v]) => v?.trim()).map(([k, v]) => `${k}: ${v!.trim()}`)
  if (contentLines.length) lines.push('CONTENT HISTORY: ' + contentLines.join(' | '))

  // Filming logistics
  const film: Array<[string, string | null | undefined]> = [
    ['Gear', profile.equipment],
    ['BestTimes', profile.best_filming_times],
    ['Comfort', profile.filming_comfort],
  ]
  const filmLines = film.filter(([, v]) => v?.trim()).map(([k, v]) => `${k}: ${v!.trim()}`)
  if (filmLines.length) lines.push('FILMING: ' + filmLines.join(' | '))

  // Local & extra
  const local: Array<[string, string | null | undefined]> = [
    ['Community', profile.community_ties],
    ['Notes', profile.notes],
  ]
  for (const [k, v] of local) {
    if (v?.trim()) lines.push(`${k}: ${v.trim()}`)
  }

  return lines.join('\n')
}

const BASIC_BATCH_SIZE = 3
const PRO_BATCH_SIZE = 5
const PREMIUM_BATCH_SIZE = 7

const BASIC_WEEKLY_LIMIT = 24
const PRO_WEEKLY_LIMIT = 98
const PREMIUM_WEEKLY_LIMIT = 210

const TOKENS_PER_CARD = 250
const TOKEN_BUFFER = 200

export async function POST(req: NextRequest) {
  try {
    const { profile, customization, userId, peopleCountOverride } = await req.json()

    if (!profile || !profile.business_name?.trim() || !profile.industry?.trim()) {
      return NextResponse.json(
        { error: 'Please complete your business profile before generating ideas.' },
        { status: 400 }
      )
    }

    const plan = await getPlan(userId)
    const batchSize = plan === 'top' ? PREMIUM_BATCH_SIZE : plan === 'mid' ? PRO_BATCH_SIZE : BASIC_BATCH_SIZE
    const weeklyLimit = plan === 'top' ? PREMIUM_WEEKLY_LIMIT : plan === 'mid' ? PRO_WEEKLY_LIMIT : BASIC_WEEKLY_LIMIT
    const maxTokens = batchSize * TOKENS_PER_CARD + TOKEN_BUFFER

    let keyEventsContext = ''
    let pastIdeasContext = ''
    if (userId) {
      const { data: recentEvents } = await supabaseAdmin
        .from('key_events')
        .select('event_text')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
      if (recentEvents?.length) {
        keyEventsContext = recentEvents.map((e) => `- ${e.event_text}`).join('\n')
      }

      const { data: recentIdeas } = await supabaseAdmin
        .from('generated_ideas')
        .select('title')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)
      if (recentIdeas?.length) {
        pastIdeasContext = recentIdeas.map((i) => `- ${i.title}`).join('\n')
      }
    }

    // Weekly usage enforcement
    let usageInfo: { used: number; limit: number } | null = null
    if (userId) {
      const { data: usageRow } = await supabaseAdmin
        .from('business_profiles')
        .select('ideas_generated_this_week, usage_reset_at')
        .eq('user_id', userId)
        .maybeSingle()

      const now = new Date()
      const daysSinceMonday = (now.getDay() + 6) % 7
      const mostRecentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday, 0, 0, 0, 0)
      const resetAt = usageRow?.usage_reset_at ? new Date(usageRow.usage_reset_at) : null
      const needsReset = !resetAt || resetAt.getTime() < mostRecentMonday.getTime()
      const currentCount = needsReset ? 0 : (usageRow?.ideas_generated_this_week || 0)

      if (currentCount + batchSize > weeklyLimit) {
        const planLabel = plan === 'top' ? 'Premium' : plan === 'mid' ? 'Pro' : 'Basic'
        return NextResponse.json(
          { error: `You've reached your limit of ${weeklyLimit} ideas generated this week on the ${planLabel} plan. Upgrade for a higher weekly limit.` },
          { status: 403 }
        )
      }

      await supabaseAdmin
        .from('business_profiles')
        .update({
          ideas_generated_this_week: currentCount + batchSize,
          usage_reset_at: needsReset ? now.toISOString() : (usageRow?.usage_reset_at || now.toISOString()),
        })
        .eq('user_id', userId)
      usageInfo = { used: currentCount + batchSize, limit: weeklyLimit }
    }

    const effectiveCustomization = (plan === 'mid' || plan === 'top') ? customization : null
    const anglePool = (plan === 'mid' || plan === 'top') ? [...BASIC_ANGLES, ...MID_EXTRA_ANGLES] : BASIC_ANGLES
    const angles = pickAngles(anglePool, batchSize)
    const angleLines = angles.map((a, i) => `${i + 1}. ${a}`).join('\n')

    // Location
    const locationType = profile.location_type || 'fixed'
    const locationBrief =
      locationType === 'mobile' ? 'MOBILE — travels to customers, no storefront; use van/tools/expertise'
      : locationType === 'both' ? 'BOTH fixed + mobile — shop ok but not assumed'
      : 'FIXED shop/studio — customers visit; showing space is fine'

    // Seasonal — major + micro, only what's actually upcoming
    const { major: majorEvent, micro: microEvent } = getUpcomingEvents(profile.country)
    const filteredOwnerSeasonal = filterSeasonalContext(profile.local_seasonal_context, profile.country)
    const countryLabel = profile.country === 'UK' ? 'UK' : profile.country === 'US' ? 'US' : 'AU'

    const seasonalParts: string[] = []
    if (majorEvent) seasonalParts.push(`Major: ${majorEvent} (${countryLabel}) — use for at most 1 idea if it genuinely fits`)
    if (microEvent && microEvent !== majorEvent) seasonalParts.push(`Social day: ${microEvent} — use only if naturally relevant to this business`)
    if (filteredOwnerSeasonal) seasonalParts.push(`Owner's busy season note: ${filteredOwnerSeasonal}`)
    const seasonalBlock = seasonalParts.length
      ? `SEASONAL (all others stay evergreen):\n${seasonalParts.join('\n')}`
      : ''

    // People on camera
    const onCameraPeople = (profile.on_camera_people || '').trim()
    const peopleList = onCameraPeople ? onCameraPeople.split(/[,&]|and/i).map((p: string) => p.trim()).filter(Boolean) : []
    const effectivePeopleCount = typeof peopleCountOverride === 'number' && peopleCountOverride > 0 ? peopleCountOverride : peopleList.length
    const isMultiPerson = effectivePeopleCount > 1
    const namesForPrompt = typeof peopleCountOverride === 'number' && peopleCountOverride > 0 && peopleList.length !== effectivePeopleCount ? '' : onCameraPeople
    const crewLine = isMultiPerson
      ? `Camera: up to ${effectivePeopleCount} people${namesForPrompt ? ` (${namesForPrompt})` : ''} — multi-person ideas ok where natural`
      : 'Camera: films ALONE on phone'

    const profileBrief = compressProfile(profile)

    const prompt = `Generate exactly ${batchSize} short-form social video ideas. Return all ${batchSize} as one JSON array.

BUSINESS:
${profileBrief}
${crewLine}
Location: ${locationBrief}
${seasonalBlock ? `\n${seasonalBlock}` : ''}
${keyEventsContext ? `\nRecent biz events (weave in at most 1 idea):\n${keyEventsContext}` : ''}
${pastIdeasContext ? `\nDo NOT repeat these already-generated angles:\n${pastIdeasContext}` : ''}
${effectiveCustomization ? `\nOwner guidance (follow unless unsafe): ${effectiveCustomization}` : ''}

HOW TO USE THE BRIEF:
- Tone, Brand personality, Avoid, Taglines → shape voice/style of every idea
- Signature, USP, Problem, Objections, Promos → lean into these as the content subject where the angle fits
- BestContent/Formats → match what has worked; AvoidContent → don't repeat those angles
- Gear/Comfort → never suggest anything beyond what they have or can do
- Community, Suburb → add local flavour where natural, not forced
- Website/Instagram/TikTok → ignore for idea generation (not relevant)

HARD RULES:
- Never invent a specific fictional customer, address, or live job. Frame problems as common/general ("One thing I get called out for all the time..." not "I just arrived at a house in Bondi where...")
- Never state specific technical facts or diagnoses yourself — set up the topic and let the owner explain in their own words
- 15-30 sec per video, one take, phone, no extra setup beyond normal workspace
- Title must reference a real business detail — no generic templates ("Behind the scenes", "Day in the life" unless content genuinely is that)
- Keep each field brief: title <10 words, hook <20 words, description <25 words
- Use single quotes inside strings, never double quotes

ANGLES — assign exactly one per idea, in this order:
${angleLines}

Output ONLY a valid JSON array, no markdown, no code fences:
[
  { "title": "...", "hook": "...", "description": "...", "tags": "#tag1 #tag2 #tag3" }
]`

    const model = (plan === 'mid' || plan === 'top') ? 'claude-sonnet-5' : 'claude-haiku-4-5'

    const message = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '[]'
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const safeCleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')
    const ideas = JSON.parse(safeCleaned)

    if (!Array.isArray(ideas) || ideas.length === 0) {
      console.error('generate-ideas: no ideas returned. Raw:', rawText)
      return NextResponse.json({ error: 'The AI had trouble generating ideas this time. Please try again.' }, { status: 500 })
    }

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
