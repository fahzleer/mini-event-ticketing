import { jwt } from "@elysiajs/jwt"
import { Elysia } from "elysia"

const JWT_SECRET = Bun.env.JWT_SECRET ?? "dev-secret-change-in-production"

// Shared JWT plugin — reused across routes
export const jwtPlugin = new Elysia({ name: "jwt-plugin" }).use(
  jwt({ name: "jwt", secret: JWT_SECRET })
)

// Auth middleware — inject userId into context ONCE (lesson from Spring Security)
// All protected routes use this; no handler ever re-verifies the token manually
export const authMiddleware = new Elysia({ name: "auth" })
  .use(jwtPlugin)
  .derive({ as: "scoped" }, async ({ jwt, headers, set }) => {
    const authHeader = headers.authorization
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined

    if (!token) {
      set.status = 401
      throw new Error("UNAUTHORIZED")
    }

    const payload = await jwt.verify(token)

    if (!payload || typeof payload.userId !== "string") {
      set.status = 401
      throw new Error("TOKEN_INVALID")
    }

    return { userId: payload.userId }
  })
