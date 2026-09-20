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
          content: `You are a content safety classifier for a small-business social media content generator. Below is a numbered list of short text snippets (video ideas, captions, or filming instructions). Flag ONLY items containing genuinely unsafe content: hate speech, sexual content, harassment, dangerous/illegal instructions, or graphic violence. Do NOT flag items just because they are low quality, generic, or slightly off-topic - only genuine safety violations.

Respond with ONLY a JSON array of the numeric indices that should be blocked, e.g. [1,4]. If none should be blocked, respond with [].

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
