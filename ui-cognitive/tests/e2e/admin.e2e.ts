import { expect, test } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL ?? process.env.E2E_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_PASSWORD;
const hasCredentials = Boolean(email && password);

test.describe("admin users", () => {
  test.skip(!hasCredentials, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin E2E.");

  test("opens users admin page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").first().fill(email ?? "");
    await page.getByLabel("Password").first().fill(password ?? "");
    await page.getByRole("button", { name: "Ingresar" }).first().click();

    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: /Admin/ })).toBeVisible();
  });
});
