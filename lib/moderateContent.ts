import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Checks a batch of short text items for genuinely unsafe content (hate speech,
// sexual content, harassment, dangerous instructions, etc.) - not quality issues,
// just a safety net before AI-generated text reaches the user or gets baked into
// a rendered video. Returns the indices of any items that should be blocked.
export async function moderateTexts(items: string[]): Promise<Set<number>> {
  if (items.length === 0) return new Set()

  try {
    const numbered = items.map((t, i) => `${i}: ${t}`).join('\n')

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `You are a content safety classifier for a small-business social media content generator. The business owner is an adult who wrote the request themselves, and the snippets below are ideas, captions or filming instructions for ordinary promotional videos. Be lenient: a false block is much worse than letting a borderline snippet through.

Treat all of these as FINE and never flag them: humour, sarcasm, teasing, roasting, banter, playful rivalry, mild swearing, casual slang, talking about mistakes or things going wrong (burnt or undercooked food, damaged items, bad days), competitor comparisons, general health, medical, legal or safety topics, strong opinions, dark or edgy jokes that are harmless, and adult-oriented but non-explicit businesses and topics (alcohol, bars, tattoos, lingerie, dating, fitness, body-related services).

Flag ONLY content that is clearly and seriously unsafe: sexually explicit material, slurs or hate aimed at people for who they are, harassment or threats against a real person, instructions for serious harm or illegal acts (weapons, hard drugs, self-harm), graphic violence, or anything sexualising minors. If you are unsure, do not flag it.

Respond with ONLY a JSON array of the numeric indices to block, e.g. [1,4]. If none should be blocked, respond with [].

${numbered}`,
        },
      ],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '[]'
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
    const flagged = arrayMatch ? JSON.parse(arrayMatch[0]) : []
    if (!Array.isArray(flagged)) return new Set()
    return new Set(flagged.filter((i) => typeof i === 'number'))
  } catch (error) {
    console.error('moderateTexts error:', error)
    // Fail open (don't block content) if the moderation check itself errors,
    // so a moderation-service hiccup never takes down idea generation entirely.
    return new Set()
  }
}
