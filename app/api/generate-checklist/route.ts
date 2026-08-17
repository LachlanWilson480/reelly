import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { ideas, profile, customization } = await req.json()

    const ideasList = ideas
      .map((idea: { title: string; description: string }, i: number) => `${i + 1}. ${idea.title} - ${idea.description}`)
      .join('\n')

    const customNote = customization ? `\n\nAdditional guidance from the business owner (follow this, but never at the expense of safety, realism, or the constraints above):\n${customization}` : ''

    const prompt = `You are a filming coach helping a busy, non-technical small business owner (${profile.business_name}, a ${profile.industry} in ${profile.suburb}, Sydney) film short videos ALONE on their phone in a few spare minutes. No crew, no extra gear beyond their phone. The whole thing, including setup, must take under 10 minutes.

For each idea below, write a precise, timed filming checklist. Every checklist item MUST be a single plain text string (not an object) that combines all of the following into one readable sentence:
- An exact duration or time range (e.g. "0:00 to 0:04")
- The camera angle/distance in plain terms (e.g. "hold phone at chest height, angled slightly down")
- Lighting guidance only if it meaningfully affects the shot - skip if not relevant
- If talking to camera, the ACTUAL words to say, written out naturally in the business's tone (${profile.tone || 'friendly and direct'}) - not a description of what to say, the real line

Example of a correctly formatted single checklist step: "0:00 to 0:04 - Hold your phone at chest height facing the van, natural daylight behind you, and say: Quick tip before I head off..."

Do not include separate editing steps - captions, trimming, and music are handled automatically afterward. Aim for 5-7 steps per idea.

${ideasList}${customNote}

Respond ONLY with valid JSON, no markdown formatting, no code fences. Each item in the "checklist" array must be a plain string, never an object. Use this exact structure (same order as the ideas above):
[
  { "checklist": ["full single-sentence step 1", "full single-sentence step 2"] }
]`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1600,
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
