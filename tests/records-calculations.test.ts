import { describe, expect, it } from "vitest";
import {
  assertOwnedRecord,
  buildCalendarEvents,
  buildCustodyDayMap,
  buildDashboardTimelineStats,
  buildEvidenceIndex,
  buildNeutralExchangeSummary,
  calculateChildSupportStats,
  calculateExchangeStats,
  calculateExchangeTiming,
  calculateExpenseStats,
  containsForbiddenGeneratedTerm,
  filterOwnedCaseRecords,
  generateExpectedExchangeEvents,
  isLateExchangeTimelineEvent,
  isNoFaceTimeTimelineEvent,
  isPostCallFaceTimeNotice,
  isTimelineVisibleEvent,
} from "@/lib/records/calculations";
import { createRecordsSeed, demoCaseId, demoUserId } from "@/lib/records/seed";
import {
  buildReportPreview,
  buildSectionExportPacket,
  reportPreviewToCsv,
  rowsToCsv,
  sectionExportToCsv,
} from "@/lib/records/reports";
import type { CalendarEvent } from "@/lib/records/types";
import { validateEvidenceFile } from "@/lib/records/validation";

const range = { from: "2026-05-01", to: "2026-05-31" };

describe("records calculations", () => {
  it("calculates late, early, and missed exchange timing", () => {
    const dataset = createRecordsSeed();
    const late = dataset.exchangeLogs.find((log) => log.id === "exchange-2026-05-08");
    const early = dataset.exchangeLogs.find((log) => log.id === "exchange-2026-05-22");
    const missed = dataset.exchangeLogs.find((log) => log.id === "exchange-2026-05-15");

    expect(late && calculateExchangeTiming(late)).toMatchObject({
      minutesEarlyOrLate: 32,
      isLate: true,
      isMissed: false,
    });
    expect(early && calculateExchangeTiming(early)).toMatchObject({
      minutesEarlyOrLate: -8,
      isEarly: true,
    });
    expect(missed && calculateExchangeTiming(missed)).toMatchObject({
      minutesEarlyOrLate: null,
      isMissed: true,
    });
  });

  it("generates recurring expected exchanges and range statistics", () => {
    const dataset = createRecordsSeed();
    const rules = filterOwnedCaseRecords(dataset.exchangeRules, demoUserId, demoCaseId);
    const expected = generateExpectedExchangeEvents(rules, range);
    const logs = filterOwnedCaseRecords(dataset.exchangeLogs, demoUserId, demoCaseId);
    const stats = calculateExchangeStats(logs, expected, range);

    expect(expected.length).toBeGreaterThanOrEqual(8);
    expect(stats.lateCount).toBe(1);
    expect(stats.missedCount).toBe(1);
    expect(stats.averageLatenessMinutes).toBe(32);
    expect(stats.longestLatenessMinutes).toBe(32);
  });

  it("calculates child support due, paid, partial, unpaid, and late metrics", () => {
    const dataset = createRecordsSeed();
    const payments = filterOwnedCaseRecords(dataset.childSupportPayments, demoUserId, demoCaseId);
    const stats = calculateChildSupportStats(payments, { from: "2026-03-01", to: "2026-06-30" });

    expect(stats.totalDue).toBe(1800);
    expect(stats.totalPaid).toBe(1100);
    expect(stats.unpaidBalance).toBe(700);
    expect(stats.partialCount).toBe(1);
    expect(stats.unpaidCount).toBe(1);
    expect(stats.lateCount).toBeGreaterThanOrEqual(1);
  });

  it("calculates expense reimbursement totals by date range", () => {
    const dataset = createRecordsSeed();
    const expenses = filterOwnedCaseRecords(dataset.expenseItems, demoUserId, demoCaseId);
    const stats = calculateExpenseStats(expenses, range);

    expect(stats.totalExpenses).toBeCloseTo(119.22);
    expect(stats.reimbursementRequested).toBeCloseTo(119.22);
    expect(stats.reimbursementReceived).toBeCloseTo(17.5);
    expect(stats.unpaidReimbursement).toBeCloseTo(101.72);
    expect(stats.byCategory.map((row) => row.category)).toContain("school");
  });

  it("keeps color-coded custody days on the calendar outside timeline events", () => {
    const dataset = createRecordsSeed();
    const assignments = filterOwnedCaseRecords(dataset.custodyDayAssignments, demoUserId, demoCaseId);
    const dayMap = buildCustodyDayMap(assignments, range);
    const events = buildCalendarEvents(dataset, demoUserId, demoCaseId, range);

    expect(dayMap.get("2026-05-01")).toMatchObject({
      caregiverLabel: "Parent A",
      color: "#0f766e",
      exchangeTime: "18:00",
    });
    expect(events.some((event) => event.type === "custody_day")).toBe(false);
    expect(
      isTimelineVisibleEvent({
        id: "legacy-custody-day",
        caseId: demoCaseId,
        date: "2026-05-01",
        type: "custody_day",
        title: "Parent A",
      })
    ).toBe(false);
  });

  it("builds a detailed court timeline from exchanges, notes, evidence, support, and expenses", () => {
    const dataset = createRecordsSeed();
    const events = buildCalendarEvents(dataset, demoUserId, demoCaseId, range);
    const lateExchange = events.find((event) => event.id === "log-exchange-2026-05-08");
    const schoolNote = events.find((event) => event.id === "note-note-school-2026-05-05");
    const evidence = events.find((event) => event.id === "evidence-evidence-exchange-2026-05-08");
    const supportDue = events.find((event) => event.id === "payment-due-support-payment-2026-05-01");
    const expense = events.find((event) => event.id === "expense-expense-school-2026-05-03");

    expect(lateExchange).toMatchObject({
      date: "2026-05-08",
      time: "18:32",
      type: "logged_exchange",
      severity: "attention",
      sourceLabel: "Exchange log",
    });
    expect(lateExchange?.detail).toContain("32 minutes after ordered time");
    expect(lateExchange?.body).toContain("Recorded arrival at 6:32 PM.");
    expect(schoolNote).toMatchObject({
      time: "16:30",
      body: "Documented pickup time and after-school item transfer.",
      sourceLabel: "Date note",
    });
    expect(evidence).toMatchObject({ type: "evidence_item", sourceLabel: "File attachment" });
    expect(supportDue).toMatchObject({ type: "child_support_due", severity: "attention" });
    expect(expense).toMatchObject({ type: "expense_item", severity: "attention" });
  });
});

describe("privacy and safety helpers", () => {
  it("filters records by authenticated user and selected case", () => {
    const dataset = createRecordsSeed();
    const owned = filterOwnedCaseRecords(dataset.exchangeLogs, demoUserId, demoCaseId);

    expect(owned.every((record) => record.userId === demoUserId)).toBe(true);
    expect(owned.every((record) => record.caseId === demoCaseId)).toBe(true);
    expect(owned.find((record) => record.id === "exchange-other-user")).toBeUndefined();
  });

  it("throws when a user attempts to access another user's record", () => {
    const dataset = createRecordsSeed();
    const otherUserRecord = dataset.exchangeLogs.find((record) => record.id === "exchange-other-user");

    expect(() => assertOwnedRecord(otherUserRecord!, demoUserId, demoCaseId)).toThrow(
      "Record is not owned"
    );
  });

  it("validates private evidence file allow-list and blocks executables", () => {
    expect(
      validateEvidenceFile({
        originalFileName: "exchange-note.pdf",
        fileType: "application/pdf",
        fileSize: 20_000,
      })
    ).toEqual({ ok: true });

    expect(
      validateEvidenceFile({
        originalFileName: "script.sh",
        fileType: "text/plain",
        fileSize: 100,
      })
    ).toMatchObject({ ok: false });
  });

  it("keeps generated report language neutral", () => {
    const dataset = createRecordsSeed();
    const preview = buildReportPreview(dataset, demoUserId, demoCaseId, range, "combined_attorney_summary");
    const summaryText = preview.summaries.join(" ");
    const exchangeSummary = buildNeutralExchangeSummary(range, 8, 5, 32, 1);

    expect(containsForbiddenGeneratedTerm(summaryText)).toBe(false);
    expect(containsForbiddenGeneratedTerm(exchangeSummary)).toBe(false);
    expect(summaryText).toContain("custody timeline issues");
    expect(summaryText).toContain("does not include child support or expense sections");
  });

  it("includes custody schedule rows in combined report exports", () => {
    const dataset = createRecordsSeed();
    const preview = buildReportPreview(dataset, demoUserId, demoCaseId, range, "combined_court_packet");
    const csv = rowsToCsv(preview.rows);

    expect(preview.rows).toContainEqual(
      expect.objectContaining({
        section: "custody_schedule",
        caregiver_label: "Parent A",
      })
    );
    expect(csv.split("\n")[0]).toContain("caregiver_label");
    expect(csv.split("\n")[0]).toContain("ordered_exchange_time");
  });

  it("builds section export packets with chart and table data", () => {
    const dataset = createRecordsSeed();
    const packet = buildSectionExportPacket(dataset, demoUserId, demoCaseId, range, "exchanges");
    const csv = sectionExportToCsv(packet);

    expect(packet.title).toBe("Exchange Compliance Packet");
    expect(packet.metrics.map((metric) => metric.label)).toContain("Late");
    expect(packet.charts.map((chart) => chart.title)).toContain("Minutes early/late by logged exchange");
    expect(packet.tables.map((table) => table.title)).toContain("Logged exchange outcomes");
    expect(csv).toContain("chart_data");
    expect(csv).toContain("Logged exchange outcomes");
  });

  it("exports incident timeline rows from timeline-visible dated record sources", () => {
    const dataset = createRecordsSeed();
    const preview = buildReportPreview(dataset, demoUserId, demoCaseId, range, "incident_timeline");
    const csv = rowsToCsv(preview.rows);

    expect(preview.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issue: "Late exchange",
          source: "Exchange log",
          title: "Logged exchange: completed late",
        }),
      ])
    );
    expect(preview.rows.some((row) => "source" in row && row.source === "File attachment")).toBe(false);
    expect(preview.rows.some((row) => "source" in row && row.source === "Child support")).toBe(false);
    expect(preview.rows.some((row) => "source" in row && row.source === "Expense")).toBe(false);
    expect(csv.split("\n")[0]).toContain("issue");
    expect(csv).toContain("Recorded arrival at 6:32 PM.");
  });

  it("builds focused report previews with issue-specific charts", () => {
    const dataset = createRecordsSeed();
    const createdAt = "2026-05-10T12:00:00.000Z";
    dataset.dateNotes.push(
      {
        id: "filing-note-test",
        caseId: demoCaseId,
        userId: demoUserId,
        noteDate: "2026-05-10",
        category: "court",
        title: "Motion filed",
        body: "Motion filed with the court.",
        tags: ["motion", "filed"],
        includeInReports: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: "facetime-note-test",
        caseId: demoCaseId,
        userId: demoUserId,
        noteDate: "2026-05-12",
        noteTime: "19:21",
        category: "communication",
        title: "No FaceTime conducted",
        body: "Called first and no answer. Parent B later stated by text that there would be no FaceTime.",
        tags: ["facetime", "no_facetime", "post_call_notice"],
        includeInReports: true,
        createdAt,
        updatedAt: createdAt,
      }
    );

    const exchangePreview = buildReportPreview(dataset, demoUserId, demoCaseId, range, "exchange_compliance");
    const facetimePreview = buildReportPreview(dataset, demoUserId, demoCaseId, range, "facetime_cancellations");
    const correlationPreview = buildReportPreview(
      dataset,
      demoUserId,
      demoCaseId,
      range,
      "filing_facetime_correlation"
    );
    const csv = reportPreviewToCsv(facetimePreview);

    expect(exchangePreview.charts.map((chart) => chart.title)).toContain("Late exchanges by direction");
    expect(facetimePreview.metrics.map((metric) => metric.label)).toContain("After call/request");
    expect(facetimePreview.charts.map((chart) => chart.title)).toContain("No FaceTime records by month");
    expect(correlationPreview.charts.map((chart) => chart.title)).toContain(
      "No FaceTime records after filing notes"
    );
    expect(correlationPreview.summaries.join(" ")).toContain("timing overlap only");
    expect(csv).toContain("chart_data");
    expect(csv).toContain("No FaceTime records");
  });

  it("derives dashboard counts from timeline records including imported text notes", () => {
    const events: CalendarEvent[] = [
      {
        id: "late-note",
        caseId: demoCaseId,
        date: "2026-03-20",
        type: "custody_note",
        title: "Late exchange documented",
        body: "Parent B dropped the children off at 5:40; court order is 5.",
        tags: ["late_exchange", "text_archive"],
        severity: "attention",
      },
      {
        id: "missed-note",
        caseId: demoCaseId,
        date: "2026-03-20",
        type: "custody_note",
        title: "Exchange issue",
        body: "Parent B refused to bring the children at 5.",
        tags: ["refused_exchange"],
        severity: "critical",
      },
      {
        id: "facetime-note",
        caseId: demoCaseId,
        date: "2026-06-12",
        time: "19:21",
        type: "custody_note",
        title: "No FaceTime conducted - no reason stated",
        body: "FaceTimed about 30 minutes earlier. Parent B replied by text: No FT.",
        tags: ["facetime", "no_facetime", "post_call_notice"],
        severity: "attention",
      },
      {
        id: "evidence",
        caseId: demoCaseId,
        date: "2026-06-12",
        type: "evidence_item",
        title: "File attachment: text-export.csv",
        tags: ["text_archive"],
        severity: "neutral",
      },
      {
        id: "delayed-facetime",
        caseId: demoCaseId,
        date: "2026-02-20",
        type: "custody_note",
        title: "FaceTime delayed - napping",
        body: "Parent B replied that Child 1 was napping and would FaceTime when awake.",
        tags: ["facetime", "delayed", "napping"],
        severity: "neutral",
      },
    ];

    const stats = buildDashboardTimelineStats(events);

    expect(isLateExchangeTimelineEvent(events[0])).toBe(true);
    expect(isNoFaceTimeTimelineEvent(events[2])).toBe(true);
    expect(isPostCallFaceTimeNotice(events[2])).toBe(true);
    expect(isNoFaceTimeTimelineEvent(events[4])).toBe(false);
    expect(stats).toMatchObject({
      timelineCount: 5,
      attentionCount: 3,
      lateExchangeCount: 1,
      missedExchangeCount: 1,
      noFaceTimeCount: 1,
      postCallNoFaceTimeCount: 1,
      evidenceCount: 1,
    });
  });

  it("includes evidence scan and storage status without raw storage paths", () => {
    const dataset = createRecordsSeed();
    const item = {
      ...dataset.evidenceItems[0],
      includeInReports: true,
      evidenceDate: "2026-05-12",
      malwareScanStatus: "clean" as const,
      storagePath: "user_demo/case_demo/evidence_1/evidence_1.pdf",
      storageBucket: "records-evidence",
    };
    const index = buildEvidenceIndex([item], range);

    expect(index[0]).toMatchObject({
      scanStatus: "clean",
      storageStatus: "private stored file",
    });
    expect(JSON.stringify(index[0])).not.toContain("storagePath");
    expect(JSON.stringify(index[0])).not.toContain("records-evidence");
  });
});
