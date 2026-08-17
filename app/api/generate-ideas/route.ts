import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { profile, customization } = await req.json()

    const customNote = customization ? `\n\nAdditional guidance from the business owner (follow this, but never at the expense of safety, realism, or the constraints above):\n${customization}` : ''

    const prompt = `You help busy small business owners in Sydney create short-form social media content by themselves, alone, on their phone, in a few spare minutes. They are NOT content creators, have NO crew, NO extra equipment, and NO time to spare. If an idea requires more than 10 minutes total to film, a second person, editing skill, or planning a shot list, it is a bad idea and you must not suggest it.

Business: ${profile.business_name}
Industry: ${profile.industry}
Suburb: ${profile.suburb}
Tone: ${profile.tone || 'not specified'}
Ideal customer: ${profile.target_audience || 'not specified'}
Core services: ${profile.core_services || 'not specified'}

Generate 3 realistic content ideas this specific business owner could film themselves, alone, on their phone, during or right after a normal job/day, in under 10 minutes total. Ground every idea in what actually happens in their real day-to-day work \u2014 a specific job, a specific moment, a specific thing a customer asked \u2014 not a generic content trope like "before and after" or "day in the life" unless it genuinely fits how this business works.

Each video should be 15-30 seconds, filmable in one continuous take or a maximum of 2 simple clips, with zero editing skill required beyond what Reelly automatically handles (captions, trimming, music).

For each idea, provide:
- A short, specific title (not generic)
- A one-sentence hook: literally what to say or do in the first 3 seconds, in plain words
- A one-sentence description of the whole video, describing exactly what happens start to finish
- 3-4 relevant hashtags, including the suburb where natural

${customNote}

Respond ONLY with valid JSON, no markdown formatting, no code fences, in this exact structure:
[
  { "title": "...", "hook": "...", "description": "...", "tags": "#tag1 #tag2 #tag3" }
]`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '[]'
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const ideas = JSON.parse(cleaned)

    return NextResponse.json({ ideas })
  } catch (error) {
    console.error('generate-ideas error:', error)
    return NextResponse.json({ error: 'Failed to generate ideas' }, { status: 500 })
  }
}
