import { NextRequest, NextResponse } from 'next/server'
import { freeGate, field, askForJson, SAFE_RULES } from '@/lib/freeTool'

type Idea = { title: string; hook: string; film: string }

// Free reel idea generator on the public site: three ideas for any business, no account needed
export async function POST(req: NextRequest) {
  try {
    const gate = await freeGate(req, 'ideas')
    if (!gate.ok) return gate.res
    const business = field(gate.body.business, 80)
    const place = field(gate.body.place, 60)
    const goal = field(gate.body.goal, 80)
    if (business.length < 2) return NextResponse.json({ error: 'Tell us what kind of business you have.' }, { status: 400 })

    const prompt = `You write short-form video ideas (Instagram Reels, TikTok) for small local businesses.

Business type: ${business}
${place ? `Where: ${place}\n` : ''}${goal ? `What they want more of: ${goal}\n` : ''}
Write 3 reel ideas this business could film on a phone this week. Make them specific to this type of business, varied (for example one behind the scenes, one teaching something, one showing a result or a customer), and easy to film alone.

For each idea give:
- title: up to 7 words
- hook: the first line to say or put on screen, up to 14 words, that makes people stop scrolling
- film: what to film, as 1 or 2 short sentences of plain shots

Rules:
${SAFE_RULES}

Respond ONLY with JSON in this exact shape, nothing else:
{ "ideas": [ { "title": "...", "hook": "...", "film": "..." } ] }
If you must refuse, respond with { "ideas": [] }`

    const out = await askForJson<{ ideas?: Idea[] }>('ideas', prompt, 700)
    const ideas = (out?.ideas || [])
      .filter((i) => i && typeof i.title === 'string' && typeof i.hook === 'string' && typeof i.film === 'string')
      .slice(0, 3)
      .map((i) => ({ title: i.title.slice(0, 90), hook: i.hook.slice(0, 160), film: i.film.slice(0, 300) }))
    if (ideas.length === 0) return NextResponse.json({ error: 'We could not make ideas for that. Try describing your business another way.' }, { status: 422 })
    return NextResponse.json({ ideas })
  } catch (e) {
    console.error('free reel-ideas error:', e instanceof Error ? e.message : 'unknown')
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
