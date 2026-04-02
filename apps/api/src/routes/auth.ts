import { LoginSchema, RegisterSchema } from "@repo/types"
import { type } from "arktype"
import { Elysia } from "elysia"
import { jwtPlugin } from "../middleware/auth.middleware"
import { AuthService } from "../services/auth.service"

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
      const token = await jwt.sign({ userId: user.id })

      return { success: true, data: { token, user } }
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
      const token = await jwt.sign({ userId: user.id })

      return { success: true, data: { token, user } }
    },
    {
      detail: { tags: ["Auth"], summary: "Login with email and password" },
    }
  )
