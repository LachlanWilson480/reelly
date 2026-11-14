// Which Claude model each plan gets. Change models here only.
// Every plan uses Haiku 5.5: it writes better ideas, scripts and filming steps for Reelezy than Sonnet did,
// and costs about a twentieth as much ($0.10 in / $0.50 out per million tokens, against Sonnet 5.5's $2 / $10).
export const MODEL_FREE = 'claude-haiku-5-5'
export const MODEL_BASIC = MODEL_FREE
export const MODEL_PRO = MODEL_FREE

// Kept so the routes do not need to change if a plan ever gets its own model again
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function modelForPlan(_plan: string): string {
  return MODEL_FREE
}

// The 5.5 models reject {type:'disabled'}; they want 'between_tools' to switch thinking off.
// Older models still use 'disabled'. Typed loosely because the SDK types may lag behind the API.
export function thinkingOff(model: string) {
  const newer = model.includes('sonnet-5-5')
  return { type: newer ? 'between_tools' : 'disabled' } as unknown as { type: 'disabled' }
}
