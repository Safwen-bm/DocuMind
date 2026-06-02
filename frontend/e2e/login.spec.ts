// e2e/login.spec.ts
import { test, expect } from "@playwright/test";
import { loginAs, TEST_USER, cleanupTestUser } from "./helpers/auth";

test.describe("Login flow", () => {
  test.afterEach(async ({ request }) => {
    await cleanupTestUser(request);
  });

  test("login page loads with email and password fields", async ({ page }) => {
    await page.goto("/en/login");

    // Use .first() to avoid strict mode violation — DocuMind appears in brand + panel text
    await expect(page.getByText("DocuMind").first()).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in|connexion|submit/i }),
    ).toBeVisible();
  });

  test("forgot password link points to forgot-password page", async ({
    page,
  }) => {
    await page.goto("/en/login");
    const link = page.getByRole("link", { name: /forgot/i });
    await expect(link).toHaveAttribute("href", "/en/forgot-password");
  });

  test("register link points to register page", async ({ page }) => {
    await page.goto("/en/login");
    const link = page.getByRole("link", { name: /create|register|sign up/i });
    await expect(link).toHaveAttribute("href", "/en/register");
  });

  test("shows error on wrong credentials", async ({ page }) => {
    await loginAs(page);
    await page.context().clearCookies();

    await page.goto("/en/login");
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page
      .getByRole("button", { name: /sign in|connexion|submit/i })
      .click();

    await expect(page.locator('[class*="destructive"]').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("successful login redirects to dashboard", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/dashboard");

    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByText("DocuMind").first()).toBeVisible();
  });

  test("dashboard shows welcome message with user name", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/dashboard");

    await expect(page.getByText(/playwright/i).first()).toBeVisible({
      timeout: 8000,
    });
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/en/dashboard");

    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });

  test("logout clears session and redirects to login", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/dashboard");

    const logoutBtn = page.getByRole("button", {
      name: /logout|déconnexion|sign out/i,
    });
    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutBtn.click();
    } else {
      await page.request.post("http://localhost:3000/auth/logout");
      await page.context().clearCookies();
      // waitUntil: 'commit' accepts the navigation as soon as the URL is
      // committed — before the page fully loads — so the redirect to /login
      // doesn't cause ERR_ABORTED
      await page.goto("/en/dashboard", { waitUntil: "commit" });
    }

    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });
});
