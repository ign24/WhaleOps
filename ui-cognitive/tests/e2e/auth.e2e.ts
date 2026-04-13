import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const hasCredentials = Boolean(email && password);

test.describe("authentication", () => {
  test.skip(!hasCredentials, "Set E2E_EMAIL and E2E_PASSWORD to run auth E2E.");

  test("logs in and lands in chat", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").first().fill(email ?? "");
    await page.getByLabel("Password").first().fill(password ?? "");
    await page.getByRole("button", { name: "Ingresar" }).first().click();

    await expect(page).toHaveURL(/\/chat\//);
  });
});
