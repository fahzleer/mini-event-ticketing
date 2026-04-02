import path from "node:path"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { db, queryClient } from "./client"

const migrationsFolder = path.join(import.meta.dir, "..", "drizzle")

console.log("Running migrations...")
await migrate(db, { migrationsFolder })
console.log("Migrations complete.")

await queryClient.end()
