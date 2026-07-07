import { expect, test } from "@playwright/test";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function localDateParts(date = new Date(), timeZone = "America/Anchorage") {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || `${date.getFullYear()}`;
  const month = parts.find((part) => part.type === "month")?.value || pad2(date.getMonth() + 1);
  const day = parts.find((part) => part.type === "day")?.value || pad2(date.getDate());
  const monthKey = `${year}-${month}`;
  const today = `${monthKey}-${day}`;
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone,
    year: "numeric",
  }).format(date);
  return { monthKey, monthLabel, today };
}

function shiftMonthKey(monthKey: string, offset: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

test("records login and report workflow", async ({ page }) => {
  const currentCalendar = localDateParts();
  const calendarDay = (day: number) => `${currentCalendar.monthKey}-${pad2(day)}`;

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Lost to Found Records" })).toBeVisible();
  const enterWorkspace = page.getByRole("button", { name: "Enter records workspace" });
  await expect(enterWorkspace).toBeEnabled();
  await enterWorkspace.click();

  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.getByText("This tool helps organize records and does not provide legal advice.")).toBeVisible();
  await expect(page.getByText("Late exchanges").first()).toBeVisible();
  await page.getByLabel("From date").fill("2026-01-01");
  await page.getByLabel("To date").fill("2026-01-31");

  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
  await expect(page.getByText(`Monthly custody calendar: ${currentCalendar.monthLabel}`)).toBeVisible();
  await expect(page.getByText("Case timezone: America/Anchorage")).toBeVisible();
  await expect(page.getByLabel("Calendar month")).toHaveValue(currentCalendar.monthKey);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Calendar month")).toHaveValue(shiftMonthKey(currentCalendar.monthKey, 1));
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByLabel("Calendar month")).toHaveValue(currentCalendar.monthKey);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByLabel("Calendar month")).toHaveValue(currentCalendar.monthKey);
  await expect(page.getByRole("button", { name: `Edit calendar day ${currentCalendar.today}` })).toBeVisible();
  await expect(page.getByText("Color selected day")).toBeVisible();
  await page.getByLabel("Child will be with").fill("Parent C");
  await page.getByRole("button", { name: "Save color" }).click();
  await expect(page.getByText("Custody day color saved.")).toBeVisible();
  const paintedDay = page.getByRole("button", { name: `Edit calendar day ${currentCalendar.today}` });
  await expect(paintedDay).toBeVisible();
  await expect(paintedDay.getByText("Parent C", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear selected day" }).click();
  await expect(page.getByText("Custody day color cleared.")).toBeVisible();
  await expect(paintedDay.getByText("Parent C", { exact: true })).toHaveCount(0);
  await page.getByLabel("Caregiver label").fill("Drag Parent");
  const dragStartDay = page.getByRole("button", { name: `Edit calendar day ${calendarDay(9)}` });
  const dragMiddleDay = page.getByRole("button", { name: `Edit calendar day ${calendarDay(10)}` });
  const dragEndDay = page.getByRole("button", { name: `Edit calendar day ${calendarDay(11)}` });
  await dragStartDay.scrollIntoViewIfNeeded();
  const startBox = await dragStartDay.boundingBox();
  const middleBox = await dragMiddleDay.boundingBox();
  const endBox = await dragEndDay.boundingBox();
  if (!startBox || !middleBox || !endBox) throw new Error("Calendar drag test days are not visible.");
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(middleBox.x + middleBox.width / 2, middleBox.y + middleBox.height / 2, { steps: 4 });
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByText("3 custody days colored.")).toBeVisible();
  await expect(dragStartDay.getByText("Drag Parent", { exact: true })).toBeVisible();
  await expect(dragMiddleDay.getByText("Drag Parent", { exact: true })).toBeVisible();
  await expect(dragEndDay.getByText("Drag Parent", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Import", exact: true })).toBeVisible();
  const documentImportForm = page.locator("form").filter({ has: page.locator("input[name=files]") });
  await documentImportForm.locator("input[name=files]").setInputFiles({
    name: "imported-document.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Synthetic imported document"),
  });
  await documentImportForm.locator("textarea[name=description]").fill("Imported through Document intake");
  await documentImportForm.getByRole("button", { name: "Save files to Files" }).click();
  await expect(page.getByText("1 file record saved to Files.")).toBeVisible();

  await page.locator("nav").getByRole("button", { name: /^Files/ }).click();
  await expect(page.getByRole("heading", { name: "Files", exact: true })).toBeVisible();
  await expect(page.getByText("imported-document.txt")).toBeVisible();
  await page.locator("input[name=file]").setInputFiles({
    name: "files-tab-document.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Synthetic files tab document"),
  });
  await page.locator("textarea[name=description]").fill("Uploaded through Files tab");
  await page.getByRole("button", { name: "Save file record" }).click();
  await expect(page.getByText("File metadata saved with allow-list validation.")).toBeVisible();
  await expect(page.getByText("files-tab-document.txt")).toBeVisible();
  await page.getByLabel("From date").fill("2026-05-01");
  await page.getByLabel("To date").fill("2026-06-15");

  await page.locator("nav").getByRole("button", { name: /^Timeline/ }).click();
  await expect(page.getByRole("heading", { name: "Timeline", exact: true })).toBeVisible();
  await expect(page.getByText("Case timeline")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export timeline CSV" })).toBeVisible();
  await expect(page.getByText("Lawyer/court export")).toBeVisible();
  await expect(page.getByText("Timeline records by type")).toBeVisible();
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
    page.getByRole("article").getByRole("heading", { name: "Exchange Lateness Report" })
  ).toBeVisible();
  await expect(page.getByText("Pre-export privacy review")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  await page.getByLabel(/Names, file titles/).check();
  await page.getByLabel(/Payment references/).check();
  await page.getByLabel(/Notes are factual/).check();
  await expect(page.getByRole("button", { name: "Download CSV" })).toBeEnabled();
});
