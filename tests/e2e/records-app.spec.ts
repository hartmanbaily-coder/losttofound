import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

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

  await expect(page.getByRole("heading", { name: "Lost to Found Case Organization" })).toBeVisible();
  await page.getByRole("link", { name: "Open records workspace" }).click();
  const loginPassword = page.getByLabel("Password", { exact: true });
  await expect(loginPassword).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(loginPassword).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(loginPassword).toHaveAttribute("type", "password");
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
  await page.getByLabel("Exchange time").fill("17:00");
  await page.getByRole("button", { name: "Save color" }).click();
  await expect(page.getByText("Custody day color saved.")).toBeVisible();
  const paintedDay = page.getByRole("button", { name: `Edit calendar day ${currentCalendar.today}` });
  await expect(paintedDay).toBeVisible();
  await expect(paintedDay.getByText("Parent C", { exact: true })).toBeVisible();
  const fivePmMarker = paintedDay.locator('[data-exchange-time-marker="17:00"]');
  await expect(fivePmMarker).toHaveCount(1);
  const fivePmPosition = await fivePmMarker.evaluate((element) =>
    Number.parseFloat((element as HTMLElement).style.left)
  );
  expect(fivePmPosition).toBeCloseTo(70.8333, 4);
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
  await page.reload();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(page.getByLabel("Calendar month")).toHaveValue(currentCalendar.monthKey);
  await expect(page.getByRole("button", { name: `Edit calendar day ${calendarDay(9)}` }).getByText("Drag Parent", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Edit calendar day ${calendarDay(10)}` }).getByText("Drag Parent", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Edit calendar day ${calendarDay(11)}` }).getByText("Drag Parent", { exact: true })).toBeVisible();

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
  await expect(page.getByText("files-tab-document.txt")).toBeVisible();
  await page.getByLabel("From date").fill("2026-05-01");
  await page.getByLabel("To date").fill("2026-06-15");

  await page.locator("nav").getByRole("button", { name: /^Timeline/ }).click();
  await expect(page.getByRole("heading", { name: "Timeline", exact: true })).toBeVisible();
  await expect(page.getByText("Case timeline")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export timeline CSV" })).toBeVisible();
  await expect(page.getByText("Lawyer/court export")).toBeVisible();
  await expect(page.getByText("Timeline records by type")).toBeVisible();
  const timelineDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export timeline CSV" }).click();
  const timelineDownload = await timelineDownloadPromise;
  const timelinePath = await timelineDownload.path();
  if (!timelinePath) throw new Error("Timeline CSV download did not produce a file.");
  const timelineCsv = await readFile(timelinePath, "utf8");
  expect(timelineCsv.split("\n")[0]).toContain("date,time,type,source,title");
  expect(timelineCsv.trim().split("\n").length).toBeGreaterThan(1);
  await page.getByLabel("From date").fill("2030-01-01");
  await page.getByLabel("To date").fill("2030-01-31");
  await page.getByLabel("Show").selectOption("logged_exchange");
  await expect(page.getByRole("button", { name: "Export timeline CSV" })).toBeDisabled();
  await page.getByLabel("From date").fill("2026-05-01");
  await page.getByLabel("To date").fill("2026-06-15");
  const lateExchange = page.locator("details").filter({ hasText: "Logged exchange: completed late" }).first();
  await expect(lateExchange).toBeVisible();
  await lateExchange.locator("summary").click();
  await expect(lateExchange.getByText("Recorded arrival at 6:32 PM.")).toBeVisible();
  await lateExchange.getByRole("button", { name: "Delete timeline item Logged exchange: completed late" }).click();
  await expect(page.getByText("Logged exchange deleted from timeline.")).toBeVisible();
  await expect(page.getByText("Logged exchange: completed late")).toHaveCount(0);

  await page.getByRole("button", { name: "Exchanges", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exchanges", exact: true })).toBeVisible();
  const addExchangePanel = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Log actual exchange outcome" }),
  });
  await expect(addExchangePanel.getByLabel("Scheduled time source")).toBeVisible();
  await expect(addExchangePanel.getByLabel("Arriving / drop-off party")).toBeVisible();
  await expect(addExchangePanel.getByLabel("Who was late?")).toBeVisible();

  await page.getByRole("button", { name: "Edit exchange log 2026-05-01" }).click();
  const editExchangePanel = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Edit saved exchange" }),
  });
  await editExchangePanel.getByLabel("Scheduled time source").selectOption("written_agreement");
  await editExchangePanel.getByLabel("Who was late?").selectOption("not_applicable");
  await editExchangePanel.getByRole("button", { name: "Update exchange details" }).click();
  await expect(page.getByText("Exchange details updated.")).toBeVisible();

  const loggedExchangePanel = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Logged exchanges" }),
  });
  const editedExchangeRow = loggedExchangePanel.locator("tr").filter({ hasText: "2026-05-01" });
  await expect(editedExchangeRow).toContainText("Not applicable");
  await expect(editedExchangeRow).toContainText("Written agreement");

  await page.getByRole("button", { name: "Child Support", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Child Support", exact: true })).toBeVisible();
  await expect(page.getByText("Payments marked unpaid")).toBeVisible();

  await page.getByRole("button", { name: "Expenses", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Expenses", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete expense School supply receipt" }).click();
  await expect(page.getByText("Expense record deleted.")).toBeVisible();

  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "Exchange Lateness & Responsibility Report" })
  ).toBeVisible();
  await expect(page.getByText(/CSV contains the report's dated record rows in a clean table/)).toBeVisible();
  await expect(page.getByText("Pre-export privacy review")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  await page.getByLabel(/Names, file titles/).check();
  await page.getByLabel(/Payment references/).check();
  await page.getByLabel(/Notes are factual/).check();
  await expect(page.getByRole("button", { name: "Download CSV" })).toBeEnabled();
  const reportDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const reportDownload = await reportDownloadPromise;
  const reportPath = await reportDownload.path();
  if (!reportPath) throw new Error("Exchange report CSV download did not produce a file.");
  const reportCsv = await readFile(reportPath, "utf8");
  expect(reportCsv.split("\n")[0]).toContain("scheduled_time_source");
  expect(reportCsv.split("\n")[0]).toContain("arriving_or_drop_off_party");
  expect(reportCsv.split("\n")[0]).toContain("late_party");
  expect(reportCsv).not.toContain("chart_data");
});

test("records account recovery and deletion paths are reachable", async ({ page }) => {
  await page.goto("/records?auth=recovery");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter records workspace" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Forgot password?" })).toHaveCount(0);

  await page.getByRole("button", { name: "Enter records workspace" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();

  const accountDeletion = page.getByRole("link", { name: "Request account deletion" });
  await expect(accountDeletion).toBeVisible();
  await expect(accountDeletion).toHaveAttribute("href", "/account/delete");

  const privacyDeletion = page.getByRole("link", { name: "Privacy and deletion policy" });
  await expect(privacyDeletion).toBeVisible();
  await expect(privacyDeletion).toHaveAttribute("href", "/privacy");

  await accountDeletion.click();
  await expect(page).toHaveURL(/\/account\/delete$/);
  await expect(page.getByRole("heading", { name: "Delete Account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Authenticated Deletion Request" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit account deletion request" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Email support instead" })).toHaveAttribute(
    "href",
    "mailto:support@lendori.io?subject=Lost%20to%20Found%20account%20deletion%20request"
  );
  await expect(page.getByRole("link", { name: "Email deletion support" })).toHaveAttribute(
    "href",
    "mailto:support@lendori.io?subject=Lost%20to%20Found%20account%20deletion%20request"
  );
  await expect(page.getByText("What may be retained")).toBeVisible();

  await page.goto("/records");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();

  await privacyDeletion.click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();

  await page.goto("/records");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByLabel("Case name").first()).toHaveValue("Parenting Plan Records");

  await page.getByRole("button", { name: "Delete selected case" }).click();
  await expect(page.getByText("Selected case deleted.")).toBeVisible();
  await expect(page.getByText("Create or select a custody matter before setting a case timezone.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText("Create or select a custody matter before setting a case timezone.")).toBeVisible();
});
