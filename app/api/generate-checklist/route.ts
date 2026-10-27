import { rateLimit } from '@/lib/rateLimit'
import { getAuthedUser } from '@/lib/getAuthedUser'
import { NextRequest, NextResponse } from 'next/server'
import { parseLocationTypes, multiLocationBrief } from '@/lib/locationTypes'
import { modelForPlan } from '@/lib/aiModel'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { moderateTexts } from '@/lib/moderateContent'
import { cleanAiText } from '@/lib/cleanText'
import { comfortRule, parseComfort } from '@/lib/filmingComfort'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getPlan(userId: string | undefined): Promise<'free' | 'basic' | 'mid' | 'top'> {
  if (!userId) return 'free'
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data || data.status !== 'active') return 'free'
  if (data.plan === 'basic') return 'basic'
  if (data.plan === 'top') return 'top'
  return 'mid'
}

// Only the fields relevant to HOW to film - not business strategy or content history.
// Keeps the checklist prompt lean while retaining everything that affects delivery.
function compressProfileForChecklist(profile: Record<string, string | null | undefined>): string {
  const lines: string[] = []

  // Identity - sets tone and context for the filming coach
  const core: Array<[string, string | null | undefined]> = [
    ['Biz', profile.business_name],
    ['Industry', profile.industry],
    ['Suburb', profile.suburb],
    ['Tone', profile.tone],
  ]
  for (const [k, v] of core) {
    if (v?.trim()) lines.push(`${k}: ${v.trim()}`)
  }

  // Voice & brand - shapes how dialogue is written
  const brand: Array<[string, string | null | undefined]> = [
    ['Brand personality', profile.brand_personality],
    ['Avoid', profile.words_to_avoid],
    ['Taglines', profile.taglines],
  ]
  const brandLines = brand.filter(([, v]) => v?.trim()).map(([k, v]) => `${k}: ${v!.trim()}`)
  if (brandLines.length) lines.push('BRAND: ' + brandLines.join(' | '))

  // Filming logistics - directly affects step instructions
  const film: Array<[string, string | null | undefined]> = [
    ['Gear', profile.equipment],
    ['Comfort', profile.filming_comfort],
    ['BestTimes', profile.best_filming_times],
  ]
  const filmLines = film.filter(([, v]) => v?.trim()).map(([k, v]) => `${k}: ${v!.trim()}`)
  if (filmLines.length) lines.push('FILMING: ' + filmLines.join(' | '))

  // Signature service - useful for closing CTAs
  if (profile.signature_service?.trim()) lines.push(`Signature: ${profile.signature_service.trim()}`)
  if (profile.current_promotions?.trim()) lines.push(`Promos: ${profile.current_promotions.trim()}`)

  return lines.join('\n')
}

const FREE_LIFETIME_FILMING_LIMIT = 7
const BASIC_WEEKLY_FILMING_LIMIT = 50
const PRO_WEEKLY_FILMING_LIMIT = 50
const PREMIUM_WEEKLY_FILMING_LIMIT = 98

export async function POST(req: NextRequest) {
  try {
  const authed = await getAuthedUser(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = authed.userId
    const rl = await rateLimit(`ai:${userId}`, 20, 60000)
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
      if (plan === 'free') {
        // Free plan: lifetime limit of 7 filming instructions
        const { data: allUsage } = await supabaseAdmin
          .from('user_usage')
          .select('filming_generated_this_week')
          .eq('user_id', userId)
        const totalFilming = (allUsage || []).reduce((sum: number, r: { filming_generated_this_week: number | null }) => sum + (r.filming_generated_this_week || 0), 0)
        if (totalFilming >= FREE_LIFETIME_FILMING_LIMIT) {
          return NextResponse.json({ error: 'Free plan includes 7 filming instructions. Upgrade for more.' }, { status: 403 })
        }
      }
      const weeklyLimit = plan === 'top' ? PREMIUM_WEEKLY_FILMING_LIMIT : BASIC_WEEKLY_FILMING_LIMIT

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

    const locationList = parseLocationTypes(profile.location_type)
    const locationType = locationList.length === 1 ? locationList[0] : 'multi'
    const locationBrief =
      locationType === 'online' ? 'ONLINE STORE - sells online; no shop/storefront steps or customer visits; film products, packing orders, workspace/stockroom, unboxing, demos'
      : locationType === 'mobile' ? 'MOBILE - travels to customers; no shop/storefront steps; use van/tools/surroundings'
      : locationType === 'multi' ? multiLocationBrief(locationList)
      : locationType === 'both' ? 'ALL OF THE ABOVE - mix of fixed shop, mobile and online store; shop ok if it fits, not assumed'
      : 'FIXED shop/studio - filming there is fine'
    const locationRule = locationType === 'online'
      ? '\nHARD RULE: this business sells ONLINE. Every step must be filmable with products at a desk, stockroom, home or studio. NO customers visiting, shop floor, appointments or on-site service steps. Use products, packaging, parcels, close-ups of the item in use.'
      : ''

    const onCameraPeople = (profile.on_camera_people || '').trim()
    const peopleList = onCameraPeople ? onCameraPeople.split(/[,&]|and/i).map((p: string) => p.trim()).filter(Boolean) : []
    const effectivePeopleCount = typeof peopleCountOverride === 'number' && peopleCountOverride > 0 ? peopleCountOverride : peopleList.length
    const noOne = peopleCountOverride === 0
    // Low comfort means silent footage: nobody speaks, no voiceover, no face
    const lowComfort = parseComfort(profile.filming_comfort).level === 'low'
    const isMultiPerson = !noOne && effectivePeopleCount > 1
    const crewGuidance = lowComfort ? 'SILENT FILM. Hands and actions only: nobody speaks, there is NO voiceover and NO face on camera. Never ask for anything to be said or recorded as audio. Any words appear as on-screen text only' : noOne ? 'NO PEOPLE on camera. Faceless: hands-only, product close-ups, screen recordings, text overlays, voiceover. Never require anyone to appear or speak to camera' : isMultiPerson
      ? `${effectivePeopleCount} people on camera${onCameraPeople && typeof peopleCountOverride !== 'number' ? ` (${onCameraPeople})` : ''} - label each step with who is on camera and use every person at least once; include handoffs, reactions or back-and-forth`
      : 'Films ALONE on phone, no crew - never mention or require a second person'

    const existingScript = idea.script ? idea.script.trim() : null
    const notesLine = idea.notes ? ` Owner notes: ${idea.notes}` : ''
    const styleNote = styleOverride ? `\nDelivery style: ${styleOverride}` : ''
    const customNote = effectiveCustomization ? `\nOwner guidance: ${effectiveCustomization}` : ''

    const seasonalNote = ideaIsSeasonal && profile.local_seasonal_context ? `\nSeasonal context (only use if directly relevant to this idea): ${profile.local_seasonal_context}` : ''

    const lengthNote = videoLength ? `\nVIDEO LENGTH: Target ${videoLength} seconds total. Adjust number of steps and timing accordingly.` : ''

    const filmingModeNote = filmingMode === 'single'
      ? '\nFILMING MODE: Single shot. Generate exactly ONE filming step, maximum 2 sentences. Just the camera position and movement - no dialogue in the step. Keep it simple: where to stand, where to point the phone, any movement. The full script handles what to say. Also generate exactly ONE direction in the directions array matching this step.'
      : filmingMode === 'multi'
      ? `\nFILMING MODE: Multi-shot showcase reel.
STRICT RULES:
- Generate exactly ${Math.round((videoLength || 30) / 2)} clips (one clip every 2 seconds)
- Each clip is 2 seconds long, NO exceptions
- Each step = one single camera shot only (one angle, one subject, one movement)
- 80% of clips are silent b-roll: close-ups, details, textures, actions, reactions, products
- Only 20% of clips have spoken words - keep those under 6 words each
- Dialogue carries across multiple clips as voiceover - the camera keeps cutting while person talks
- NO long sentences in any single clip
- Think: high-energy Instagram reel, fast cuts, mostly visual
- Total video = exactly ${videoLength || 30} seconds`
      : filmingMode === 'quick'
      ? `\nFILMING MODE: Limited time. The person has very little time to film.
STRICT RULES:
- Generate exactly 2-3 steps maximum
- Total video length: 15-25 seconds only
- Each step must be filmable in under 10 seconds
- No complex setups, no multiple angles, no props required
- Simple, grab-your-phone-and-go instructions
- Prefer single-location, single-subject shots
- Think: quick, authentic, done in under 2 minutes of filming`
      : ''

    const comfortLine = comfortRule(profile.filming_comfort)
    const silentRules = lowComfort ? `
SILENT FILM (overrides every other rule about dialogue, words to say, voiceover or spoken lines):
- Do NOT write 'say:' anywhere. Nobody speaks and there is no voiceover.
- Each step = time range + camera position/movement + the on-screen text to show, written as: show on-screen text: 'the text'
- Keep each on-screen text short (under 8 words)
- script = the on-screen text captions only, one per line separated by \\n, never spoken-word phrasing
` : ''

    const prompt = `You are a filming coach. Turn this video idea into a precise filming checklist.${filmingModeNote}${lengthNote}

BUSINESS:
${profileBrief}
${crewGuidance}
Location: ${locationBrief}${locationRule}
${customNote}${styleNote}

IDEA:
Title: ${idea.title}
Opening line: "${idea.hook}"
Payoff: ${idea.description}${notesLine}

${silentRules}
RULES:
- IMPORTANT: Do NOT reference any seasonal events, holidays or dates (Halloween, Christmas, etc.) unless the idea itself explicitly mentions them. Keep all dialogue and directions evergreen and specific to this business only.
- Continue the opening line naturally - don't invent a new one
- Dialogue sounds like a real person talking (contractions, casual, short sentences) - never like an ad
- Pace generously: ~2 words/sec + 1-2 sec buffer per movement. 12-word line = 7-8 sec minimum. Total: 20-45 sec
- Camera must move or change in most steps - not a static talking head throughout
- Common-sense observations fine to state directly. Specific technical/regulatory facts - hand off to owner to say in their own words
- Never use emojis or em dashes anywhere in the output
${comfortLine ? `- ${comfortLine}\n` : ''}- Never use double quotes inside strings - use single quotes instead
${existingScript ? `- Generate exactly one filming step per sentence of the pre-written script above - do not combine sentences into one step or skip any. Each step covers exactly one sentence.` : `- Use as few steps as needed (usually 3-6). Each step = one string: time range + camera position/movement + words to say`}
- Use Tone and Brand personality to shape how dialogue sounds; use Avoid to never include those words; weave in Taglines or Promos naturally in the closing CTA if relevant

${lowComfort ? `Example step: "0:00 to 0:04 - Hold phone at chest height facing the van, and show on-screen text: 'Hot water system banging?'"` : `Example step: "0:00 to 0:11 - Hold phone at chest height facing the van, and say: G'day, it's Jake from Jake's Plumbing, and mate, if your hot water system is making a weird banging noise, you're not going crazy."`}

Also provide:
- prep: 2-4 items to grab before filming (always include Phone; add others only if genuinely needed for this specific idea)
- caption: ready-to-post social caption, maximum 100 characters total including hashtags, punchy and in the business's tone
- script: ${lowComfort ? 'the on-screen text captions only, one per line separated by \\n, nothing spoken' : 'full word-for-word spoken words only, no timestamps or camera notes, reads naturally aloud'}
- directions: the ACTIONS, an array with exactly one entry per checklist step, in the same order. Each is ONE short plain sentence (maximum 12 words) that starts with a verb and tells the person the single thing to do, like 'Hold the phone at chest height facing the oven' or 'Film a close-up of your hands shaping dough'. No lists, no extra detail, no camera jargon, no spoken words, never more than one action per entry. If that step shows text on screen, add a second short sentence: On-screen text: 'the text'

Respond ONLY with valid JSON, no markdown, no code fences:
{ "prep": ["..."], "checklist": ["..."], "caption": "...", "script": "...", "directions": ["..."] }`

    const model = modelForPlan(plan)

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

    if (lowComfort) {
      // Safety net: turn any spoken line into on-screen text so nobody is ever asked to speak
      const toText = (t: string) => t.replace(/[,;.]?\s*(?:and\s+)?(?:say|says|saying|voiceover|voice over|voice-over)\s*:\s*/gi, ', and show on-screen text: ')
      if (Array.isArray(result.checklist)) result.checklist = result.checklist.map(toText)
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

    return NextResponse.json(cleanAiText(result))
  } catch (error) {
    console.error('generate-checklist error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Failed to generate checklist' }, { status: 500 })
  }
}
