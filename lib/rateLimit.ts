import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const limiters: Record<string, Ratelimit> = {}

function getLimiter(limit: number, windowMs: number): Ratelimit {
  const key = `${limit}:${windowMs}`
  if (!limiters[key]) {
    limiters[key] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs}ms`),
      analytics: false,
    })
  }
  return limiters[key]
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const limiter = getLimiter(limit, windowMs)
    const { success, remaining } = await limiter.limit(key)
    return { allowed: success, remaining }
  } catch {
    // If Redis is down, fail open (allow the request)
    return { allowed: true, remaining: 1 }
  }
}
