// e2e/helpers/auth.ts
import { APIRequestContext, Page } from '@playwright/test'

const BACKEND = 'http://localhost:3000'

export const TEST_USER = {
  email: 'playwright@test.com',
  password: 'password123',
  nom: 'Playwright User',
}

/**
 * Logs in via the test-only endpoint and injects the cookie into
 * BOTH the browser context AND the page.request context.
 */
export async function loginAs(page: Page, user = TEST_USER) {
  // Use page.request so the response cookie gets stored in the same
  // APIRequestContext that subsequent page.request calls will use
  const response = await page.request.post(`${BACKEND}/auth/test/login`, {
    data: { email: user.email, password: user.password, nom: user.nom },
  })

  const body = await response.json()

  // Also inject the cookie into the browser context so page.goto() works
  const rawCookie = response.headers()['set-cookie'] ?? ''
  const match = rawCookie.match(/access_token=([^;]+)/)
  if (match) {
    await page.context().addCookies([{
      name: 'access_token',
      value: match[1],
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    }])
  }

  return body.user
}

/**
 * Wipes test data from the DB.
 */
export async function cleanupTestUser(
  request: APIRequestContext,
  email = TEST_USER.email,
) {
  const loginRes = await request.post(`${BACKEND}/auth/test/login`, {
    data: { email, password: TEST_USER.password, nom: TEST_USER.nom },
  })
  if (!loginRes.ok()) return

  const wsRes = await request.get(`${BACKEND}/workspaces`)
  if (wsRes.ok()) {
    const workspaces = await wsRes.json()
    for (const ws of workspaces) {
      if (ws.isOwner) {
        await request.delete(`${BACKEND}/workspaces/${ws.id}`)
      }
    }
  }
}