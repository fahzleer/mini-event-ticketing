import { LoginSchema, RegisterSchema } from "@repo/types"
import { type } from "arktype"
import { Elysia } from "elysia"
import {
  blacklistToken,
  deleteRefreshToken,
  getRefreshTokenUserId,
  storeRefreshToken,
} from "../lib/redis"
import { authMiddleware, jwtPlugin } from "../middleware/auth.middleware"
import { AuthService } from "../services/auth.service"

const ACCESS_TOKEN_EXP_SEC = 15 * 60 // 15 minutes

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(jwtPlugin)
  .post(
    "/register",
    async ({ body, jwt }) => {
      const input = RegisterSchema(body)
      if (input instanceof type.errors) {
        throw new Error("VALIDATION_ERROR")
      }

      const user = await AuthService.register(input)
      const accessToken = await jwt.sign({
        userId: user.id,
        exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXP_SEC,
      })
      const refreshToken = crypto.randomUUID()
      await storeRefreshToken(refreshToken, user.id)

      return { success: true, data: { token: accessToken, refreshToken, user } }
    },
    {
      detail: { tags: ["Auth"], summary: "Register a new user" },
    }
  )
  .post(
    "/login",
    async ({ body, jwt }) => {
      const input = LoginSchema(body)
      if (input instanceof type.errors) {
        throw new Error("VALIDATION_ERROR")
      }

      const user = await AuthService.login(input)
      const accessToken = await jwt.sign({
        userId: user.id,
        exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXP_SEC,
      })
      const refreshToken = crypto.randomUUID()
      await storeRefreshToken(refreshToken, user.id)

      return { success: true, data: { token: accessToken, refreshToken, user } }
    },
    {
      detail: { tags: ["Auth"], summary: "Login with email and password" },
    }
  )
  .post(
    "/refresh",
    async ({ body, jwt }) => {
      const { refreshToken } = body as { refreshToken: string }
      if (!refreshToken) throw new Error("VALIDATION_ERROR")

      const userId = await getRefreshTokenUserId(refreshToken)
      if (!userId) throw new Error("TOKEN_INVALID")

      await deleteRefreshToken(refreshToken)
      const accessToken = await jwt.sign({
        userId,
        exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXP_SEC,
      })
      const newRefreshToken = crypto.randomUUID()
      await storeRefreshToken(newRefreshToken, userId)

      return { success: true, data: { token: accessToken, refreshToken: newRefreshToken } }
    },
    {
      detail: { tags: ["Auth"], summary: "Refresh access token" },
    }
  )
  .use(authMiddleware)
  .post(
    "/logout",
    async ({ token }) => {
      await blacklistToken(token, ACCESS_TOKEN_EXP_SEC)
      return { success: true }
    },
    {
      detail: { tags: ["Auth"], summary: "Logout and revoke token" },
    }
  )
