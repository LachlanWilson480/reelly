// Keeps AI spend per person under a monthly dollar budget. Server only.
// Every AI call is checked before it runs (aiGate) and its real token use is recorded afterwards (recordAiSpend).
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'
import { getMonthStartISO } from '@/lib/billingMonth'
import { MODEL_FREE } from '@/lib/aiModel'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type PlanKey = 'free' | 'basic' | 'mid' | 'top'

// The most AI one person can use in a calendar month, in US dollars. Edit here only.
export const MONTHLY_BUDGET_USD: Record<PlanKey, number> = { free: 0.3, basic: 3, mid: 3, top: 5 }
// Once this share of the budget is used, the person is moved to the cheapest model for the rest of the month.
const DOWNGRADE_AT = 0.6
// Most AI requests one person can make in a day
const DAILY_CALLS: Record<PlanKey, number> = { free: 30, basic: 120, mid: 120, top: 200 }

// US dollars per million tokens: [input, output]. Cached reads cost 10% of input and cache writes 125%.
// Check these against Anthropic's pricing page when models change. Unknown models are charged at the highest rate here.
const PRICE: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-haiku-4-5': [1, 5],
  'claude-sonnet-4-5': [3, 15],
  'claude-sonnet-5-5': [2, 10],
}
const priceOf = (model: string): [number, number] => PRICE[model] || [3, 15]

type Usage = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }

export function costOf(model: string, u: Usage): number {
  const [pin, pout] = priceOf(model)
  return ((u.input_tokens || 0) * pin + (u.cache_read_input_tokens || 0) * pin * 0.1 + (u.cache_creation_input_tokens || 0) * pin * 1.25 + (u.output_tokens || 0) * pout) / 1_000_000
}

// Worst case for one call: the output limit used in full plus a generous input
const worstCase = (model: string, maxTokens: number) => { const [pin, pout] = priceOf(model); return (maxTokens * pout + 6000 * pin) / 1_000_000 }

export async function getMonthSpend(userId: string): Promise<number> {
  const { data, error } = await admin.from('ai_spend').select('cost_usd').eq('user_id', userId).eq('month_start', getMonthStartISO()).maybeSingle()
  if (error) { console.error('ai-budget read failed', error.message); return 0 } // fail open, never block people because of a bookkeeping error
  return Number(data?.cost_usd || 0)
}

export type Gate = { ok: true; model: string; spent: number; budget: number } | { ok: false; status: number; message: string }

// Call before every AI request. Returns the model to use (the cheapest one once most of the budget is gone) or a message to show.
export async function aiGate(userId: string, plan: PlanKey, model: string, maxTokens: number): Promise<Gate> {
  const day = await rateLimit(`aiday:${userId}`, DAILY_CALLS[plan] || 30, 24 * 60 * 60 * 1000)
  if (!day.allowed) return { ok: false, status: 429, message: 'You have made a lot of AI requests today. Please come back tomorrow.' }
  const budget = MONTHLY_BUDGET_USD[plan] ?? MONTHLY_BUDGET_USD.free
  const spent = await getMonthSpend(userId)
  const use = spent >= budget * DOWNGRADE_AT ? MODEL_FREE : model
  if (spent + worstCase(use, maxTokens) > budget) {
    return { ok: false, status: 429, message: plan === 'top' ? 'You have used this month\'s AI allowance. It resets on the 1st.' : 'You have used this month\'s AI allowance on your plan. It resets on the 1st, or you can upgrade for more.' }
  }
  return { ok: true, model: use, spent, budget }
}

// Call after every AI request with what the API reported
export async function recordAiSpend(userId: string | undefined, model: string, message: { usage?: Usage }) {
  if (!userId || !message.usage) return
  try {
    const u = message.usage
    const { error } = await admin.rpc('add_ai_spend', { p_user: userId, p_month: getMonthStartISO(), p_cost: costOf(model, u), p_in: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), p_out: u.output_tokens || 0 })
    if (error) console.error('ai-budget write failed', error.message)
  } catch (e) { console.error('ai-budget write failed', e instanceof Error ? e.message : 'unknown') }
}

// ---- limits on what people can send in ----
export const MAX_BODY_BYTES = 60_000
export const bodyTooBig = (req: Request) => Number(req.headers.get('content-length') || 0) > MAX_BODY_BYTES

// Cuts every piece of text a person sends to a sensible length so a huge paste cannot run up the input bill
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function clampInput<T = any>(value: T, maxText = 1200, depth = 0): T {
  if (typeof value === 'string') return value.slice(0, maxText) as T
  if (depth > 3 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.slice(0, 40).map((v) => clampInput(v, maxText, depth + 1)) as T
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 80)) out[k] = clampInput(v, maxText, depth + 1)
  return out
}
