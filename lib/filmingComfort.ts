export type ComfortLevel = 'full' | 'medium' | 'low'

export const COMFORT_LEVELS: { id: ComfortLevel; title: string; description: string; saved: string; rule: string }[] = [
  {
    id: 'full',
    title: 'Full comfort',
    description: 'On camera and talking to the camera',
    saved: 'on camera and talking to camera',
    rule: 'FILMING COMFORT: Full. The owner is comfortable on camera and talking to camera, so talking-to-camera ideas are fine.',
  },
  {
    id: 'medium',
    title: 'Medium',
    description: 'Hands and voice: show the work while talking or doing a voiceover',
    saved: 'hands and voice, no face',
    rule: 'FILMING COMFORT: Medium (STRICT). The owner is happy to use their hands and their voice but will NOT show their face. Every idea, filming step and script must work as hands doing things on camera with a voiceover or talking while working. Never ask them to talk straight to the camera or show their face.',
  },
  {
    id: 'low',
    title: 'Low',
    description: 'Hands and actions only, no voice and no face',
    saved: 'hands and actions only, no voice, no face',
    rule: "FILMING COMFORT: Low (STRICT). The owner will only film hands and actions, with NO voice and NO face. Every idea, filming step and script must work as silent footage with on-screen text and music. Never include speaking, voiceover, talking to camera or the owner's face. Where words would normally be spoken, give them as on-screen text instead.",
  },
]

// The level is saved at the start of the existing filming_comfort text, so no database change is needed.
export function parseComfort(value: string | null | undefined): { level: ComfortLevel | null; rest: string } {
  const v = (value || '').trim()
  const m = v.match(/^Comfort level: (full|medium|low)\b[^|]*(?:\|\s*)?/i)
  if (!m) return { level: null, rest: v }
  return { level: m[1].toLowerCase() as ComfortLevel, rest: v.slice(m[0].length).trim() }
}

export function withComfort(level: ComfortLevel | null, rest: string | null | undefined): string {
  const tail = (rest || '').trim()
  const found = COMFORT_LEVELS.find((l) => l.id === level)
  const head = found ? `Comfort level: ${found.id} (${found.saved})` : ''
  return [head, tail].filter(Boolean).join(' | ')
}

// The instruction added to every AI prompt (free, Basic and Pro). Returns null when the owner has not chosen a level.
export function comfortRule(value: string | null | undefined): string | null {
  const { level } = parseComfort(value)
  return COMFORT_LEVELS.find((l) => l.id === level)?.rule ?? null
}
