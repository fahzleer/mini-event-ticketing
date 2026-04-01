# Mini Event Ticketing System

A web app for booking event tickets — handles limited inventory accurately, even under heavy concurrent load.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + Bun Workspaces |
| Linter/Formatter | Biome |
| Backend | ElysiaJS (Bun-native) |
| Validation | ArkType + ArkRegex |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Cache/Lock | Redis |
| Frontend | React + TypeScript + Vite |
| Data Fetching | TanStack Query |

---

## Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Docker](https://docker.com) & Docker Compose

---

## Quick Start

```bash
# 1. Spin up the databases
docker-compose up -d

# 2. Install dependencies
bun install

# 3. Copy env files
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 4. Run migrations
cd packages/db && bun drizzle-kit migrate && cd ../..

# 5. Seed some sample data
cd packages/db && bun src/seed.ts && cd ../..

# 6. Start dev servers
bun dev
```

- API → http://localhost:3000
- Web → http://localhost:5173
- Swagger Docs → http://localhost:3000/docs

---

## Tests

```bash
bun test                 # run everything
bun test concurrency     # the critical one
bun test --verbose       # if you want the full picture
```

---

## API Endpoints

### Auth
```
POST /auth/register   { email, password, name }
POST /auth/login      { email, password }
```

### Events
```
GET /events        list all events
GET /events/:id    event detail (myBookedCount included if signed in)
```

### Bookings — requires auth
```
POST /bookings     { eventId, quantity (1–5) }
GET  /bookings/my  your booked tickets
```

---

## Why These Choices

**ElysiaJS over Express**
Bun-native, TypeScript-first, validation built in. Express leans on Node.js internals that don't sit well with modern Bun tooling.

**Drizzle over TypeORM**
No decorator magic. SQL-like syntax, Bun-compatible, and types flow straight from the schema — one source of truth.

**ArkType + ArkRegex**
Roughly 100× faster than Zod, better type inference. ArkRegex (Jan 2026) pushes regex validation to compile time, so shape errors surface before runtime.

---

## Concurrency — How Overselling Is Prevented

Selling the same ticket twice is the core risk. Three layers handle it:

```
Layer 1 — Redis Distributed Lock
  One request per event enters the critical section at a time.

Layer 2 — PostgreSQL SELECT FOR UPDATE
  Row-level lock inside a transaction. No dirty reads.

Layer 3 — PostgreSQL CHECK Constraint
  remaining_tickets >= 0, enforced at the database level.
  The last line of defence if anything slips through.

Bonus — TOCTOU double-check inside the lock
  User limit is re-validated inside the lock,
  so two concurrent requests can't both sneak past the pre-check.
```

---

## Route Order Matters

```
GET /bookings/my   ← specific, must come first
GET /bookings/:id  ← parameterised, comes after
```

Elysia matches top-down. Put the parameterised route first and `/my` gets read as `/:id = "my"` — not what you want.

---

## Project Structure

```
mini-ticketing/
├── apps/
│   ├── api/        ElysiaJS backend
│   └── web/        React + Vite frontend
├── packages/
│   ├── db/         Drizzle schema + client
│   ├── types/      ArkType schemas + shared types
│   └── tsconfig/   shared TypeScript config
├── docker-compose.yml
├── turbo.json
└── biome.json
```
