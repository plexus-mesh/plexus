import { test, expect } from "@playwright/test";
import { mockTauriIPC } from "./mocks";

test.describe("Onboarding Flow", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log("BROWSER_LOG:", msg.text()));
    // Mock Tauri IPC before loading the page
    await mockTauriIPC(page);
    await page.goto("/");
  });

  test("should verify hardware requirements and complete onboarding", async ({
    page,
  }) => {
    // 1. Welcome Screen
    await expect(page.getByText("Welcome to Plexus")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    // 2. Hardware Verification Screen
    // The mocked IPC should return compatible specs, so "Compatible" should appear
    // Wait, the UI shows CPU info, not specifically the word "Compatible" unless it's in the component logic not visible in snippets?
    // Looking at code: it shows hardwareInfo.cpu_model. Mock returns "M3 Pro mocked".
    await expect(page.getByText("M3 Pro mocked")).toBeVisible({
      timeout: 10000,
    });

    // Wait for button to be enabled (status success)
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    await page.getByRole("button", { name: "Continue" }).click();

    // 3. Network Screen
    await expect(page.getByText("Connecting to Mesh")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    // 4. Ready Screen
    await expect(page.getByText("You are Online")).toBeVisible();
    await page.getByRole("button", { name: "Finish" }).click(); // Dashboard redirect?
  });
});
