import { Elysia } from "elysia"
import { authMiddleware } from "../middleware/auth.middleware"
import { EventService } from "../services/event.service"

export const eventRoutes = new Elysia({ prefix: "/events" })
  // Public: list all events (no auth required)
  .get("/", async () => {
    const data = await EventService.findAll()
    return { success: true, data }
  })
  // Public: get event detail — but shows myBookedCount if user is logged in
  // Uses optional auth by reading Authorization header manually (not forced)
  .use(authMiddleware)
  .get("/:id", async ({ params: { id }, userId }) => {
    const data = await EventService.findById(id, userId)
    return { success: true, data }
  })
