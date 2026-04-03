import Redis from "ioredis"

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379"

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

redis.on("error", (err) => {
  console.error("❌ Redis error:", err)
})

redis.on("connect", () => {
  console.log("✅ Redis connected")
})

// ─── Distributed Lock Helpers ─────────────────────────────────────────────────

const LOCK_PREFIX = "lock:"

export async function acquireLock(key: string, ttlMs = 5000, waitMs = ttlMs): Promise<boolean> {
  const deadline = Date.now() + waitMs
  while (Date.now() < deadline) {
    const result = await redis.set(`${LOCK_PREFIX}${key}`, "1", "PX", ttlMs, "NX")
    if (result === "OK") return true
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return false
}

export async function releaseLock(key: string): Promise<void> {
  await redis.del(`${LOCK_PREFIX}${key}`)
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

export async function checkRateLimit(key: string, limit: number, windowSec: number): Promise<void> {
  const count = await redis.incr(`rate:${key}`)
  if (count === 1) await redis.expire(`rate:${key}`, windowSec)
  if (count > limit) throw new Error("RATE_LIMITED")
}

// ─── Token Blacklist (logout) ─────────────────────────────────────────────────

export async function blacklistToken(token: string, ttlSec: number): Promise<void> {
  await redis.set(`blacklist:${token}`, "1", "EX", ttlSec)
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  return (await redis.exists(`blacklist:${token}`)) === 1
}

// ─── Refresh Token Store ──────────────────────────────────────────────────────

const REFRESH_TTL_SEC = 7 * 24 * 60 * 60 // 7 days

export async function storeRefreshToken(token: string, userId: string): Promise<void> {
  await redis.set(`refresh:${token}`, userId, "EX", REFRESH_TTL_SEC)
}

export async function getRefreshTokenUserId(token: string): Promise<string | null> {
  return redis.get(`refresh:${token}`)
}

export async function deleteRefreshToken(token: string): Promise<void> {
  await redis.del(`refresh:${token}`)
}
