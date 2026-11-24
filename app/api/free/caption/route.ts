import { NextRequest, NextResponse } from 'next/server'
import { freeGate, field, askForJson, SAFE_RULES } from '@/lib/freeTool'

const TONES = ['friendly', 'fun', 'professional', 'bold'] as const

// Free caption and hashtag generator on the public site: three captions and a set of hashtags, no account needed
export async function POST(req: NextRequest) {
  try {
    const gate = await freeGate(req, 'caption')
    if (!gate.ok) return gate.res
    const about = field(gate.body.about, 300)
    const business = field(gate.body.business, 80)
    const place = field(gate.body.place, 60)
    const tone = TONES.includes(gate.body.tone as typeof TONES[number]) ? (gate.body.tone as string) : 'friendly'
    if (about.length < 4) return NextResponse.json({ error: 'Tell us what the video or post is about.' }, { status: 400 })

    const prompt = `You write Instagram, TikTok and Facebook captions for small local businesses.

What the post is about: ${about}
${business ? `Type of business: ${business}\n` : ''}${place ? `Where: ${place}\n` : ''}Tone: ${tone}

Write 3 different captions for this post:
1. A short one: 1 sentence.
2. A medium one: 2 or 3 sentences.
3. A longer one: 3 to 5 sentences that tells a little story.
Each caption ends with a clear, natural call to action (book, visit, comment, save or share).

Then write 15 hashtags: a mix of a few big general tags, tags for this type of business, and ${place ? 'local tags for the place given' : 'a few general local small business tags'}. Each starts with # and has no spaces.

Rules:
${SAFE_RULES}
- Do not put hashtags inside the captions.

Respond ONLY with JSON in this exact shape, nothing else:
{ "captions": ["...", "...", "..."], "hashtags": ["#...", "..."] }
If you must refuse, respond with { "captions": [], "hashtags": [] }`

    const out = await askForJson<{ captions?: string[]; hashtags?: string[] }>('caption', prompt, 800)
    const captions = (out?.captions || []).filter((c) => typeof c === 'string' && c.trim()).slice(0, 3).map((c) => c.slice(0, 900))
    const hashtags = (out?.hashtags || [])
      .filter((h) => typeof h === 'string')
      .map((h) => '#' + h.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, ''))
      .filter((h) => h.length > 2)
      .slice(0, 20)
    if (captions.length === 0) return NextResponse.json({ error: 'We could not write a caption for that. Try describing it another way.' }, { status: 422 })
    return NextResponse.json({ captions, hashtags: [...new Set(hashtags)] })
  } catch (e) {
    console.error('free caption error:', e instanceof Error ? e.message : 'unknown')
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
