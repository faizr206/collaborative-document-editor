import { expect, test, type Page } from "playwright/test";

test("registers a new user and logs out back to login", async ({ page }) => {
  const username = `pw_user_${Date.now()}`;
  const password = "secret123";

  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(`${username}@example.com`);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/documents$/);
  await expect(page.getByText(username)).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("saves profile preferences in frontend storage", async ({ page }) => {
  const displayName = `Frontend Tester ${Date.now()}`;
  const avatarUrl = "https://example.com/avatar.png";

  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Profile" }).click();

  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByLabel("Display name")).toHaveValue("admin");
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Avatar URL").fill(avatarUrl);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved to frontend profile storage.")).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => window.localStorage.getItem("frontend-only-profile"))
    )
    .toContain(displayName);
  await expect
    .poll(async () =>
      page.evaluate(() => window.localStorage.getItem("frontend-only-profile"))
    )
    .toContain(avatarUrl);
});

test("shares a document with a viewer and shows read-only access", async ({ browser, request }) => {
  const viewerUsername = `viewer_${Date.now()}`;
  const viewerPassword = "secret123";

  await request.post("http://127.0.0.1:8010/api/v1/auth/register", {
    data: {
      username: viewerUsername,
      email: `${viewerUsername}@example.com`,
      password: viewerPassword
    }
  });

  const ownerPage = await browser.newPage();
  await loginAsAdmin(ownerPage);
  await ownerPage.getByRole("button", { name: "New document" }).click();
  await expect(ownerPage).toHaveURL(/\/documents\/\d+$/);

  const titleInput = ownerPage.getByLabel("Document title");
  await titleInput.fill("Shared viewer doc");
  await titleInput.blur();

  await ownerPage.getByRole("button", { name: "Back to documents" }).click();
  await expect(ownerPage).toHaveURL(/\/documents$/);
  const ownerDocumentCard = ownerPage.locator("article").filter({ hasText: "Shared viewer doc" });
  await ownerDocumentCard.getByRole("button", { name: "Settings" }).click();

  await expect(ownerPage).toHaveURL(/\/settings$/);
  await ownerPage.getByLabel("Email or username").fill(viewerUsername);
  await ownerPage.getByLabel("Role").selectOption("viewer");
  await ownerPage.getByRole("button", { name: "Share document" }).click();
  await expect(ownerPage.getByText(viewerUsername, { exact: true })).toBeVisible();
  await ownerPage.close();

  const viewerPage = await browser.newPage();
  await viewerPage.goto("/login");
  await viewerPage.getByLabel("Username").fill(viewerUsername);
  await viewerPage.getByLabel("Password").fill(viewerPassword);
  await viewerPage.getByRole("button", { name: "Login" }).click();

  await expect(viewerPage).toHaveURL(/\/documents$/);
  await expect(viewerPage.getByText("Shared viewer doc")).toBeVisible();
  const viewerDocumentCard = viewerPage.locator("article").filter({ hasText: "Shared viewer doc" });
  await viewerDocumentCard.getByRole("button", { name: "Open" }).click();

  await expect(viewerPage).toHaveURL(/\/documents\/\d+$/);
  await expect(viewerPage.getByText("Viewer mode is active. Editing and AI actions are disabled.")).toBeVisible();
  await expect(viewerPage.getByRole("button", { name: "Send" })).toBeDisabled();
  await viewerPage.close();
});

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("pass123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/documents$/);
}
