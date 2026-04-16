# Test Data Strategy — Mini Event Ticketing System

## Why Test Data Matters

Choosing the wrong test data leads to:
- Tests that always pass but miss real bugs
- Tests that only cover the happy path
- Missed boundary conditions (e.g., exactly 10% remaining)

---

## Seed Data Design

Seed data is defined in `packages/db/src/seed.ts` and covers all three TicketBadge states intentionally.

### Badge State Coverage

| State | Condition | Example Event | Remaining / Total |
|---|---|---|---|
| Available (green) | remaining / total ≥ 10% | Southeast Asia Coffee Summit 2028 | 400 / 600 (66%) |
| Low stock (red) | remaining / total < 10% | Bangkok Coffee Festival 2026 | 42 / 500 (8.4%) |
| Sold out (gray) | remaining = 0 | Annual Bangkok Coffee Festival | 0 / 1000 |

### Why These Values?

| Decision | Reason |
|---|---|
| Low stock events use 7–9% remaining | Clearly below the 10% threshold — avoids ambiguity at the boundary |
| Multiple sold-out events | Ensures "Sold out" badge is always visible regardless of booking activity |
| Large total tickets (500–1000) | Realistic for festival-scale events |
| Small total tickets (20) | Covers edge case: sold out quickly with few tickets |

---

## Boundary Values

The TicketBadge threshold is **10%**. These are the critical boundary values to test:

| remaining / total | Badge State | Test Case |
|---|---|---|
| 0 / 100 | Sold out (gray) | TC-EVT-04 |
| 9 / 100 (9%) | Low stock (red) | TC-EVT-03 |
| 10 / 100 (10%) | Available (green) | TC-EVT-02 |
| 11 / 100 (11%) | Available (green) | TC-EVT-02 |
| 100 / 100 | Available (green) | TC-EVT-02 |

> **Key insight:** exactly 10% is green, anything below is red. The boundary is `< 0.1`, not `<= 0.1`.

---

## Booking Limit Boundary Values

Per-user limit per event is **5 tickets**.

| Quantity booked | Result | Test Case |
|---|---|---|
| 1 | Allowed | TC-BK-01 |
| 5 | Allowed (max) | TC-BK-02 |
| 6 (single request) | LIMIT_EXCEEDED | TC-BK-04 |
| 3 + 3 = 6 (cumulative) | Second rejected | TC-BK-05 |
| 3 + 2 = 5 (cumulative) | Both allowed | TC-BK-03 |
| 5 + 1 = 6 (cumulative) | Second rejected | TC-BK-06 |

---

## Concurrency Test Data

| Test | Event Setup | Users | Why |
|---|---|---|---|
| TC-CON-01 | 10 tickets total | 100 users | Guarantees 90 must fail — proves no oversell |
| TC-CON-02 | 1 ticket total | 2 users | Tightest possible race — only 1 can win |
| TC-CON-03 | Fewest-remaining event (≥1) | 2 browser contexts | Real UI race — both click Book simultaneously |
| TC-CON-04 | 1 ticket total | 2 users | Same setup as CON-02 — verifies error code, not just count |

> **Why 100 users on 10 tickets?**
> Using more concurrent requests than available tickets makes the test deterministic —
> if any more than 10 succeed, the race condition is proven.

---

## Rate Limiting Test Data

The booking rate limit is **10 requests per user per 60-second window**, defined as `RATE_LIMIT = 10` in `apps/api/src/routes/bookings.ts`.

| Test | Requests fired | Users | Why |
|---|---|---|---|
| TC-RL-01 | 11 requests (same user) | 1 user | 11th must return RATE_LIMITED |
| TC-RL-02 | 10 requests (same user) | 1 user | None of the first 10 must return RATE_LIMITED |
| TC-RL-03 | 10 (user A) + 1 (user B) | 2 users | Proves counter is per-user, not global |

> **Why use an event with the most remaining tickets?**
> Rate limit tests fire 10+ requests rapidly. Using an event with large remaining count
> ensures `NOT_ENOUGH_TICKETS` never appears before `RATE_LIMITED` — keeping the test focused.

---

## Regression Test Data

Regression tests live in `apps/api/src/tests/regression.test.ts` and test AuthService, EventService, and BookingService directly — no HTTP layer.

### Auth Test Data

| Test | Input | Why this value |
|---|---|---|
| TC-REG-01 / TC-LOGIN-01 | `password: "Password1!"` | Satisfies all 5 rules: 8+ chars, uppercase, lowercase, digit, special char |
| TC-REG-02 | Same email registered twice | Minimal setup to trigger EMAIL_TAKEN — no extra fields needed |
| TC-REG-03 | Register then inspect DB row | Verifies bcrypt prefix `$2b$` — plaintext would never match |
| TC-REG-04 / TC-LOGIN-04 | `password: "Str0ng!Pass"` | Different value from TC-REG-01 — proves hash round-trip works in general, not just for one string |
| TC-LOGIN-02 | Correct email + `"WrongPassword1!"` | Password that passes format rules but doesn't match stored hash |
| TC-LOGIN-03 | `email: "ghost@nowhere.local"` | Domain `.local` is not routable — will never collide with real or seed data |

### Event Test Data

| Test | Event Setup | Why |
|---|---|---|
| TC-EVT-SVC-01 | Two events: `eventDate: "2099-01-01"` and `"2099-06-01"` | Far-future dates ensure they sort after all seed events — result order is predictable |
| TC-EVT-SVC-02..03 | Event with 100 tickets | Round number — easy to verify, no math required |
| TC-EVT-SVC-04 | Two bookings: qty 2 + qty 1 | Tests that `SUM()` aggregates correctly across multiple rows |
| TC-EVT-SVC-05 | 3 confirmed + 2 cancelled | Minimal setup to prove cancelled status is excluded from SUM |
| TC-EVT-SVC-06 | `id: "00000000-0000-0000-0000-000000000000"` | Valid UUID format — won't cause format errors, but guaranteed to not exist |
| TC-EVT-SVC-07 | User A: 1 ticket, User B: 3 tickets | Asymmetric quantities make isolation obvious — if isolation breaks, count would be 4 not 1 |

### Booking Test Data

| Test | Event Setup | Why |
|---|---|---|
| TC-BK-SVC-02 | Event with 100 tickets | Large enough that booking won't fail for unrelated reasons |
| TC-BK-SVC-03 | Two events, book A then B | Separate events guarantee independent booking records — order test is unambiguous |
| TC-BK-SVC-05 | 50 tickets, book 3 | Non-round numbers (50, 3, result = 47) — round numbers can mask off-by-one errors |
| TC-BK-SVC-06 | 10 tickets, book 3 + 4 | Sum to 7, leaving 3 — distinct from total and from each individual quantity |
| TC-BK-SVC-07 | `remainingTickets: 0` | Boundary: zero is the exact threshold for NOT_ENOUGH_TICKETS |
| TC-BK-SVC-08 | `remainingTickets: 2`, book 3 | Off-by-one above boundary — quantity exceeds remaining by exactly 1 |

### Why `eventDate: 2099-12-31` for regression events?

All regression test events use a far-future date. This ensures:
- Regression events never appear mixed into seed data results
- `findAll()` ordering tests produce deterministic results
- Events cannot be confused with real fixture data when debugging

---

## Dynamic Test Data (E2E + Regression Tests)

Tests that hit the API or services directly create their own isolated users to avoid conflicts:

```typescript
// E2E helpers (apps/web/e2e/helpers/api.ts)
export function uniqueEmail(): string {
  return `test+${Date.now()}_${Math.random().toString(36).slice(2, 7)}@playwright.local`
}

// Regression tests (apps/api/src/tests/regression.test.ts)
function uniqueEmail() {
  return `regression+${Date.now()}_${Math.random().toString(36).slice(2, 7)}@test.local`
}
```

Different email domains (`@playwright.local` vs `@test.local`) make it easy to identify which test suite created a record when inspecting the database.

### Why dynamic emails?
- Prevents test interference (two tests using the same account)
- Each test run is independent and repeatable
- Domain prefix (`regression+` vs `test+`) distinguishes test suite origin at a glance

---

## Test Data Cleanup

| Test Type | Cleanup Strategy |
|---|---|
| Regression (`regression.test.ts`) | Explicit `db.delete()` in each test immediately after assertions |
| Integration (`concurrency.test.ts`) | Explicit `db.delete()` in each test after assertions |
| E2E (Playwright) | Test users remain in DB — acceptable for portfolio/demo project |
| Seed data | Re-run `bun src/seed.ts` to reset to known state |

> **Note:** Running E2E tests against production will create real users in the Railway database.
> For clean testing, run against local environment using Docker.
