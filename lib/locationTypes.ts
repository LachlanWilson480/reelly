// location_type is stored as a comma separated list, e.g. 'fixed,online'.
// Old accounts may hold a single value, or 'both' (meant all three).
export const LOCATION_VALUES = ['fixed', 'mobile', 'online'] as const

export function parseLocationTypes(raw: string | null | undefined): string[] {
  const parts = (raw || '').split(',').map((p) => p.trim()).filter(Boolean)
  const out: string[] = []
  for (const p of parts) {
    if (p === 'both') { for (const v of LOCATION_VALUES) if (!out.includes(v)) out.push(v) }
    else if ((LOCATION_VALUES as readonly string[]).includes(p) && !out.includes(p)) out.push(p)
  }
  return out.length ? out : ['fixed']
}

// Toggle one option; always keeps at least one selected.
export function toggleLocationType(raw: string | null | undefined, value: string): string {
  const cur = parseLocationTypes(raw)
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
  const ordered = LOCATION_VALUES.filter((v) => next.includes(v))
  return (ordered.length ? ordered : cur).join(',')
}

export function multiLocationBrief(list: string[]): string {
  const parts: string[] = []
  if (list.includes('fixed')) parts.push('a fixed shop/studio (customers visit)')
  if (list.includes('mobile')) parts.push('mobile work (travels to customers)')
  if (list.includes('online')) parts.push('an online store')
  return `MIXED - the business operates through ${parts.join(' AND ')}; vary the setting across ideas and only use settings that fit these; never assume one that is not listed`
}
