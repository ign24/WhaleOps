import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const hasCredentials = Boolean(email && password);

const login = async (page: Page) => {
  await page.goto("/login");
  await page.getByLabel("Email").first().fill(email ?? "");
  await page.getByLabel("Password").first().fill(password ?? "");
  await page.getByRole("button", { name: "Ingresar" }).first().click();
  await expect(page).toHaveURL(/\/chat\//);
};

test.describe("chat", () => {
  test.skip(!hasCredentials, "Set E2E_EMAIL and E2E_PASSWORD to run chat E2E.");

  test("renders interactive chat input", async ({ page }) => {
    await login(page);

    const sendButton = page.getByRole("button", { name: "Enviar" });
    await expect(sendButton).toBeEnabled();

    const messageInput = page.getByLabel("Mensaje");
    await messageInput.fill("/help");
    await expect(messageInput).toHaveValue("/help");
  });
});
