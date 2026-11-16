// The rules on a discount code (see supabase/creator_codes.sql), shared by checkout, the plans page and the server.

export type CodeRow = {
  percent_off: number | string
  months?: number | null
  monthly_only?: boolean | null
  plans?: string[] | null
  new_customers_only?: boolean | null
}

export type CodeRules = {
  percentOff: number
  months: number
  monthlyOnly: boolean
  plans: ('basic' | 'top')[] | null
  newCustomersOnly: boolean
}

// "pro" is what people call the top plan; older rows may say "mid", which is sold as Basic
export const normPlan = (p: string): 'basic' | 'top' | null => {
  const v = p.trim().toLowerCase()
  if (v === 'pro' || v === 'top') return 'top'
  if (v === 'basic' || v === 'mid') return 'basic'
  return null
}

export function codeRules(row: CodeRow): CodeRules {
  const plans = Array.isArray(row.plans) ? row.plans.map(normPlan).filter((p): p is 'basic' | 'top' => !!p) : []
  return {
    percentOff: Math.max(0, Math.min(100, Number(row.percent_off) || 0)),
    months: Math.max(1, Math.min(12, Math.round(Number(row.months) || 1))),
    monthlyOnly: row.monthly_only === true,
    plans: plans.length ? [...new Set(plans)] : null,
    newCustomersOnly: row.new_customers_only === true,
  }
}

const planName = (p: 'basic' | 'top') => (p === 'top' ? 'Pro' : 'Basic')

// Why this code cannot be used for this plan and billing, or null when it can
export function codeMismatch(r: CodeRules, plan: string | null | undefined, interval: string | null | undefined): string | null {
  if (r.monthlyOnly && interval === 'yearly') return 'This code only works with monthly billing. Switch to monthly to use it.'
  const p = plan ? normPlan(plan) : null
  if (r.plans && p && !r.plans.includes(p)) return `This code only works on the ${r.plans.map(planName).join(' or ')} plan.`
  return null
}

// How many payments the discount covers: the first N monthly payments, or the first payment on yearly billing
export const coveredPayments = (r: CodeRules, interval: string | null | undefined) => (interval === 'yearly' ? 1 : r.months)

// Plain words for the offer, for example "1 month free" or "50% off your first 3 months"
export function codeLabel(r: CodeRules, interval: string | null | undefined = 'monthly'): string {
  const n = coveredPayments(r, interval)
  const what = interval === 'yearly' ? 'your first year' : n === 1 ? 'your first month' : `your first ${n} months`
  if (r.percentOff >= 100) return interval === 'yearly' ? 'Your first year free' : n === 1 ? '1 month free' : `${n} months free`
  return `${r.percentOff}% off ${what}`
}
