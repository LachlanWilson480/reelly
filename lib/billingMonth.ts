// One shared definition of "this month" for render-time limits, used by the dashboard,
// the plans page and the render API so they all reset at the same moment:
// midnight at the start of the 1st, Australia/Sydney time.
const TZ = 'Australia/Sydney'

function tzOffsetMs(atUtcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(atUtcMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(atUtcMs / 1000) * 1000
}

export function getMonthStartISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit' }).formatToParts(now)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  const localMidnightAsUtc = Date.UTC(y, m - 1, 1)
  // Two passes so a daylight saving change on the 1st is handled correctly
  let start = localMidnightAsUtc - tzOffsetMs(localMidnightAsUtc)
  start = localMidnightAsUtc - tzOffsetMs(start)
  return new Date(start).toISOString()
}
