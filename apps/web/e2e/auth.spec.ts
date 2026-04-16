import { expect, test } from "@playwright/test"
import { API_URL, logout, refreshTokens, register, uniqueEmail } from "./helpers/api"

/**
 * Auth security tests — things you cannot verify by looking at the UI.
 *
 * 1. Token blacklist: after logout, the old access token must be rejected (401).
 * 2. Refresh token rotation: once a refresh token is used, the original is invalidated.
 */

// ─── Register ─────────────────────────────────────────────────────────────────

test.describe("Register", () => {
  test("TC-AUTH-01 — Valid registration", async ({ page }) => {
    const email = uniqueEmail()

    await page.goto("/register")
    await page.getByLabel("Name").fill("Test User")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill("Test1234!")
    await page.getByRole("button", { name: /sign up/i }).click()

    await expect(page).toHaveURL(/^\/$|^\/events/)
    await expect(page.getByRole("button", { name: /log out/i })).toBeVisible()
  })

  test("TC-AUTH-02 — Duplicate email", async ({ page }) => {
    const email = uniqueEmail()
    await register(email)

    await page.goto("/register")
    await page.getByLabel("Name").fill("Test User")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill("Test1234!")
    await page.getByRole("button", { name: /sign up/i }).click()

    await expect(page.locator("p.text-red-600")).toBeVisible()
  })

  test("TC-AUTH-03 — Invalid email format", async ({ page }) => {
    await page.goto("/register")
    await page.getByLabel("Name").fill("Test User")
    await page.getByLabel("Email").fill("notanemail")
    await page.getByLabel("Password").fill("Test1234!")
    await page.getByRole("button", { name: /sign up/i }).click()

    await expect(page.locator("p.text-red-600")).toBeVisible()
  })

  test("TC-AUTH-04a — Weak password: too short", async ({ page }) => {
    await page.goto("/register")
    await page.getByLabel("Password").fill("Ab1!")

    await expect(page.getByText(/8.* characters/i)).toBeVisible()
  })

  test("TC-AUTH-04b — Weak password: no uppercase", async ({ page }) => {
    await page.goto("/register")
    await page.getByLabel("Password").fill("abcdef1!")

    await expect(page.getByText(/uppercase/i)).toBeVisible()
  })

  test("TC-AUTH-04c — Weak password: no lowercase", async ({ page }) => {
    await page.goto("/register")
    await page.getByLabel("Password").fill("ABCDEF1!")

    await expect(page.getByText(/lowercase/i)).toBeVisible()
  })

  test("TC-AUTH-04d — Weak password: no number", async ({ page }) => {
    await page.goto("/register")
    await page.getByLabel("Password").fill("Abcdefg!")

    await expect(page.getByText(/number/i)).toBeVisible()
  })

  test("TC-AUTH-04e — Weak password: no special character", async ({ page }) => {
    await page.goto("/register")
    await page.getByLabel("Password").fill("Abcdef12")

    await expect(page.getByText(/special/i)).toBeVisible()
  })

  test("TC-AUTH-05 — Missing required field", async ({ page }) => {
    await page.goto("/register")
    await page.getByLabel("Email").fill(uniqueEmail())
    await page.getByLabel("Password").fill("Test1234!")
    // name left empty
    await page.getByRole("button", { name: /sign up/i }).click()

    await expect(page.locator("p.text-red-600")).toBeVisible()
  })
})

// ─── Login ────────────────────────────────────────────────────────────────────

test.describe("Login", () => {
  test("TC-AUTH-06 — Valid credentials", async ({ page }) => {
    const email = uniqueEmail()
    await register(email)

    await page.goto("/login")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill("Test1234!")
    await page.getByRole("button", { name: /^log in$/i }).click()

    await expect(page).toHaveURL(/^\/$|^\/events/)
    await expect(page.getByRole("button", { name: /log out/i })).toBeVisible()
  })

  test("TC-AUTH-07 — Wrong password", async ({ page }) => {
    const email = uniqueEmail()
    await register(email)

    await page.goto("/login")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill("WrongPassword!")
    await page.getByRole("button", { name: /^log in$/i }).click()

    await expect(page.locator("p.text-red-600")).toBeVisible()
  })

  test("TC-AUTH-08 — Non-existent email", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill(uniqueEmail())
    await page.getByLabel("Password").fill("Test1234!")
    await page.getByRole("button", { name: /^log in$/i }).click()

    await expect(page.locator("p.text-red-600")).toBeVisible()
  })
})

// ─── Refresh Token ────────────────────────────────────────────────────────────

test.describe("Refresh token", () => {
  test("TC-AUTH-13 — Refresh returns new token pair", async () => {
    const email = uniqueEmail()
    const { refreshToken } = await register(email)

    const result = await refreshTokens(refreshToken)

    expect(result.token, "new access token must be returned").toBeTruthy()
    expect(result.refreshToken, "new refresh token must be returned").toBeTruthy()
    expect(result.refreshToken, "new refresh token must differ from original").not.toBe(
      refreshToken
    )
  })
})

// ─── Token Security ───────────────────────────────────────────────────────────

test.describe("Token blacklist after logout", () => {
  test("TC-AUTH-10 — Logout blacklists token", async () => {
    const email = uniqueEmail()
    const { token: accessToken } = await register(email)

    // Confirm the token works before logout
    const beforeLogout = await fetch(`${API_URL}/bookings/my`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(beforeLogout.status, "token should be valid before logout").toBe(200)

    // Blacklist the token
    await logout(accessToken)

    // The same token must now be rejected — even before the 15-min natural expiry
    const afterLogout = await fetch(`${API_URL}/bookings/my`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(afterLogout.status, "blacklisted token must return 401").toBe(401)

    const body = (await afterLogout.json()) as { code: string }
    expect(body.code, "error code must be TOKEN_REVOKED not TOKEN_EXPIRED").toBe("TOKEN_REVOKED")
  })

  test("TC-AUTH-11 — UI redirects after logout", async ({ page }) => {
    const email = uniqueEmail()
    const { token, user } = await register(email)

    // Seed localStorage so the app thinks the user is logged in
    await page.goto("/login")
    await page.evaluate(
      ({ t, u }) => {
        localStorage.setItem("token", t)
        localStorage.setItem("user", JSON.stringify(u))
      },
      { t: token, u: user }
    )

    await page.goto("/")
    await expect(page.getByRole("button", { name: /log out/i })).toBeVisible()

    // Click logout in the nav
    await page.getByRole("button", { name: /log out/i }).click()

    // Must end up on /login (protected route guards kick in)
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole("heading", { name: /log in/i })).toBeVisible()
  })
})

test.describe("Refresh token rotation", () => {
  test("TC-AUTH-14 — Refresh token rotation", async () => {
    const email = uniqueEmail()
    const { refreshToken: tokenA } = await register(email)

    // Use tokenA → server returns new pair (accessToken2, tokenB) and deletes tokenA
    const { refreshToken: tokenB } = await refreshTokens(tokenA)
    expect(tokenB, "rotated refresh token must differ from the original").not.toBe(tokenA)

    // tokenA must now be dead — cannot be used again
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokenA }),
    })
    expect(res.status, "replayed refresh token must return non-2xx").not.toBe(200)

    const body = (await res.json()) as { code: string }
    expect(body.code, "error code must be TOKEN_INVALID").toBe("TOKEN_INVALID")
  })

  test("TC-AUTH-15 — New access token is valid", async () => {
    const email = uniqueEmail()
    const { refreshToken } = await register(email)

    const { token: newAccessToken } = await refreshTokens(refreshToken)

    const res = await fetch(`${API_URL}/bookings/my`, {
      headers: { Authorization: `Bearer ${newAccessToken}` },
    })
    expect(res.status, "refreshed access token must be valid").toBe(200)
  })
})

test.describe("Unauthenticated access guard", () => {
  test("TC-AUTH-12 — Unauthenticated access", async ({ page }) => {
    // Ensure no stored credentials
    await page.goto("/login")
    await page.evaluate(() => {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
    })

    await page.goto("/")
    await expect(page).toHaveURL(/\/login/)
  })
})
