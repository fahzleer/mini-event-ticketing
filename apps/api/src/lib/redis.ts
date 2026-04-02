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
