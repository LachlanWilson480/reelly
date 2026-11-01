// Writes one line per AI call to the server log (Vercel > Logs, search "ai-usage") so real token use can be checked.
type Usage = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }

export function logUsage(route: string, model: string, message: { usage?: Usage }) {
  const u = message.usage
  if (!u) return
  console.log(`ai-usage ${JSON.stringify({ route, model, in: u.input_tokens ?? 0, out: u.output_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 })}`)
}
