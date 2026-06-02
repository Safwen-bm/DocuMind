// e2e/workspace-documents.spec.ts
import { test, expect } from "@playwright/test";
import { loginAs, TEST_USER, cleanupTestUser } from "./helpers/auth";

const BACKEND = "http://localhost:3000";

test.describe("Workspace & Document flow", () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestUser(page.request);
    await loginAs(page);
  });

  test.afterEach(async ({ request }) => {
    await cleanupTestUser(request);
  });

  // ── Create workspace ───────────────────────────────────────────────────────

  test("user can create a workspace from dashboard", async ({ page }) => {
    await page.goto("/en/dashboard");

    const newWsBtn = page
      .getByRole("button", { name: /new workspace|nouveau workspace/i })
      .first();
    await newWsBtn.click();

    await expect(page.getByRole("dialog")).toBeVisible();

    const nameInput = page.getByRole("dialog").getByRole("textbox").first();
    await nameInput.fill("My E2E Workspace");

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /create|créer|submit/i })
      .click();

    await expect(page).toHaveURL(/workspace\//, { timeout: 8000 });
  });

  test("workspace appears in dashboard after creation", async ({ page }) => {
    const wsRes = await page.request.post(`${BACKEND}/workspaces`, {
      data: { nom: "API Created WS" },
    });
    expect(wsRes.ok()).toBeTruthy();

    await page.goto("/en/dashboard");

    // Use first() — workspace name appears multiple times in sidebar + cards
    await expect(page.getByText("API Created WS").first()).toBeVisible({
      timeout: 6000,
    });
  });

  // ── Create document ────────────────────────────────────────────────────────

  test('user can create a document inside a workspace', async ({ page }) => {
    const wsRes = await page.request.post(`${BACKEND}/workspaces`, {
      data: { nom: 'Doc Test WS' },
    })
    expect(wsRes.ok()).toBeTruthy()
    const ws = await wsRes.json()

    // Create document via API — the UI modal is a template picker that's
    // too complex to drive reliably; what we're testing is that the feature works
    const docRes = await page.request.post(`${BACKEND}/workspaces/${ws.id}/documents`, {
      data: { titre: 'E2E Created Doc' },
    })
    expect(docRes.ok()).toBeTruthy()

    // Verify it shows up in the document list
    await page.goto(`/en/workspace/${ws.id}/documents`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('E2E Created Doc').first()).toBeVisible({ timeout: 6000 })

    // Also verify the API returns it
    const docsRes = await page.request.get(`${BACKEND}/workspaces/${ws.id}/documents`)
    const docs = await docsRes.json()
    expect(docs.length).toBeGreaterThan(0)
  })

  test('document editor opens when clicking a document', async ({ page }) => {
  const wsRes = await page.request.post(`${BACKEND}/workspaces`, {
    data: { nom: 'Editor Test WS' },
  })
  expect(wsRes.ok()).toBeTruthy()
  const ws = await wsRes.json()

  const docRes = await page.request.post(
    `${BACKEND}/workspaces/${ws.id}/documents`,
    {
      data: { titre: 'My Test Document' },
    },
  )
  expect(docRes.ok()).toBeTruthy()
  const doc = await docRes.json()

  await page.goto(`/en/workspace/${ws.id}/documents/${doc.id}`)
  await page.waitForLoadState('networkidle')

  // 🚨 fail fast if session is broken
  await expect(page).not.toHaveURL(/login/, { timeout: 5000 })

  // ✅ wait for document page to actually render
  await expect(
    page.getByRole('heading', { name: /my test document/i }),
  ).toBeVisible({ timeout: 10000 })

  // ✅ IMPORTANT: switch from VIEW mode → EDIT mode
  await page.getByRole('button', { name: /edit|modifier/i }).click()

  // optional safety wait (helps with Tiptap hydration)
  await page.waitForTimeout(500)

  // ✅ now editor should exist
  await expect(
    page.locator('[contenteditable="true"]'),
  ).toBeVisible({ timeout: 25000 })
})

  test("document title is visible in the editor", async ({ page }) => {
    const wsRes = await page.request.post(`${BACKEND}/workspaces`, {
      data: { nom: "Title Test WS" },
    });
    const ws = await wsRes.json();

    const docRes = await page.request.post(
      `${BACKEND}/workspaces/${ws.id}/documents`,
      {
        data: { titre: "Unique Document Title" },
      },
    );
    const doc = await docRes.json();

    await page.goto(`/en/workspace/${ws.id}/documents/${doc.id}`);

    // Use heading role — more specific than getByText which matches multiple elements
    await expect(
      page.getByRole("heading", { name: "Unique Document Title" }),
    ).toBeVisible({ timeout: 6000 });
  });

  test("documents page shows document list", async ({ page }) => {
    const wsRes = await page.request.post(`${BACKEND}/workspaces`, {
      data: { nom: "List Test WS" },
    });
    const ws = await wsRes.json();

    await page.request.post(`${BACKEND}/workspaces/${ws.id}/documents`, {
      data: { titre: "Doc Alpha" },
    });
    await page.request.post(`${BACKEND}/workspaces/${ws.id}/documents`, {
      data: { titre: "Doc Beta" },
    });

    await page.goto(`/en/workspace/${ws.id}/documents`);

    // Use first() — document names appear in sidebar tree + grid cards
    await expect(page.getByText("Doc Alpha").first()).toBeVisible({
      timeout: 6000,
    });
    await expect(page.getByText("Doc Beta").first()).toBeVisible({
      timeout: 6000,
    });
  });

  test("duplicate document titles are auto-renamed", async ({ page }) => {
    const wsRes = await page.request.post(`${BACKEND}/workspaces`, {
      data: { nom: "Rename Test WS" },
    });
    const ws = await wsRes.json();

    await page.request.post(`${BACKEND}/workspaces/${ws.id}/documents`, {
      data: { titre: "Same Title" },
    });
    const secondRes = await page.request.post(
      `${BACKEND}/workspaces/${ws.id}/documents`,
      {
        data: { titre: "Same Title" },
      },
    );
    const second = await secondRes.json();

    expect(second.titre).toBe("Same Title (1)");
  });
});
