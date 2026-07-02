import { expect, test } from "@playwright/test";

test("records login and report workflow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Lost to Found Records" })).toBeVisible();
  const enterWorkspace = page.getByRole("button", { name: "Enter records workspace" });
  await expect(enterWorkspace).toBeEnabled();
  await enterWorkspace.click();

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("This tool helps organize records and does not provide legal advice.")).toBeVisible();
  await expect(page.getByText("Scheduled exchanges")).toBeVisible();

  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
  await expect(page.getByText("Monthly custody calendar")).toBeVisible();
  await expect(page.getByText("Color selected day")).toBeVisible();
  await page.getByLabel("Child will be with").fill("Parent C");
  await page.getByRole("button", { name: "Save color" }).click();
  await expect(page.getByText("Custody day color saved.")).toBeVisible();
  const paintedDay = page.getByRole("button", { name: "Edit calendar day 2026-05-08" });
  await expect(paintedDay).toBeVisible();
  await expect(paintedDay.getByText("Parent C")).toBeVisible();
  await page.getByRole("button", { name: "Clear selected day" }).click();
  await expect(page.getByText("Custody day color cleared.")).toBeVisible();
  await expect(paintedDay.getByText("Parent C")).toHaveCount(0);

  await page.locator("nav").getByRole("button", { name: /^Timeline/ }).click();
  await expect(page.getByRole("heading", { name: "Timeline", exact: true })).toBeVisible();
  await expect(page.getByText("Case timeline")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export timeline CSV" })).toBeVisible();
  await page.getByLabel("Show").selectOption("logged_exchange");
  const lateExchange = page.locator("details").filter({ hasText: "Logged exchange: completed late" }).first();
  await expect(lateExchange).toBeVisible();
  await lateExchange.locator("summary").click();
  await expect(lateExchange.getByText("Recorded arrival at 6:32 PM.")).toBeVisible();
  await lateExchange.getByRole("button", { name: "Delete timeline item Logged exchange: completed late" }).click();
  await expect(page.getByText("Logged exchange deleted from timeline.")).toBeVisible();
  await expect(page.getByText("Logged exchange: completed late")).toHaveCount(0);

  await page.getByRole("button", { name: "Child Support", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Child Support", exact: true })).toBeVisible();
  await expect(page.getByText("Payments marked unpaid")).toBeVisible();

  await page.getByRole("button", { name: "Expenses", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Expenses", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete expense School supply receipt" }).click();
  await expect(page.getByText("Expense record deleted.")).toBeVisible();

  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "Combined Attorney Summary" })
  ).toBeVisible();
  await expect(page.getByText("Pre-export privacy review")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  await page.getByLabel(/Names, file titles/).check();
  await page.getByLabel(/Payment references/).check();
  await page.getByLabel(/Notes are factual/).check();
  await expect(page.getByRole("button", { name: "Download CSV" })).toBeEnabled();
});
