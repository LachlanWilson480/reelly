// Which Claude model each plan gets. Change models here only.
export const MODEL_FREE = 'claude-haiku-5-5'
export const MODEL_BASIC = 'claude-sonnet-4-5'
export const MODEL_PRO = 'claude-sonnet-5-5'

export function modelForPlan(plan: string): string {
  if (plan === 'top') return MODEL_PRO
  if (plan === 'free') return MODEL_FREE
  return MODEL_BASIC
}

// The 5.5 models reject {type:'disabled'}; they want 'between_tools' to switch thinking off.
// Older models still use 'disabled'. Typed loosely because the SDK types may lag behind the API.
export function thinkingOff(model: string) {
  const newer = model.includes('-5-')
  return { type: newer ? 'between_tools' : 'disabled' } as unknown as { type: 'disabled' }
}
