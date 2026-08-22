import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const CONTENT_ANGLES = [
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

function pickAngles(): string[] {
  const shuffled = [...CONTENT_ANGLES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}

export async function POST(req: NextRequest) {
  try {
    const { profile, customization } = await req.json()

    const customNote = customization ? `\n\nAdditional guidance from the business owner on their preferred style (follow this closely for tone and structure):\n${customization}` : ''

    const angles = pickAngles()

    const prompt = `You help busy small business owners in Sydney create short-form social media content by themselves, alone, on their phone, in a few spare minutes. They are NOT content creators, have NO crew, and NO time to spare.

CRITICAL CONSTRAINT — read this carefully: this business owner CANNOT control or predict what job, customer, or scenario will show up on any given day. Never invent or narrate a SPECIFIC fictional customer, address, or live job as if it is happening right now (e.g. never write something like "I just arrived at a place in Coogee where the customer..." or "we're at a house right now where..."). That is dishonest content and impossible to guarantee they can film that day.

If the business owner's style guidance below asks for a "problem \u2192 solution" format, that is fine and encouraged \u2014 but the problem must be framed as a COMMON, GENERAL problem this business sees all the time (e.g. "One thing I get called out for constantly is...", "If your power keeps tripping, here's usually why...", "Say your switchboard does this \u2014 here's what's going on"), never as a specific customer or job happening at this exact moment. This way it's honest, always true, and filmable today regardless of what's actually on the schedule.

Business: ${profile.business_name}
Industry: ${profile.industry}
Suburb: ${profile.suburb}
Tone: ${profile.tone || 'not specified'}
Ideal customer: ${profile.target_audience || 'not specified'}
Core services: ${profile.core_services || 'not specified'}


IMPORTANT — factual accuracy: you are not a domain expert in this business's trade, so NEVER state a specific technical fact, cause, diagnosis, safety claim, or "why" answer yourself (e.g. never assert a specific electrical fault cause, a specific health/legal claim, or any specific technical explanation). If an idea involves explaining a cause, reason, or technical detail, write the hook so it sets up the topic and then hands off to the business owner to explain the specific technical answer themselves, in their own words, since they are the actual expert — for example "explain what usually causes this in your own words" rather than stating a cause yourself. This keeps every video factually safe regardless of the industry.

Each of the 3 ideas must be built around one of these three specific angles (use exactly one angle per idea, in this order, and make each idea concretely and specifically about THIS business's actual services and customers listed above — not generic industry advice that could apply to any business in this trade):
1. ${angles[0]}
2. ${angles[1]}
3. ${angles[2]}

Each video should be 15-30 seconds, filmable in one continuous take, alone, on a phone, with zero setup beyond what's already in their normal workspace. Zero editing skill required beyond what Reelly automatically handles (captions, trimming, music).

For each idea, provide:
- A short, specific title referencing a real detail from this business (not a generic template title — avoid phrases like "Behind the scenes", "Day in the life", "3 quick tips" unless the content genuinely is a numbered list)
- A one-sentence hook: literally what to say or do in the first 3 seconds, in plain words, specific to this business, following the CRITICAL CONSTRAINT above
- A one-sentence description of the actual point or payoff of the video — what it communicates or the actual answer/opinion/tip being shared. This is NOT staging or camera direction (never write things like 'start at the van' or 'walk toward X' here — that belongs in filming instructions elsewhere). If the angle is a personal opinion, preference, or general tip (not a technical diagnosis), state the actual specific answer or opinion here, don\'t leave it vague — only technical/diagnostic causes should be left for the business owner to explain themselves.
- 3-4 relevant hashtags, including the suburb where natural

${customNote}

Respond ONLY with valid JSON, no markdown formatting, no code fences, in this exact structure:
[
  { "title": "...", "hook": "...", "description": "...", "tags": "#tag1 #tag2 #tag3" }
]`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      temperature: 1,
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
