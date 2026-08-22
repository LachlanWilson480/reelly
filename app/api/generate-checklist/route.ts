import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { ideas, profile, customization } = await req.json()

    const ideasList = ideas
      .map((idea: { title: string; hook: string; description: string; notes?: string }, i: number) => {
        const notesLine = idea.notes ? `\n   Owner's own notes/tweaks for this idea (these take priority over the original hook/description if they conflict): ${idea.notes}` : ''
        return `${i + 1}. Title: ${idea.title}\n   Opening line already chosen: "${idea.hook}"\n   What the video needs to communicate: ${idea.description}${notesLine}`
      })
      .join('\n\n')

    const customNote = customization ? `\n\nAdditional guidance from the business owner on their filming/speaking style (follow this closely):\n${customization}` : ''

    const prompt = `You are a filming coach helping a busy, non-technical small business owner (${profile.business_name}, a ${profile.industry} in ${profile.suburb}, Sydney) film short videos ALONE on their phone in a few spare minutes. No crew, no extra gear beyond their phone. The whole thing, including setup, must take under 10 minutes.

CRITICAL — continuity with the idea: each idea below already has a specific opening line the business owner chose and liked. Your checklist must CONTINUE that exact opening line naturally into the rest of the video — do not invent a different opening or ignore the line already given. The checklist is the "how do I actually film this" breakdown of the SAME idea, not a new idea.

CRITICAL — natural dialogue: every line of spoken dialogue must sound like a real person actually talking out loud — use contractions, casual phrasing, and short sentences a real tradesperson/business owner would say. Never write dialogue that sounds like a script, an ad, or a LinkedIn post. Read it out loud in your head before writing it — if it sounds stiff or corporate, rewrite it plainer.

CRITICAL — realistic pacing: calculate each step's duration generously from the ACTUAL word count of its dialogue, using no more than 2 spoken words per second (natural, unrushed pace, including a brief pause before speaking starts). Round UP, not down, and add 1-2 extra seconds of buffer per step for the physical action (walking, turning, picking something up) to actually happen before or during the line. A 12-word sentence should get at least 7-8 seconds, a 20-word sentence at least 12-13 seconds. Total video length can run 20-45 seconds if the content genuinely needs it — never compress dialogue to hit a shorter total. Do not pad with unnecessary steps — use as few steps as the idea actually needs.

CRITICAL — visual variety: never have the business owner stand still in the same position/framing for the whole video. Each step should change something visually — walk somewhere, change camera distance or angle, point at or pick up something relevant (a tool, a part, a sign), turn to show something behind them, or physically demonstrate part of what they're describing. A viewer should see movement or a changing visual roughly every 4-6 seconds, not a static talking head the entire time.
CRITICAL — factual accuracy: common-sense observations (e.g. visible damage, unusual heat, unusual sounds or smells) are fine to state directly. But NEVER state a specific regulatory requirement, numeric threshold, legal timeframe, code/standard reference, or precise technical specification as fact (e.g. never assert how often a certification must be renewed, a specific Australian Standard number, a specific voltage/measurement threshold, or similar) — you are not a domain expert and could easily be wrong or out of date. For any step that would otherwise need one of these specifics, write the dialogue as a prompt for the business owner to fill in with their own current, correct knowledge instead (e.g. "then say how often it actually needs checking, in your own words").

For each idea, write a precise, timed filming checklist. Every checklist item MUST be a single plain text string (not an object) that combines:
- An exact duration or time range that reflects realistic speaking pace (e.g. "0:00 to 0:03")
- The camera position AND movement direction in plain terms — not just a static height/angle. Specify whether the phone stays still, pans, follows the person walking, zooms in/out, or tilts, e.g. "hold phone at chest height and slowly walk backward as you talk" or "phone stays still on a surface, you walk into frame from the left" or "hold phone up close on the object, then pull back to show your face".
- Lighting guidance only if it meaningfully affects the shot — skip if not relevant
- The ACTUAL words to say, written out naturally and conversationally in the business's tone (${profile.tone || 'friendly and direct'})

Example of correctly proportioned timing: "0:00 to 0:11 - Hold phone at chest height facing the van, and say: G'day, it's Jake from Jake's Plumbing, and mate, if your hot water system is making a weird banging noise, you're not going crazy." (that is 24 words, given 11 seconds — note how generous this is compared to what feels natural to write. A short 5-word line like "Quick tip before I go" would only need about 3 seconds, but anything longer must scale up proportionally, not stay compressed into a similarly short window.)

Do not include separate editing steps — captions, trimming, and music are handled automatically afterward.

${ideasList}${customNote}

Respond ONLY with valid JSON, no markdown formatting, no code fences. Each item in the "checklist" array must be a plain string, never an object. Use this exact structure (same order as the ideas above):
[
  { "checklist": ["full single-sentence step 1", "full single-sentence step 2"] }
]`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1600,
      temperature: 1,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '[]'
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const checklists = JSON.parse(cleaned)

    return NextResponse.json({ checklists })
  } catch (error) {
    console.error('generate-checklist error:', error)
    return NextResponse.json({ error: 'Failed to generate checklist' }, { status: 500 })
  }
}
