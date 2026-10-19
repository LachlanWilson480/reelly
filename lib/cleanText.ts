// Removes emojis and em dashes from AI generated text (deep, so it works on objects and arrays too).
const EMOJI = /[\p{Extended_Pictographic}\u200d\ufe0f\u20e3]/gu

export function cleanString(s: string): string {
  return s
    .replace(EMOJI, '')
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(/\s*\u2013\s*/g, ' to ')
    .replace(/ {2,}/g, ' ')
    .replace(/,\s*([.,!?;:])/g, '$1')
    .trim()
}

export function cleanAiText<T>(value: T): T {
  if (typeof value === 'string') return cleanString(value) as unknown as T
  if (Array.isArray(value)) return value.map((v) => cleanAiText(v)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = cleanAiText(v)
    return out as T
  }
  return value
}
