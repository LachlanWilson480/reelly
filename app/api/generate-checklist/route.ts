import { rateLimit } from '@/lib/rateLimit'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { moderateTexts } from '@/lib/moderateContent'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

// Only the fields relevant to HOW to film — not business strategy or content history.
// Keeps the checklist prompt lean while retaining everything that affects delivery.
function compressProfileForChecklist(profile: Record<string, string | null | undefined>): string {
  const lines: string[] = []

  // Identity — sets tone and context for the filming coach
  const core: Array<[string, string | null | undefined]> = [
    ['Biz', profile.business_name],
    ['Industry', profile.industry],
    ['Suburb', profile.suburb],
    ['Tone', profile.tone],
  ]
  for (const [k, v] of core) {
    if (v?.trim()) lines.push(`${k}: ${v.trim()}`)
  }

  // Voice & brand — shapes how dialogue is written
  const brand: Array<[string, string | null | undefined]> = [
    ['Brand personality', profile.brand_personality],
    ['Avoid', profile.words_to_avoid],
    ['Taglines', profile.taglines],
  ]
  const brandLines = brand.filter(([, v]) => v?.trim()).map(([k, v]) => `${k}: ${v!.trim()}`)
  if (brandLines.length) lines.push('BRAND: ' + brandLines.join(' | '))

  // Filming logistics — directly affects step instructions
  const film: Array<[string, string | null | undefined]> = [
    ['Gear', profile.equipment],
    ['Comfort', profile.filming_comfort],
    ['BestTimes', profile.best_filming_times],
  ]
  const filmLines = film.filter(([, v]) => v?.trim()).map(([k, v]) => `${k}: ${v!.trim()}`)
  if (filmLines.length) lines.push('FILMING: ' + filmLines.join(' | '))

  // Signature service — useful for closing CTAs
  if (profile.signature_service?.trim()) lines.push(`Signature: ${profile.signature_service.trim()}`)
  if (profile.current_promotions?.trim()) lines.push(`Promos: ${profile.current_promotions.trim()}`)

  return lines.join('\n')
}

const BASIC_WEEKLY_FILMING_LIMIT = 24
const PRO_WEEKLY_FILMING_LIMIT = 50
const PREMIUM_WEEKLY_FILMING_LIMIT = 98

export async function POST(req: NextRequest) {
  try {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = authed.userId
    const rl = rateLimit(`ai:${userId}`, 20, 60000)
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
    const { idea, profile, customization, styleOverride, peopleCountOverride, filmingMode, videoLength } = await req.json()

    if (!idea) {
      return NextResponse.json({ error: 'No idea provided' }, { status: 400 })
    }

    const plan = await getPlan(userId)

    if (styleOverride && plan === 'basic') {
      return NextResponse.json({ error: 'Regenerating in a different style is a Pro plan feature. Upgrade to unlock it.' }, { status: 403 })
    }

    if (userId) {
      const weeklyLimit = plan === 'top' ? PREMIUM_WEEKLY_FILMING_LIMIT : plan === 'mid' ? PRO_WEEKLY_FILMING_LIMIT : BASIC_WEEKLY_FILMING_LIMIT

      const { data: usageRow } = await supabaseAdmin
        .from('business_profiles')
        .select('filming_generated_this_week, usage_reset_at')
        .eq('user_id', userId)
        .maybeSingle()

      const now = new Date()
      const daysSinceMonday = (now.getDay() + 6) % 7
      const mostRecentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday, 0, 0, 0, 0)
      const resetAt = usageRow?.usage_reset_at ? new Date(usageRow.usage_reset_at) : null
      const needsReset = !resetAt || resetAt.getTime() < mostRecentMonday.getTime()
      const currentCount = needsReset ? 0 : (usageRow?.filming_generated_this_week || 0)

      if (currentCount >= weeklyLimit) {
        const planLabel = plan === 'top' ? 'Premium' : plan === 'mid' ? 'Pro' : 'Basic'
        return NextResponse.json(
          { error: `You've reached your limit of ${weeklyLimit} filming instructions generated this week on the ${planLabel} plan. Upgrade for a higher weekly limit.` },
          { status: 403 }
        )
      }

      await supabaseAdmin
        .from('business_profiles')
        .update({
          filming_generated_this_week: currentCount + 1,
          usage_reset_at: needsReset ? now.toISOString() : (usageRow?.usage_reset_at || now.toISOString()),
        })
        .eq('user_id', userId)
    }

    const effectiveCustomization = (plan === 'mid' || plan === 'top') ? customization : null

    const profileBrief = compressProfileForChecklist(profile)

    // Only pass seasonal context if the idea itself references a seasonal event
    const ideaText = `${idea.title} ${idea.description} ${idea.hook}`.toLowerCase()
    const seasonalKeywords = ['halloween', 'christmas', 'easter', 'anzac', 'valentine', 'mother', 'father', 'thanksgiving', 'pancake', 'women', 'melbourne cup', 'new year', 'australia day', 'bonfire', 'memorial', 'independence', 'labor day', 'spooky', 'festive', 'seasonal', 'holiday']
    const ideaIsSeasonal = seasonalKeywords.some((kw) => ideaText.includes(kw))

    const locationType = profile.location_type || 'fixed'
    const locationBrief =
      locationType === 'mobile' ? 'MOBILE — travels to customers; no shop/storefront steps; use van/tools/surroundings'
      : locationType === 'both' ? 'BOTH fixed + mobile — shop ok if it fits, not assumed'
      : 'FIXED shop/studio — filming there is fine'

    const onCameraPeople = (profile.on_camera_people || '').trim()
    const peopleList = onCameraPeople ? onCameraPeople.split(/[,&]|and/i).map((p: string) => p.trim()).filter(Boolean) : []
    const effectivePeopleCount = typeof peopleCountOverride === 'number' && peopleCountOverride > 0 ? peopleCountOverride : peopleList.length
    const isMultiPerson = effectivePeopleCount > 1
    const crewGuidance = isMultiPerson
      ? `Up to ${effectivePeopleCount} people on camera${onCameraPeople && typeof peopleCountOverride !== 'number' ? ` (${onCameraPeople})` : ''} — choreograph handoffs where it fits; many steps can still be one person`
      : 'Films ALONE on phone, no crew'

    const existingScript = idea.script ? idea.script.trim() : null
    const notesLine = idea.notes ? ` Owner notes: ${idea.notes}` : ''
    const styleNote = styleOverride ? `\nDelivery style: ${styleOverride}` : ''
    const customNote = effectiveCustomization ? `\nOwner guidance: ${effectiveCustomization}` : ''

    const seasonalNote = ideaIsSeasonal && profile.local_seasonal_context ? `\nSeasonal context (only use if directly relevant to this idea): ${profile.local_seasonal_context}` : ''

    const lengthNote = videoLength ? `\nVIDEO LENGTH: Target ${videoLength} seconds total. Adjust number of steps and timing accordingly.` : ''

    const filmingModeNote = filmingMode === 'single'
      ? '\nFILMING MODE: Single shot. Generate exactly ONE filming step, maximum 2 sentences. Just the camera position and movement — no dialogue in the step. Keep it simple: where to stand, where to point the phone, any movement. The full script handles what to say. Also generate exactly ONE direction in the directions array matching this step.'
      : filmingMode === 'multi'
      ? `\nFILMING MODE: Multi-shot showcase reel.
STRICT RULES:
- Generate exactly ${Math.round((videoLength || 30) / 2)} clips (one clip every 2 seconds)
- Each clip is 2 seconds long, NO exceptions
- Each step = one single camera shot only (one angle, one subject, one movement)
- 80% of clips are silent b-roll: close-ups, details, textures, actions, reactions, products
- Only 20% of clips have spoken words — keep those under 6 words each
- Dialogue carries across multiple clips as voiceover — the camera keeps cutting while person talks
- NO long sentences in any single clip
- Think: high-energy Instagram reel, fast cuts, mostly visual
- Total video = exactly ${videoLength || 30} seconds`
      : ''

    const prompt = `You are a filming coach. Turn this video idea into a precise filming checklist.${filmingModeNote}${lengthNote}

BUSINESS:
${profileBrief}
${crewGuidance}
Location: ${locationBrief}
${customNote}${styleNote}

IDEA:
Title: ${idea.title}
Opening line: "${idea.hook}"
Payoff: ${idea.description}${notesLine}

RULES:
- IMPORTANT: Do NOT reference any seasonal events, holidays or dates (Halloween, Christmas, etc.) unless the idea itself explicitly mentions them. Keep all dialogue and directions evergreen and specific to this business only.
- Continue the opening line naturally — don't invent a new one
- Dialogue sounds like a real person talking (contractions, casual, short sentences) — never like an ad
- Pace generously: ~2 words/sec + 1-2 sec buffer per movement. 12-word line = 7-8 sec minimum. Total: 20-45 sec
- Camera must move or change in most steps — not a static talking head throughout
- Common-sense observations fine to state directly. Specific technical/regulatory facts — hand off to owner to say in their own words
- Never use double quotes inside strings — use single quotes instead
${existingScript ? `- Generate exactly one filming step per sentence of the pre-written script above — do not combine sentences into one step or skip any. Each step covers exactly one sentence.` : `- Use as few steps as needed (usually 3-6). Each step = one string: time range + camera position/movement + words to say`}
- Use Tone and Brand personality to shape how dialogue sounds; use Avoid to never include those words; weave in Taglines or Promos naturally in the closing CTA if relevant

Example step: "0:00 to 0:11 - Hold phone at chest height facing the van, and say: G'day, it's Jake from Jake's Plumbing, and mate, if your hot water system is making a weird banging noise, you're not going crazy."

Also provide:
- prep: 2-4 items to grab before filming (always include Phone; add others only if genuinely needed for this specific idea)
- caption: ready-to-post social caption, maximum 100 characters total including hashtags, punchy and in the business's tone
- script: full word-for-word spoken words only, no timestamps or camera notes, reads naturally aloud
- directions: array of short camera-only instructions (one per checklist step), no dialogue, no quotes, just the physical action e.g. 'Hold phone at chest height facing the oven' or 'Close-up of hands shaping dough'

Respond ONLY with valid JSON, no markdown, no code fences:
{ "prep": ["..."], "checklist": ["..."], "caption": "...", "script": "...", "directions": ["..."] }`

    const model = 'claude-haiku-4-5'

    let result: { prep?: string[]; checklist?: string[]; caption?: string; script?: string } | null = null
    let attempts = 0

    while (attempts < 3 && !result) {
      attempts++
      const message = await anthropic.messages.create({
        model,
        max_tokens: 2400,
        thinking: { type: 'disabled' },
        messages: [{ role: 'user', content: prompt }],
      })

      const textBlock = message.content.find((b) => b.type === 'text')
      const rawText = textBlock && 'text' in textBlock ? textBlock.text : '{}'
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      const safeCleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')

      try {
        const parsed = JSON.parse(safeCleaned)
        if (parsed?.checklist && Array.isArray(parsed.checklist) && parsed.checklist.length > 0) {
          result = parsed
        }
      } catch {
        // retry
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
