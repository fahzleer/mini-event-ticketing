import { db } from "@repo/db"
import { users } from "@repo/db/schema"
import type { LoginInput, RegisterInput } from "@repo/types"
import { eq } from "drizzle-orm"

export const AuthService = {
  async register({ email, name, password: pw }: RegisterInput) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    })
    if (existing) throw new Error("EMAIL_TAKEN")

    // Bun built-in password hashing (bcrypt)
    const hashed = await Bun.password.hash(pw)

    const [user] = await db.insert(users).values({ email, name, password: hashed }).returning({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
    })

    if (!user) throw new Error("REGISTER_FAILED")
    return user
  },

  async login({ email, password: pw }: LoginInput) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    // Always verify even if user not found (timing attack prevention)
    const dummyHash = "$2b$10$invalid.hash.to.prevent.timing.attack"
    const valid = user
      ? await Bun.password.verify(pw, user.password)
      : await Bun.password.verify(pw, dummyHash).catch(() => false)

    if (!user || !valid) throw new Error("INVALID_CREDENTIALS")

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    }
  },
}
