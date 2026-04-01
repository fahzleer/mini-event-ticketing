/// <reference types="@types/bun" />
import type { Config } from "drizzle-kit"

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: Bun.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/ticketing",
  },
} satisfies Config
