# Test Case Specification — Mini Event Ticketing System

## Overview

| Field | Detail |
|---|---|
| Project | Mini Event Ticketing System |
| Version | 1.1 |
| Coverage | Auth · Event Browsing · Booking · Concurrency · Rate Limiting · Regression |
| Test Types | Manual · Integration · E2E (Playwright) · Regression (Bun:test) |

---

## 1. Auth

### 1.1 Register

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-AUTH-01 | Valid registration | name, valid email, password meeting all 5 rules (8+ chars, A-Z, a-z, 0-9, !@#$%^&*) | Account created, token returned, redirect to event list | E2E |
| TC-AUTH-02 | Duplicate email | Already registered email | Error: email already exists | E2E |
| TC-AUTH-03 | Invalid email format | `notanemail` | Validation error shown | E2E |
| TC-AUTH-04a | Weak password — too short | `Ab1!` (less than 8 chars) | Validation error: 8+ characters | E2E |
| TC-AUTH-04b | Weak password — no uppercase | `abcdef1!` (no A-Z) | Validation error: one uppercase letter | E2E |
| TC-AUTH-04c | Weak password — no lowercase | `ABCDEF1!` (no a-z) | Validation error: one lowercase letter | E2E |
| TC-AUTH-04d | Weak password — no number | `Abcdefg!` (no 0-9) | Validation error: one number | E2E |
| TC-AUTH-04e | Weak password — no special character | `Abcdef12` (no !@#$%^&*) | Validation error: one special character | E2E |
| TC-AUTH-05 | Missing required field | name empty | Validation error shown | E2E |

### 1.2 Login

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-AUTH-06 | Valid credentials | Registered email + correct password | Token returned, redirect to event list | E2E |
| TC-AUTH-07 | Wrong password | Registered email + wrong password | Error message shown | E2E |
| TC-AUTH-08 | Non-existent email | Unregistered email | Error message shown | E2E |
| TC-AUTH-09 | Empty fields | Empty email + empty password | Validation error shown | Manual |

### 1.3 Logout & Token Security

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-AUTH-10 | Logout blacklists token | Valid access token → logout → use same token | API returns 401 TOKEN_REVOKED | Integration |
| TC-AUTH-11 | UI redirects after logout | Logged-in session → click Log out | Redirected to /login | E2E |
| TC-AUTH-12 | Unauthenticated access | No token → visit / | Redirected to /login | E2E |

### 1.4 Refresh Token

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-AUTH-13 | Refresh returns new token pair | Valid refresh token | New access token + new refresh token returned | Integration |
| TC-AUTH-14 | Refresh token rotation | Use refresh token A → get token B → replay token A | TOKEN_INVALID error | Integration |
| TC-AUTH-15 | New access token is valid | Access token from refresh | API accepts new token (200 OK) | Integration |

---

## 2. Event Browsing

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-EVT-01 | Event list loads | Authenticated user visits / | All events displayed | E2E |
| TC-EVT-02 | Available badge (green) | Event with remaining ≥ 10% of total | Badge shows "X left" (green) | E2E |
| TC-EVT-03 | Low stock badge (red) | Event with remaining < 10% of total | Badge shows "Only X left!" (red) | E2E |
| TC-EVT-04 | Sold out badge (gray) | Event with remaining = 0 | Badge shows "Sold out" (gray) | E2E |
| TC-EVT-05 | All 3 badge states visible | Seed data loaded | Green + red + gray badges all visible on list | E2E |
| TC-EVT-06 | Event detail page | Click any event card | Event name, date, venue, remaining tickets shown | Manual |

---

## 3. Booking

### 3.1 Normal Flow

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-BK-01 | Book 1 ticket | Valid event, quantity = 1 | Success message shown, remaining decrements | E2E |
| TC-BK-02 | Book max 5 tickets | Valid event, quantity = 5 | Success, remaining decrements by 5 | Manual |
| TC-BK-03 | Book across multiple sessions | Book 3 → book 2 (same event) | Both succeed, total = 5 | Integration |

### 3.2 Limit Enforcement

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-BK-04 | Exceed 5-ticket limit (single request) | quantity = 6 | LIMIT_EXCEEDED error | Integration |
| TC-BK-05 | Exceed 5-ticket limit (cumulative) | Book 3 → book 3 again (same event) | Second booking rejected: LIMIT_EXCEEDED | Integration |
| TC-BK-06 | Limit reached — UI hides form | User already booked 5 tickets | Booking form replaced with limit message | E2E |
| TC-BK-07 | Limits are per-event | Book 5 on event A → book on event B | Event B booking allowed | Manual |

### 3.3 Sold Out

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-BK-08 | Sold out event hides booking form | Event with remaining = 0 | "Sold out" shown, no Book button visible | E2E |
| TC-BK-09 | API rejects booking on sold out event | POST /bookings on sold out event | NOT_ENOUGH_TICKETS error | Integration |

### 3.4 My Bookings

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-BK-10 | View own bookings | Authenticated user visits /dashboard | Own confirmed bookings listed | Manual |

---

## 4. Concurrency

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-CON-01 | 100 concurrent bookings on 10-ticket event | 100 users fire simultaneously | Exactly 10 succeed, 90 fail gracefully | Integration |
| TC-CON-02 | Remaining tickets never go below 0 | 2 users race for last ticket | 1 succeeds, remaining = 0 (never negative) | Integration |
| TC-CON-03 | Two browser sessions race for last ticket | 2 browser contexts book simultaneously | At most 1 sees success in UI | E2E |
| TC-CON-04 | Failure returns meaningful error code | Losing request in race | Error code is NOT_ENOUGH_TICKETS or SYSTEM_BUSY (not 500) | Integration |

---

## 5. Rate Limiting

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-RL-01 | 11th request within 60s is rejected | Same user fires 11 booking requests rapidly | 11th returns RATE_LIMITED | E2E |
| TC-RL-02 | First 10 requests are not throttled | Same user fires 10 requests | None returns RATE_LIMITED | E2E |
| TC-RL-03 | Rate limit is per user | User A exhausts quota → User B sends request | User B is not affected | E2E |

---

---

## 6. Regression

Regression tests are service-level integration tests in `apps/api/src/tests/regression.test.ts`.
They verify that core service logic does not silently break when the codebase changes.

### 6.1 AuthService — Register

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-REG-01 | Valid registration returns user without password | name, valid email, strong password | User object returned with id, email, name, createdAt — password field absent | Regression |
| TC-REG-02 | Duplicate email throws EMAIL_TAKEN | Email already in DB | Error: EMAIL_TAKEN | Regression |
| TC-REG-03 | Password stored as bcrypt hash, not plaintext | Any valid registration | Stored password starts with `$2b$`, not equal to plaintext | Regression |
| TC-REG-04 | Login succeeds with registered password (hash round-trip) | Register → login with same credentials | Login returns same user id | Regression |

### 6.2 AuthService — Login

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-LOGIN-01 | Valid credentials return user profile | Registered email + correct password | User object returned, password field absent | Regression |
| TC-LOGIN-02 | Wrong password throws INVALID_CREDENTIALS | Registered email + wrong password | Error: INVALID_CREDENTIALS | Regression |
| TC-LOGIN-03 | Non-existent email throws INVALID_CREDENTIALS | Unregistered email | Error: INVALID_CREDENTIALS | Regression |
| TC-LOGIN-04 | Hash round-trip: correct password always matches | Register → login | login id matches register id | Regression |

### 6.3 EventService — findAll

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-EVT-SVC-01 | Returns events ordered by eventDate ASC | Two events with different dates | Earlier date appears before later date in result | Regression |

### 6.4 EventService — findById

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-EVT-SVC-02 | myBookedCount = 0 when no userId provided | findById without userId | myBookedCount = 0 | Regression |
| TC-EVT-SVC-03 | myBookedCount = 0 when userId has no bookings | userId with no bookings on this event | myBookedCount = 0 | Regression |
| TC-EVT-SVC-04 | myBookedCount sums confirmed bookings correctly | User has 2 confirmed bookings (qty 2 + qty 1) | myBookedCount = 3 | Regression |
| TC-EVT-SVC-05 | myBookedCount excludes cancelled bookings | 3 confirmed + 2 cancelled | myBookedCount = 3 (not 5) | Regression |
| TC-EVT-SVC-06 | Non-existent event ID throws EVENT_NOT_FOUND | UUID not in DB | Error: EVENT_NOT_FOUND | Regression |
| TC-EVT-SVC-07 | myBookedCount is per-user: other users' bookings excluded | User A books 1, User B books 3 → query as User A | myBookedCount = 1 | Regression |

### 6.5 BookingService — getMyBookings

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-BK-SVC-01 | Returns empty array when user has no bookings | userId with no bookings | Empty array | Regression |
| TC-BK-SVC-02 | Returns confirmed bookings with related event data | User with 1 booking | Array length 1, event object joined | Regression |
| TC-BK-SVC-03 | Returns bookings ordered by createdAt DESC | User books event A then event B | Event B appears first | Regression |
| TC-BK-SVC-04 | Does not return other users' bookings | Two users book same event | Each user sees only their own booking | Regression |

### 6.6 BookingService — ticket count consistency

| TC-ID | Scenario | Input | Expected Result | Type |
|---|---|---|---|---|
| TC-BK-SVC-05 | remainingTickets decrements by exact booked quantity | Event with 50 tickets, book 3 | remainingTickets = 47 | Regression |
| TC-BK-SVC-06 | remainingTickets consistent across sequential bookings | Book 3 (user A) + 4 (user B) on 10-ticket event | remainingTickets = 3 | Regression |
| TC-BK-SVC-07 | Booking on 0-ticket event throws NOT_ENOUGH_TICKETS | Event with remainingTickets = 0 | Error: NOT_ENOUGH_TICKETS | Regression |
| TC-BK-SVC-08 | Booking more than remaining throws NOT_ENOUGH_TICKETS | 2 remaining, book 3 | Error: NOT_ENOUGH_TICKETS, remaining unchanged | Regression |

---

## Test Coverage Matrix

| Feature | Regression | Integration | E2E | Manual |
|---|---|---|---|---|
| Register | ✅ | ❌ | ✅ | ✅ |
| Login | ✅ | ❌ | ✅ | ✅ |
| Password hashing | ✅ | ❌ | ❌ | ❌ |
| Logout + token blacklist | ❌ | ✅ | ✅ | ❌ |
| Refresh token rotation | ❌ | ✅ | ❌ | ❌ |
| Unauthenticated guard | ❌ | ❌ | ✅ | ✅ |
| Event list order (ASC) | ✅ | ❌ | ❌ | ❌ |
| Event list + badges | ❌ | ❌ | ✅ | ✅ |
| myBookedCount accuracy | ✅ | ❌ | ❌ | ❌ |
| Book tickets (normal) | ✅ | ✅ | ✅ | ✅ |
| 5-ticket limit | ❌ | ✅ | ✅ | ✅ |
| Sold out guard | ✅ | ✅ | ✅ | ✅ |
| remainingTickets consistency | ✅ | ❌ | ❌ | ❌ |
| getMyBookings isolation | ✅ | ❌ | ❌ | ❌ |
| Concurrency (no oversell) | ❌ | ✅ | ✅ | ❌ |
| Rate limiting | ❌ | ❌ | ✅ | ❌ |
