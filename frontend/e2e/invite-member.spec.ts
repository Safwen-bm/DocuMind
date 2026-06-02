// e2e/invite-member.spec.ts
import { test, expect } from '@playwright/test'
import { loginAs, cleanupTestUser } from './helpers/auth'

const BACKEND = 'http://localhost:3000'

const OWNER = {
  email: 'owner@playwright.com',
  password: 'password123',
  nom: 'WS Owner',
}
const MEMBER = {
  email: 'member@playwright.com',
  password: 'password123',
  nom: 'New Member',
}

/** Helper — creates member user and returns their id */
async function createMemberUser(page: any) {
  const res = await page.request.post(`${BACKEND}/auth/test/login`, {
    data: { email: MEMBER.email, password: MEMBER.password, nom: MEMBER.nom },
  })
  const body = await res.json()
  return body.user.id as string
}

/** Helper — sends an invitation as the currently logged-in user and returns the token */
async function sendInvitation(page: any, workspaceId: string, role = 'LECTEUR') {
  const inviteRes = await page.request.post(
    `${BACKEND}/workspaces/${workspaceId}/invitations`,
    { data: { email: MEMBER.email, role } },
  )
  expect(inviteRes.ok()).toBeTruthy()

  // The invite endpoint only returns { message }, so we fetch the token
  // via the test-only endpoint instead
  const tokenRes = await page.request.get(
    `${BACKEND}/test/invitations/token?email=${MEMBER.email}`,
  )
  expect(tokenRes.ok()).toBeTruthy()
  const { token } = await tokenRes.json()
  expect(token).toBeTruthy()
  return token as string
}

test.describe('Invite member flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER)
  })

  test.afterEach(async ({ request }) => {
    await cleanupTestUser(request, OWNER.email)
    await cleanupTestUser(request, MEMBER.email)
  })

  test('members page shows owner as PROPRIETAIRE', async ({ page }) => {
    const wsRes = await page.request.post(`${BACKEND}/workspaces`, {
      data: { nom: 'Members Test WS' },
    })
    const ws = await wsRes.json()

    await page.goto(`/en/workspace/${ws.id}/members`)
    await page.waitForLoadState('networkidle')

    // Scope to main content only — avoids sidebar duplicate
    const main = page.getByRole('main')
    await expect(main.getByText('WS Owner').first()).toBeVisible({ timeout: 6000 })
    await expect(main.getByText(/proprietaire|owner/i).first()).toBeVisible({ timeout: 6000 })
  })

  test('invite form is visible on members page for owner', async ({ page }) => {
    const wsRes = await page.request.post(`${BACKEND}/workspaces`, {
      data: { nom: 'Invite Test WS' },
    })
    const ws = await wsRes.json()

    await page.goto(`/en/workspace/${ws.id}/members`)
    await page.waitForLoadState('networkidle')

    const inviteBtn = page.getByRole('button', { name: /invite|inviter/i })
    const emailInput = page.getByPlaceholder(/email/i)

    const hasInviteBtn = await inviteBtn.isVisible({ timeout: 5000 }).catch(() => false)
    const hasEmailInput = await emailInput.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasInviteBtn || hasEmailInput).toBeTruthy()
  })

  test('sending invitation via API creates invitation in DB', async ({ page }) => {
    const wsRes = await page.request.post(`${BACKEND}/workspaces`, {
      data: { nom: 'API Invite WS' },
    })
    expect(wsRes.ok()).toBeTruthy()
    const ws = await wsRes.json()

    await createMemberUser(page)
    await loginAs(page, OWNER)

    const token = await sendInvitation(page, ws.id, 'LECTEUR')
    expect(token).toBeTruthy()
  })

  test('member can accept invitation and joins workspace', async ({ page }) => {
    const wsRes = await page.request.post(`${BACKEND}/workspaces`, {
      data: { nom: 'Accept Invite WS' },
    })
    const ws = await wsRes.json()

    await createMemberUser(page)
    await loginAs(page, OWNER)

    const token = await sendInvitation(page, ws.id, 'EDITEUR')

    // Accept as member
    await loginAs(page, MEMBER)
    const acceptRes = await page.request.get(
      `${BACKEND}/invitations/accept?token=${token}`,
    )
    expect(acceptRes.ok()).toBeTruthy()

    // Verify membership as owner
    await loginAs(page, OWNER)
    const membersRes = await page.request.get(`${BACKEND}/workspaces/${ws.id}/members`)
    expect(membersRes.ok()).toBeTruthy()
    const members = await membersRes.json()

    const emails = members.map((m: any) => m.utilisateur?.email)
    expect(emails).toContain(MEMBER.email)
  })

  test('owner can change member role', async ({ page }) => {
    const wsRes = await page.request.post(`${BACKEND}/workspaces`, {
      data: { nom: 'Role Change WS' },
    })
    const ws = await wsRes.json()

    const memberId = await createMemberUser(page)
    await loginAs(page, OWNER)

    const token = await sendInvitation(page, ws.id, 'LECTEUR')

    // Accept as member
    await loginAs(page, MEMBER)
    const acceptRes = await page.request.get(
      `${BACKEND}/invitations/accept?token=${token}`,
    )
    expect(acceptRes.ok()).toBeTruthy()

    // Change role as owner
    await loginAs(page, OWNER)
    const changeRes = await page.request.patch(
      `${BACKEND}/workspaces/${ws.id}/members/${memberId}`,
      { data: { role: 'EDITEUR' } },
    )
    expect(changeRes.ok()).toBeTruthy()

    // Verify
    const updatedRes = await page.request.get(`${BACKEND}/workspaces/${ws.id}/members`)
    const updated = await updatedRes.json()
    const updatedMember = updated.find((m: any) => m.utilisateur?.email === MEMBER.email)
    expect(updatedMember?.role).toBe('EDITEUR')
  })

  test('members page UI shows member count', async ({ page }) => {
    const wsRes = await page.request.post(`${BACKEND}/workspaces`, {
      data: { nom: 'Count Test WS' },
    })
    const ws = await wsRes.json()

    await page.goto(`/en/workspace/${ws.id}/members`)
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByText(/1 members? in your workspace/i).first(),
    ).toBeVisible({ timeout: 6000 })
  })
})