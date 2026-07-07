import {
  buildCalendarEvents,
  buildEvidenceIndex,
  buildNeutralChildSupportSummary,
  buildNeutralExchangeSummary,
  calculateChildSupportStats,
  calculateExchangeStats,
  calculateExchangeTiming,
  calculateExpenseStats,
  childSupportChartRows,
  formatMoney,
  generateExpectedExchangeEvents,
  getMonthKey,
  getIsoDateFromDateTime,
  isLateExchangeTimelineEvent,
  isMissedExchangeTimelineEvent,
  isNoFaceTimeTimelineEvent,
  isPostCallFaceTimeNotice,
  isTimelineVisibleEvent,
  isWithinDateRange,
  labelEventType,
  labelExchangeStatus,
  labelNoteCategory,
  labelPaymentStatus,
  timelineSearchText,
} from "./calculations";
import type { CalendarEvent, DateRange, ExchangeLog, RecordsDataset, ReportType } from "./types";

export type SectionExportId =
  | "calendar"
  | "timeline"
  | "exchanges"
  | "notes"
  | "evidence"
  | "child_support"
  | "expenses";

export const sectionExportLabels: Record<SectionExportId, string> = {
  calendar: "Calendar Section Packet",
  timeline: "Timeline Section Packet",
  exchanges: "Exchange Compliance Packet",
  notes: "Date Notes Packet",
  evidence: "File Attachment Index Packet",
  child_support: "Child Support Packet",
  expenses: "Expense/Reimbursement Packet",
};

export interface SectionExportMetric {
  label: string;
  value: string | number;
  detail?: string;
}

export interface SectionExportChartRow {
  label: string;
  value: number;
  secondaryValue?: number;
  tertiaryValue?: number;
}

export interface SectionExportChart {
  title: string;
  description?: string;
  unit?: string;
  seriesLabels?: [string, string?, string?];
  rows: SectionExportChartRow[];
}

export interface SectionExportTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface SectionExportPacket {
  id: SectionExportId;
  title: string;
  caseName: string;
  range: DateRange;
  generatedAt: string;
  disclaimer: string;
  summaries: string[];
  metrics: SectionExportMetric[];
  charts: SectionExportChart[];
  tables: SectionExportTable[];
  suggestedUses: string[];
}

export const reportTypeLabels: Record<ReportType, string> = {
  exchange_compliance: "Exchange Lateness Report",
  facetime_cancellations: "FaceTime Cancellation Report",
  incident_timeline: "Issue Timeline Report",
  filing_facetime_correlation: "Filing / FaceTime Timing Report",
  child_support_payment: "Child Support Payment Report",
  expense_reimbursement: "Expense/Reimbursement Report",
  combined_attorney_summary: "Attorney Issue Summary",
  combined_court_packet: "Combined Court Issue Packet",
};

export const reportsTabReportTypes: Array<{ value: ReportType; label: string; description: string }> = [
  {
    value: "exchange_compliance",
    label: reportTypeLabels.exchange_compliance,
    description: "Shows ordered exchange times against recorded arrival times.",
  },
  {
    value: "facetime_cancellations",
    label: reportTypeLabels.facetime_cancellations,
    description: "Summarizes no-FaceTime records and whether notice came after a call/request.",
  },
  {
    value: "incident_timeline",
    label: reportTypeLabels.incident_timeline,
    description: "Filters the timeline to court-useful exchange and communication issues.",
  },
  {
    value: "filing_facetime_correlation",
    label: reportTypeLabels.filing_facetime_correlation,
    description: "Compares court/attorney filing notes with nearby no-FaceTime records.",
  },
  {
    value: "combined_attorney_summary",
    label: reportTypeLabels.combined_attorney_summary,
    description: "A concise issue packet for counsel review.",
  },
  {
    value: "combined_court_packet",
    label: reportTypeLabels.combined_court_packet,
    description: "A broader packet with metrics, charts, and key rows.",
  },
];

export type ReportChartKind = "bar" | "line";
export type ReportChartOrientation = "vertical" | "horizontal";

export interface ReportPreviewChart extends SectionExportChart {
  kind: ReportChartKind;
  orientation?: ReportChartOrientation;
  emptyLabel?: string;
}

export interface ReportPreview {
  title: string;
  caseName: string;
  generatedAt: string;
  disclaimer: string;
  focus: string;
  summaries: string[];
  metrics: SectionExportMetric[];
  charts: ReportPreviewChart[];
  tables: SectionExportTable[];
  rows: Array<Record<string, unknown>>;
  evidenceIndex: ReturnType<typeof buildEvidenceIndex>;
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(",")),
  ].join("\n");
}

function ownedCaseRecords<T extends { userId: string; caseId: string }>(
  records: T[],
  userId: string,
  caseId: string
) {
  return records.filter((item) => item.userId === userId && item.caseId === caseId);
}

function countBy<T>(records: T[], labelFor: (record: T) => string) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const label = labelFor(record);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Array.from(counts, ([label, value]) => ({ label, value })).sort(
    (a, b) => b.value - a.value || a.label.localeCompare(b.label)
  );
}

function formatPercent(numerator: number, denominator: number) {
  if (denominator <= 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function eventSeverityLabel(value: string | undefined) {
  if (value === "critical") return "Critical";
  if (value === "attention") return "Needs review";
  if (value === "positive") return "Recorded";
  return "Neutral";
}

function evidenceRecordDate(item: RecordsDataset["evidenceItems"][number]) {
  return item.evidenceDate || item.uploadedAt.slice(0, 10);
}

function labelExchangeDirection(direction: ExchangeLog["direction"]) {
  return direction === "other_parent_to_me" ? "Other parent to me" : "Me to other parent";
}

function formatMinutes(value: number) {
  return `${value} min`;
}

function formatDateRangeWindow(days: number) {
  return days === 0 ? "same day" : `within ${days} days`;
}

function formatGeneratedAt(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function dateDiffDays(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00.000Z`).getTime() - new Date(`${from}T00:00:00.000Z`).getTime()) / 86_400_000);
}

function monthKeysInRange(range: DateRange) {
  const months: string[] = [];
  const cursor = new Date(`${range.from.slice(0, 7)}-01T00:00:00.000Z`);
  const end = new Date(`${range.to.slice(0, 7)}-01T00:00:00.000Z`);

  while (cursor <= end) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

function sortByDateTime<T extends { date: string; time?: string }>(rows: T[]) {
  return [...rows].sort((a, b) => `${a.date}T${a.time || "00:00"}`.localeCompare(`${b.date}T${b.time || "00:00"}`));
}

function eventMatchesFilingLanguage(event: CalendarEvent) {
  if (event.type !== "custody_note") return false;
  const text = timelineSearchText(event);
  const courtContext = includesAny(text, ["court", "attorney", "lawyer", "motion", "response", "filing", "filed"]);
  const filingAction = includesAny(text, [
    "motion",
    "motions",
    "response",
    "reply",
    "opposition",
    "filing",
    "filed",
    "petition",
    "affidavit",
    "declaration",
    "hearing brief",
  ]);

  return courtContext && filingAction;
}

function issueLabelForEvent(event: CalendarEvent) {
  if (isLateExchangeTimelineEvent(event)) return "Late exchange";
  if (isMissedExchangeTimelineEvent(event)) return "Missed/refused exchange";
  if (isPostCallFaceTimeNotice(event)) return "No FaceTime after call/request";
  if (isNoFaceTimeTimelineEvent(event)) return "No FaceTime";
  if (eventMatchesFilingLanguage(event)) return "Court/attorney filing note";
  return eventSeverityLabel(event.severity);
}

function isIssueReportEvent(event: CalendarEvent) {
  if (isLateExchangeTimelineEvent(event)) return true;
  if (isMissedExchangeTimelineEvent(event)) return true;
  if (isNoFaceTimeTimelineEvent(event)) return true;
  if (eventMatchesFilingLanguage(event)) return true;

  return (
    (event.type === "logged_exchange" || event.type === "custody_note") &&
    (event.severity === "attention" || event.severity === "critical")
  );
}

function lateExchangeRows(exchangeLogs: ExchangeLog[]) {
  return exchangeLogs.map((log) => {
    const timing = calculateExchangeTiming(log);
    return {
      label: getIsoDateFromDateTime(log.orderedExchangeAt),
      value: timing.minutesEarlyOrLate ?? 0,
    };
  });
}

function exchangeOutcomeRows(exchangeLogs: ExchangeLog[]) {
  return countBy(exchangeLogs, (log) => labelExchangeStatus(log.status));
}

function exchangeDirectionRows(exchangeLogs: ExchangeLog[]) {
  const labels = ["Other parent to me", "Me to other parent"];
  return labels.map((label) => {
    const logs = exchangeLogs.filter((log) => labelExchangeDirection(log.direction) === label);
    const late = logs.filter((log) => calculateExchangeTiming(log).isLate).length;
    return {
      label,
      value: late,
      secondaryValue: Math.max(logs.length - late, 0),
    };
  });
}

function noFaceTimeRows(events: CalendarEvent[]) {
  return sortByDateTime(events.filter(isNoFaceTimeTimelineEvent).map((event) => ({
    date: event.date,
    time: event.time,
    type: issueLabelForEvent(event),
    title: event.title,
    detail: event.detail || "",
    summary: event.summary || "",
    notes: event.body || "",
    tags: event.tags?.join("; ") || "",
  })));
}

function timelineIssueRows(events: CalendarEvent[]) {
  return sortByDateTime(events.map((event) => ({
    date: event.date,
    time: event.time,
    issue: issueLabelForEvent(event),
    source: event.sourceLabel || "",
    title: event.title,
    detail: event.detail || "",
    summary: event.summary || "",
    notes: event.body || "",
    tags: event.tags?.join("; ") || "",
  })));
}

function filingCorrelationRows(filingEvents: CalendarEvent[], noFaceTimeEvents: CalendarEvent[]) {
  return sortByDateTime(filingEvents.map((event) => {
    const sameDay = noFaceTimeEvents.filter((item) => dateDiffDays(event.date, item.date) === 0).length;
    const within7 = noFaceTimeEvents.filter((item) => {
      const diff = dateDiffDays(event.date, item.date);
      return diff >= 0 && diff <= 7;
    }).length;
    const within14 = noFaceTimeEvents.filter((item) => {
      const diff = dateDiffDays(event.date, item.date);
      return diff >= 0 && diff <= 14;
    }).length;

    return {
      date: event.date,
      time: event.time,
      filing_note: event.title,
      same_day_no_facetime: sameDay,
      within_7_days_no_facetime: within7,
      within_14_days_no_facetime: within14,
      note_text: event.body || event.summary || event.detail || "",
    };
  }));
}

function toTableRows<T>(records: T[], mapper: (record: T) => string[]) {
  return records.map(mapper);
}

export function sectionExportToCsv(packet: SectionExportPacket) {
  const rows: Array<Record<string, unknown>> = [];

  for (const metric of packet.metrics) {
    rows.push({
      export_part: "metric",
      section: packet.title,
      item: metric.label,
      value: metric.value,
      detail: metric.detail || "",
    });
  }

  for (const chart of packet.charts) {
    for (const row of chart.rows) {
      rows.push({
        export_part: "chart_data",
        section: packet.title,
        chart: chart.title,
        label: row.label,
        value: row.value,
        secondary_value: row.secondaryValue ?? "",
        tertiary_value: row.tertiaryValue ?? "",
        unit: chart.unit || "",
      });
    }
  }

  for (const table of packet.tables) {
    for (const row of table.rows) {
      const record: Record<string, unknown> = {
        export_part: "table_row",
        section: packet.title,
        table: table.title,
      };
      table.headers.forEach((header, index) => {
        record[header.toLowerCase().replaceAll(" ", "_")] = row[index] || "";
      });
      rows.push(record);
    }
  }

  return rowsToCsv(rows);
}

export function buildSectionExportPacket(
  dataset: RecordsDataset,
  userId: string,
  caseId: string,
  range: DateRange,
  id: SectionExportId
): SectionExportPacket {
  const matter = dataset.matters.find((item) => item.id === caseId && item.userId === userId);
  const caseName = matter?.caseName || "Selected custody matter";
  const generatedAt = formatGeneratedAt();
  const disclaimer =
    "This export organizes user-entered records. It is not legal advice; review with a qualified attorney before filing or sharing.";
  const events = buildCalendarEvents(dataset, userId, caseId, range).filter(isTimelineVisibleEvent);
  const exchangeRules = ownedCaseRecords(dataset.exchangeRules, userId, caseId);
  const expectedExchanges = generateExpectedExchangeEvents(exchangeRules, range);
  const exchangeLogs = ownedCaseRecords(dataset.exchangeLogs, userId, caseId).filter((log) =>
    isWithinDateRange(getIsoDateFromDateTime(log.orderedExchangeAt), range)
  );
  const custodyAssignments = ownedCaseRecords(dataset.custodyDayAssignments, userId, caseId).filter((item) =>
    isWithinDateRange(item.date, range)
  );
  const notes = ownedCaseRecords(dataset.dateNotes, userId, caseId).filter((note) =>
    isWithinDateRange(note.noteDate, range)
  );
  const evidence = ownedCaseRecords(dataset.evidenceItems, userId, caseId).filter((item) =>
    isWithinDateRange(evidenceRecordDate(item), range)
  );
  const payments = ownedCaseRecords(dataset.childSupportPayments, userId, caseId).filter((payment) =>
    isWithinDateRange(payment.dueDate, range)
  );
  const orders = ownedCaseRecords(dataset.childSupportOrders, userId, caseId);
  const expenses = ownedCaseRecords(dataset.expenseItems, userId, caseId).filter((expense) =>
    isWithinDateRange(expense.expenseDate, range)
  );
  const exchangeStats = calculateExchangeStats(exchangeLogs, expectedExchanges, range);
  const supportStats = calculateChildSupportStats(payments, range);
  const expenseStats = calculateExpenseStats(expenses, range);
  const attentionEvents = events.filter((event) => event.severity === "attention" || event.severity === "critical");

  const base = {
    id,
    title: sectionExportLabels[id],
    caseName,
    range,
    generatedAt,
    disclaimer,
  };

  if (id === "calendar") {
    return {
      ...base,
      summaries: [
        `From ${range.from} to ${range.to}, the calendar includes ${custodyAssignments.length} custody day assignment${custodyAssignments.length === 1 ? "" : "s"} and ${events.length} dated event${events.length === 1 ? "" : "s"}.`,
        `${attentionEvents.length} dated event${attentionEvents.length === 1 ? "" : "s"} in this range are marked for review based on status/category.`,
      ],
      metrics: [
        { label: "Custody days", value: custodyAssignments.length, detail: "Color-coded calendar entries" },
        { label: "Dated records", value: events.length, detail: "Timeline-visible sources" },
        { label: "Needs review", value: attentionEvents.length, detail: "Attention or critical severity" },
      ],
      charts: [
        {
          title: "Custody days by caregiver label",
          description: "Count of color-coded custody calendar days in the selected range.",
          unit: "days",
          rows: countBy(custodyAssignments, (item) => item.caregiverLabel),
        },
        {
          title: "Calendar records by source",
          description: "Dated exchange, note, file, support, and expense records shown on the calendar.",
          unit: "records",
          rows: countBy(events, (event) => labelEventType(event.type)),
        },
      ],
      tables: [
        {
          title: "Custody day assignments",
          headers: ["Date", "Caregiver", "Start", "End", "Exchange", "Location", "Notes"],
          rows: toTableRows(custodyAssignments, (item) => [
            item.date,
            item.caregiverLabel,
            item.startsAt || "",
            item.endsAt || "",
            item.exchangeTime || "",
            item.exchangeLocation || "",
            item.notes || "",
          ]),
        },
        {
          title: "Calendar event list",
          headers: ["Date", "Time", "Type", "Title", "Detail", "Attention"],
          rows: toTableRows(events, (event) => [
            event.date,
            event.time || "",
            labelEventType(event.type),
            event.title,
            event.detail || "",
            eventSeverityLabel(event.severity),
          ]),
        },
      ],
      suggestedUses: [
        "Show parenting-time patterns by date range.",
        "Attach to a broader timeline packet when explaining recurring transition issues.",
      ],
    };
  }

  if (id === "timeline") {
    return {
      ...base,
      summaries: [
        `The timeline has ${events.length} dated record${events.length === 1 ? "" : "s"} in the selected range, with ${attentionEvents.length} marked for review.`,
        "Timeline exports combine exchange, note, file, support, and expense records in chronological order.",
      ],
      metrics: [
        { label: "Timeline records", value: events.length, detail: `${range.from} to ${range.to}` },
        { label: "Needs review", value: attentionEvents.length, detail: "Attention or critical severity" },
        { label: "Review share", value: formatPercent(attentionEvents.length, events.length), detail: "Of timeline records" },
      ],
      charts: [
        {
          title: "Timeline records by type",
          unit: "records",
          rows: countBy(events, (event) => labelEventType(event.type)),
        },
        {
          title: "Timeline records by review level",
          unit: "records",
          rows: countBy(events, (event) => eventSeverityLabel(event.severity)),
        },
      ],
      tables: [
        {
          title: "Chronological timeline",
          headers: ["Date", "Time", "Type", "Title", "Summary", "Detail", "Notes", "Tags"],
          rows: toTableRows(events, (event) => [
            event.date,
            event.time || "",
            labelEventType(event.type),
            event.title,
            event.summary || "",
            event.detail || "",
            event.body || "",
            event.tags?.join("; ") || "",
          ]),
        },
      ],
      suggestedUses: [
        "Give counsel a single chronological fact pattern.",
        "Filter the in-app timeline before exporting CSV when a narrower issue packet is needed.",
      ],
    };
  }

  if (id === "exchanges") {
    const timingRows = exchangeLogs.map((log) => {
      const timing = calculateExchangeTiming(log);
      return {
        label: getIsoDateFromDateTime(log.orderedExchangeAt),
        value: timing.minutesEarlyOrLate ?? 0,
      };
    });

    return {
      ...base,
      summaries: [
        buildNeutralExchangeSummary(
          range,
          exchangeStats.scheduledCount,
          exchangeStats.lateCount,
          exchangeStats.averageLatenessMinutes,
          exchangeStats.missedCount
        ),
        `${exchangeLogs.length} actual exchange outcome${exchangeLogs.length === 1 ? "" : "s"} were logged in this range.`,
      ],
      metrics: [
        { label: "Scheduled", value: exchangeStats.scheduledCount, detail: "Expected from saved rules and logs" },
        { label: "Logged", value: exchangeStats.loggedCount, detail: "Actual outcomes entered" },
        { label: "Late", value: exchangeStats.lateCount, detail: `${exchangeStats.averageLatenessMinutes} min average delay` },
        { label: "Missed/refused", value: exchangeStats.missedCount + exchangeStats.refusedCount, detail: "User-entered statuses" },
      ],
      charts: [
        {
          title: "Minutes early/late by logged exchange",
          description: "Positive numbers are minutes after the ordered time; negative numbers are early.",
          unit: "minutes",
          rows: timingRows,
        },
        {
          title: "Logged exchange outcomes",
          unit: "records",
          rows: countBy(exchangeLogs, (log) => labelExchangeStatus(log.status)),
        },
      ],
      tables: [
        {
          title: "Logged exchange outcomes",
          headers: ["Date", "Ordered", "Actual", "Minutes late/early", "Status", "Reason", "Notes", "Tags"],
          rows: toTableRows(exchangeLogs, (log) => {
            const timing = calculateExchangeTiming(log);
            return [
              getIsoDateFromDateTime(log.orderedExchangeAt),
              log.orderedExchangeAt.slice(11, 16),
              log.actualExchangeAt?.slice(11, 16) || "",
              timing.minutesEarlyOrLate === null ? "" : String(timing.minutesEarlyOrLate),
              labelExchangeStatus(log.status),
              log.reasonGiven || "",
              log.notes || "",
              log.tags.join("; "),
            ];
          }),
        },
        {
          title: "Scheduled exchange expectations",
          headers: ["Date", "Ordered time", "Rule", "Direction", "Location"],
          rows: toTableRows(expectedExchanges, (event) => [
            getIsoDateFromDateTime(event.orderedExchangeAt),
            event.orderedExchangeAt.slice(11, 16),
            event.ruleName,
            event.direction.replaceAll("_", " "),
            event.location || "",
          ]),
        },
      ],
      suggestedUses: [
        "Show the ordered time compared with actual transition times.",
        "Pair with screenshots/messages as file attachments when available.",
      ],
    };
  }

  if (id === "notes") {
    const included = notes.filter((note) => note.includeInReports).length;
    return {
      ...base,
      summaries: [
        `${notes.length} date-based note${notes.length === 1 ? "" : "s"} are recorded in this range. ${included} are marked for report inclusion.`,
        "Notes are grouped by category so counsel can separate communication, exchange, child-item, safety, court, and support issues.",
      ],
      metrics: [
        { label: "Notes", value: notes.length, detail: `${range.from} to ${range.to}` },
        { label: "Included", value: included, detail: "Selected for reports" },
        { label: "Not selected", value: notes.length - included, detail: "Stored for context" },
      ],
      charts: [
        {
          title: "Notes by category",
          unit: "notes",
          rows: countBy(notes, (note) => labelNoteCategory(note.category)),
        },
        {
          title: "Report inclusion status",
          unit: "notes",
          rows: countBy(notes, (note) => (note.includeInReports ? "Included in reports" : "Not selected")),
        },
      ],
      tables: [
        {
          title: "Date-based notes",
          headers: ["Date", "Time", "Category", "Title", "Body", "Tags", "Included"],
          rows: toTableRows(notes, (note) => [
            note.noteDate,
            note.noteTime || "",
            labelNoteCategory(note.category),
            note.title,
            note.body,
            note.tags.join("; "),
            note.includeInReports ? "Yes" : "No",
          ]),
        },
      ],
      suggestedUses: [
        "Give counsel issue-specific narrative records without raw app navigation.",
        "Use category charts to show where the record set is concentrated.",
      ],
    };
  }

  if (id === "evidence") {
    const index = buildEvidenceIndex(evidence, range);
    const needsReview = evidence.filter((item) => (item.reviewStatus || "needs_review") === "needs_review").length;
    return {
      ...base,
      summaries: [
        `${evidence.length} attached file${evidence.length === 1 ? "" : "s"} are indexed in this range. ${needsReview} need review before use.`,
        "File exports include metadata only. Download original files separately from the Files section when needed.",
      ],
      metrics: [
        { label: "Attached files", value: evidence.length, detail: "Metadata records" },
        { label: "Need review", value: needsReview, detail: "Review status" },
        { label: "Included", value: evidence.filter((item) => item.includeInReports).length, detail: "Selected for reports" },
      ],
      charts: [
        {
          title: "File review status",
          unit: "items",
          rows: countBy(evidence, (item) => (item.reviewStatus || "needs_review").replaceAll("_", " ")),
        },
        {
          title: "File scan status",
          unit: "items",
          rows: countBy(evidence, (item) => item.malwareScanStatus || "pending"),
        },
      ],
      tables: [
        {
          title: "File index",
          headers: ["Index", "File", "Date", "Description", "Tags", "Scan", "Storage"],
          rows: index.map((item) => [
            String(item.index),
            item.fileName,
            item.evidenceDate,
            item.description,
            item.tags,
            item.scanStatus,
            item.storageStatus,
          ]),
        },
      ],
      suggestedUses: [
        "Give counsel a file index before sending original files.",
        "Use review and scan charts to show what is ready versus still pending.",
      ],
    };
  }

  if (id === "child_support") {
    const trendRows = childSupportChartRows(payments, range);
    return {
      ...base,
      summaries: [
        buildNeutralChildSupportSummary(range, supportStats),
        `${orders.length} support order record${orders.length === 1 ? "" : "s"} and ${payments.length} payment record${payments.length === 1 ? "" : "s"} are included in this section.`,
      ],
      metrics: [
        { label: "Total due", value: formatMoney(supportStats.totalDue), detail: "Selected range" },
        { label: "Total paid", value: formatMoney(supportStats.totalPaid), detail: "User-entered records" },
        { label: "Unpaid balance", value: formatMoney(supportStats.unpaidBalance), detail: `${supportStats.unpaidCount} unpaid` },
        { label: "Average days late", value: supportStats.averageDaysLate, detail: "Paid late records" },
      ],
      charts: [
        {
          title: "Monthly due, paid, and unpaid balance",
          unit: "USD",
          seriesLabels: ["Amount due", "Amount paid", "Unpaid balance"],
          rows: trendRows.map((row) => ({
            label: row.month,
            value: row.amountDue,
            secondaryValue: row.amountPaid,
            tertiaryValue: row.unpaidBalance,
          })),
        },
        {
          title: "Payment status mix",
          unit: "payments",
          rows: countBy(payments, (payment) => labelPaymentStatus(payment.paymentStatus)),
        },
      ],
      tables: [
        {
          title: "Support orders",
          headers: ["Order", "Amount", "Frequency", "Payer", "Recipient", "Effective start"],
          rows: toTableRows(orders, (order) => [
            order.orderNickname,
            formatMoney(order.orderedAmount, order.currency),
            order.paymentFrequency.replaceAll("_", " "),
            order.payerLabel,
            order.recipientLabel,
            order.effectiveStartDate,
          ]),
        },
        {
          title: "Payment records",
          headers: ["Due date", "Due", "Paid", "Payment date", "Status", "Method", "Notes"],
          rows: toTableRows(payments, (payment) => [
            payment.dueDate,
            formatMoney(payment.amountDue),
            formatMoney(payment.amountPaid),
            payment.paymentDate || "",
            labelPaymentStatus(payment.paymentStatus),
            payment.paymentMethod.replaceAll("_", " "),
            payment.notes || "",
          ]),
        },
      ],
      suggestedUses: [
        "Show due-versus-paid history and unpaid balance by month.",
        "Export before discussing reimbursement, arrears, or payment compliance with counsel.",
      ],
    };
  }

  return {
    ...base,
    summaries: [
      `Based on records entered in this app, expenses in this range total ${formatMoney(expenseStats.totalExpenses)}. Unpaid reimbursement based on user-entered records is ${formatMoney(expenseStats.unpaidReimbursement)}.`,
      `${expenses.length} expense record${expenses.length === 1 ? "" : "s"} are included, with ${expenseStats.reimbursementRequested > 0 ? formatMoney(expenseStats.reimbursementRequested) : "$0.00"} marked as reimbursement requested.`,
    ],
    metrics: [
      { label: "Total expenses", value: formatMoney(expenseStats.totalExpenses), detail: "Selected range" },
      { label: "Requested", value: formatMoney(expenseStats.reimbursementRequested), detail: "Reimbursement requested" },
      { label: "Received", value: formatMoney(expenseStats.reimbursementReceived), detail: "Marked reimbursed" },
      { label: "Unpaid", value: formatMoney(expenseStats.unpaidReimbursement), detail: "User-entered records" },
    ],
    charts: [
      {
        title: "Expenses by category",
        unit: "USD",
        rows: expenseStats.byCategory.map((row) => ({ label: row.category, value: row.amount })),
      },
      {
        title: "Reimbursement status mix",
        unit: "expenses",
        rows: countBy(expenses, (expense) => expense.reimbursementStatus.replaceAll("_", " ")),
      },
    ],
    tables: [
      {
        title: "Expense records",
        headers: ["Date", "Category", "Description", "Amount", "Paid by", "Requested", "Status", "Reimbursed", "Notes"],
        rows: toTableRows(expenses, (expense) => [
          expense.expenseDate,
          expense.category,
          expense.description,
          formatMoney(expense.amount, expense.currency),
          expense.paidByLabel,
          expense.reimbursementRequested ? "Yes" : "No",
          expense.reimbursementStatus.replaceAll("_", " "),
          formatMoney(expense.amountReimbursed || 0, expense.currency),
          expense.notes || "",
        ]),
      },
    ],
    suggestedUses: [
      "Show custody-related expense totals and reimbursement status.",
      "Pair with receipt file sheets when asking counsel to review support documents.",
    ],
  };
}

export function buildReportRows(
  dataset: RecordsDataset,
  userId: string,
  caseId: string,
  range: DateRange,
  reportType: ReportType
) {
  const events = buildCalendarEvents(dataset, userId, caseId, range).filter(isTimelineVisibleEvent);
  const noFaceTimeEvents = events.filter(isNoFaceTimeTimelineEvent);
  const filingEvents = events.filter(eventMatchesFilingLanguage);
  const issueEvents = events.filter(isIssueReportEvent);

  const exchangeRows = dataset.exchangeLogs
    .filter((log) => log.userId === userId && log.caseId === caseId)
    .filter((log) => isWithinDateRange(getIsoDateFromDateTime(log.orderedExchangeAt), range))
    .map((log) => {
      const timing = calculateExchangeTiming(log);
      return {
        date: getIsoDateFromDateTime(log.orderedExchangeAt),
        ordered_exchange_time: log.orderedExchangeAt.slice(11, 16),
        actual_exchange_time: log.actualExchangeAt ? log.actualExchangeAt.slice(11, 16) : "",
        direction: labelExchangeDirection(log.direction),
        minutes_early_or_late: timing.minutesEarlyOrLate ?? "",
        status: labelExchangeStatus(log.status),
        location: log.location || "",
        reason_given: log.reasonGiven || "",
        notes: log.notes || "",
        tags: log.tags.join("; "),
      };
    });

  const timelineRows = timelineIssueRows(issueEvents);
  const facetimeRows = noFaceTimeRows(events);
  const correlationRows = filingCorrelationRows(filingEvents, noFaceTimeEvents);

  const custodyScheduleRows = dataset.custodyDayAssignments
    .filter((assignment) => assignment.userId === userId && assignment.caseId === caseId)
    .filter((assignment) => isWithinDateRange(assignment.date, range))
    .map((assignment) => ({
      date: assignment.date,
      caregiver_label: assignment.caregiverLabel,
      start_time: assignment.startsAt || "",
      end_time: assignment.endsAt || "",
      exchange_time: assignment.exchangeTime || "",
      exchange_direction: assignment.exchangeDirection?.replaceAll("_", " ") || "",
      exchange_location: assignment.exchangeLocation || "",
    }));

  const childSupportRows = dataset.childSupportPayments
    .filter((payment) => payment.userId === userId && payment.caseId === caseId)
    .filter((payment) => isWithinDateRange(payment.dueDate, range))
    .map((payment) => ({
      due_date: payment.dueDate,
      amount_due: payment.amountDue,
      amount_paid: payment.amountPaid,
      payment_date: payment.paymentDate || "",
      status: labelPaymentStatus(payment.paymentStatus),
      method: payment.paymentMethod.replaceAll("_", " "),
    }));

  const expenseRows = dataset.expenseItems
    .filter((expense) => expense.userId === userId && expense.caseId === caseId)
    .filter((expense) => isWithinDateRange(expense.expenseDate, range))
    .map((expense) => ({
      expense_date: expense.expenseDate,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      reimbursement_status: expense.reimbursementStatus.replaceAll("_", " "),
      amount_reimbursed: expense.amountReimbursed || 0,
    }));

  if (reportType === "exchange_compliance") return exchangeRows;
  if (reportType === "facetime_cancellations") return facetimeRows;
  if (reportType === "incident_timeline") return timelineRows;
  if (reportType === "filing_facetime_correlation") return correlationRows;
  if (reportType === "child_support_payment") return childSupportRows;
  if (reportType === "expense_reimbursement") return expenseRows;

  return [
    ...custodyScheduleRows.map((row) => ({ section: "custody_schedule", ...row })),
    ...exchangeRows.map((row) => ({ section: "exchange", ...row })),
    ...facetimeRows.map((row) => ({ section: "facetime", ...row })),
    ...correlationRows.map((row) => ({ section: "filing_facetime_timing", ...row })),
    ...timelineRows.map((row) => ({ section: "issue_timeline", ...row })),
  ];
}

export function buildReportPreview(
  dataset: RecordsDataset,
  userId: string,
  caseId: string,
  range: DateRange,
  reportType: ReportType
): ReportPreview {
  const matter = dataset.matters.find((item) => item.id === caseId && item.userId === userId);
  const rules = dataset.exchangeRules.filter((item) => item.caseId === caseId && item.userId === userId);
  const expected = generateExpectedExchangeEvents(rules, range);
  const exchangeLogs = dataset.exchangeLogs
    .filter((item) => item.caseId === caseId && item.userId === userId)
    .filter((item) => isWithinDateRange(getIsoDateFromDateTime(item.orderedExchangeAt), range));
  const evidence = dataset.evidenceItems.filter((item) => item.caseId === caseId && item.userId === userId);
  const events = buildCalendarEvents(dataset, userId, caseId, range).filter(isTimelineVisibleEvent);
  const noFaceTimeEvents = events.filter(isNoFaceTimeTimelineEvent);
  const postCallNoFaceTimeEvents = noFaceTimeEvents.filter(isPostCallFaceTimeNotice);
  const filingEvents = events.filter(eventMatchesFilingLanguage);
  const issueEvents = events.filter(isIssueReportEvent);
  const exchangeStats = calculateExchangeStats(exchangeLogs, expected, range);
  const rows = buildReportRows(dataset, userId, caseId, range, reportType);
  const generatedAt = formatGeneratedAt();
  const otherParentLabel = matter?.otherParentLabel || "Other parent";
  const userRoleLabel = matter?.userRoleLabel || "Me";
  const months = monthKeysInRange(range);
  const lateExchangeEvents = issueEvents.filter(isLateExchangeTimelineEvent);
  const missedExchangeEvents = issueEvents.filter(isMissedExchangeTimelineEvent);
  const lateLogs = exchangeLogs.filter((log) => calculateExchangeTiming(log).isLate);
  const loggedCount = exchangeLogs.length;
  const lateShare = formatPercent(lateLogs.length, loggedCount);
  const postCallShare = formatPercent(postCallNoFaceTimeEvents.length, noFaceTimeEvents.length);
  const longestDelay = lateLogs.reduce((max, log) => {
    const timing = calculateExchangeTiming(log);
    return Math.max(max, timing.minutesEarlyOrLate || 0);
  }, 0);

  const issueTrendRows = months.map((month) => ({
    label: month,
    value: lateExchangeEvents.filter((event) => getMonthKey(event.date) === month).length,
    secondaryValue: noFaceTimeEvents.filter((event) => getMonthKey(event.date) === month).length,
    tertiaryValue: missedExchangeEvents.filter((event) => getMonthKey(event.date) === month).length,
  }));

  const facetimeTrendRows = months.map((month) => ({
    label: month,
    value: noFaceTimeEvents.filter((event) => getMonthKey(event.date) === month).length,
    secondaryValue: postCallNoFaceTimeEvents.filter((event) => getMonthKey(event.date) === month).length,
  }));

  const filingTrendRows = months.map((month) => ({
    label: month,
    value: filingEvents.filter((event) => getMonthKey(event.date) === month).length,
    secondaryValue: noFaceTimeEvents.filter((event) => getMonthKey(event.date) === month).length,
    tertiaryValue: postCallNoFaceTimeEvents.filter((event) => getMonthKey(event.date) === month).length,
  }));

  const filingWindowRows = filingEvents.map((event) => {
    const sameDay = noFaceTimeEvents.filter((item) => dateDiffDays(event.date, item.date) === 0).length;
    const within7 = noFaceTimeEvents.filter((item) => {
      const diff = dateDiffDays(event.date, item.date);
      return diff >= 0 && diff <= 7;
    }).length;
    const within14 = noFaceTimeEvents.filter((item) => {
      const diff = dateDiffDays(event.date, item.date);
      return diff >= 0 && diff <= 14;
    }).length;

    return {
      label: event.date,
      value: sameDay,
      secondaryValue: within7,
      tertiaryValue: within14,
    };
  });

  const base = {
    caseName: matter?.caseName || "Selected custody matter",
    generatedAt,
    disclaimer:
      "This report organizes user-entered records. It is not legal advice; review with a qualified attorney before filing or sharing.",
    rows,
    evidenceIndex: buildEvidenceIndex(evidence, range),
  };

  if (reportType === "exchange_compliance") {
    const exchangeTable: SectionExportTable = {
      title: "Logged exchange timing",
      headers: ["Date", "Ordered", "Actual", "Direction", "Minutes late/early", "Status", "Reason", "Notes"],
      rows: toTableRows(exchangeLogs, (log) => {
        const timing = calculateExchangeTiming(log);
        return [
          getIsoDateFromDateTime(log.orderedExchangeAt),
          log.orderedExchangeAt.slice(11, 16),
          log.actualExchangeAt?.slice(11, 16) || "",
          labelExchangeDirection(log.direction),
          timing.minutesEarlyOrLate === null ? "" : String(timing.minutesEarlyOrLate),
          labelExchangeStatus(log.status),
          log.reasonGiven || "",
          log.notes || "",
        ];
      }),
    };

    return {
      ...base,
      title: reportTypeLabels.exchange_compliance,
      focus: "Exchange timing and lateness",
      summaries: [
        loggedCount === 0
          ? `No logged exchanges are recorded from ${range.from} to ${range.to}.`
          : `${lateLogs.length} of ${loggedCount} logged exchanges are marked late (${lateShare}). Average recorded delay is ${formatMinutes(exchangeStats.averageLatenessMinutes)}.`,
        `${otherParentLabel} to ${userRoleLabel} and ${userRoleLabel} to ${otherParentLabel} are separated in the direction chart so the report shows which exchange direction is driving the count.`,
        longestDelay > 0
          ? `The longest recorded delay in this range is ${formatMinutes(longestDelay)}.`
          : "No positive delay is recorded in this range.",
      ],
      metrics: [
        { label: "Logged exchanges", value: loggedCount, detail: `${range.from} to ${range.to}` },
        { label: "Late exchanges", value: lateLogs.length, detail: `${lateShare} of logged exchanges` },
        { label: "Average delay", value: formatMinutes(exchangeStats.averageLatenessMinutes), detail: "Late records only" },
        { label: "Longest delay", value: formatMinutes(longestDelay), detail: "Highest positive delay" },
      ],
      charts: [
        {
          kind: "bar",
          title: "Minutes late/early by exchange date",
          description: "Positive values are minutes after the ordered time; negative values are early.",
          unit: "minutes",
          rows: lateExchangeRows(exchangeLogs),
          emptyLabel: "No logged exchange timing records in this range.",
        },
        {
          kind: "bar",
          orientation: "horizontal",
          title: "Late exchanges by direction",
          description: "Compares late count against not-late count for each exchange direction.",
          unit: "exchanges",
          seriesLabels: ["Late", "Not late"],
          rows: exchangeDirectionRows(exchangeLogs),
          emptyLabel: "No exchange direction data in this range.",
        },
        {
          kind: "bar",
          orientation: "horizontal",
          title: "Exchange outcome counts",
          unit: "records",
          rows: exchangeOutcomeRows(exchangeLogs),
          emptyLabel: "No exchange outcomes in this range.",
        },
      ],
      tables: [exchangeTable],
    };
  }

  if (reportType === "facetime_cancellations") {
    const table: SectionExportTable = {
      title: "No FaceTime records",
      headers: ["Date", "Time", "Issue", "Title", "Detail", "Summary", "Notes", "Tags"],
      rows: noFaceTimeRows(events).map((row) => [
        row.date,
        row.time || "",
        row.type,
        row.title,
        row.detail,
        row.summary,
        row.notes,
        row.tags,
      ]),
    };

    return {
      ...base,
      title: reportTypeLabels.facetime_cancellations,
      focus: "FaceTime cancellations and notice timing",
      summaries: [
        `${noFaceTimeEvents.length} no-FaceTime record${noFaceTimeEvents.length === 1 ? "" : "s"} are in this range.`,
        `${postCallNoFaceTimeEvents.length} of those records (${postCallShare}) indicate notice after a call/request or unanswered call based on the entered notes/tags.`,
        "The report separates post-call notice from other no-FaceTime records so the timing pattern is visible.",
      ],
      metrics: [
        { label: "No FaceTime records", value: noFaceTimeEvents.length, detail: `${range.from} to ${range.to}` },
        { label: "After call/request", value: postCallNoFaceTimeEvents.length, detail: postCallShare },
        {
          label: "Other no-FaceTime",
          value: noFaceTimeEvents.length - postCallNoFaceTimeEvents.length,
          detail: "No post-call marker found",
        },
        { label: "Monthly span", value: months.length, detail: "Months charted" },
      ],
      charts: [
        {
          kind: "line",
          title: "No FaceTime records by month",
          description: "Compares all no-FaceTime records with the subset marked after a call/request.",
          unit: "records",
          seriesLabels: ["No FaceTime", "After call/request"],
          rows: facetimeTrendRows,
          emptyLabel: "No no-FaceTime records in this range.",
        },
        {
          kind: "bar",
          orientation: "horizontal",
          title: "Notice timing pattern",
          unit: "records",
          rows: [
            { label: "Notice after call/request", value: postCallNoFaceTimeEvents.length },
            { label: "Other no-FaceTime records", value: noFaceTimeEvents.length - postCallNoFaceTimeEvents.length },
          ],
          emptyLabel: "No no-FaceTime records in this range.",
        },
      ],
      tables: [table],
    };
  }

  if (reportType === "filing_facetime_correlation") {
    const table: SectionExportTable = {
      title: "Filing notes with nearby no-FaceTime counts",
      headers: ["Date", "Time", "Filing note", "Same day", "Within 7 days", "Within 14 days", "Note text"],
      rows: filingCorrelationRows(filingEvents, noFaceTimeEvents).map((row) => [
        row.date,
        row.time || "",
        row.filing_note,
        String(row.same_day_no_facetime),
        String(row.within_7_days_no_facetime),
        String(row.within_14_days_no_facetime),
        row.note_text,
      ]),
    };
    const within7Total = filingWindowRows.reduce((total, row) => total + (row.secondaryValue || 0), 0);

    return {
      ...base,
      title: reportTypeLabels.filing_facetime_correlation,
      focus: "Filing dates compared with no-FaceTime timing",
      summaries: [
        `${filingEvents.length} court/attorney filing note${filingEvents.length === 1 ? "" : "s"} are detected in this range.`,
        `${within7Total} no-FaceTime record${within7Total === 1 ? "" : "s"} fall within seven days after those filing notes.`,
        "This report shows timing overlap only; it does not claim why a FaceTime did or did not occur.",
      ],
      metrics: [
        { label: "Filing notes", value: filingEvents.length, detail: "Court/attorney notes with filing language" },
        { label: "No FaceTime records", value: noFaceTimeEvents.length, detail: `${range.from} to ${range.to}` },
        { label: "Within 7 days", value: within7Total, detail: "After filing note dates" },
        { label: "Post-call notices", value: postCallNoFaceTimeEvents.length, detail: "Subset of no-FaceTime records" },
      ],
      charts: [
        {
          kind: "bar",
          title: "No FaceTime records after filing notes",
          description: `For each filing note date, bars compare ${formatDateRangeWindow(0)}, within 7 days, and within 14 days.`,
          unit: "records",
          seriesLabels: ["Same day", "Within 7 days", "Within 14 days"],
          rows: filingWindowRows,
          emptyLabel: "No court/attorney filing notes detected in this range.",
        },
        {
          kind: "line",
          title: "Monthly filing notes and no-FaceTime records",
          unit: "records",
          seriesLabels: ["Filing notes", "No FaceTime", "After call/request"],
          rows: filingTrendRows,
          emptyLabel: "No filing or no-FaceTime records in this range.",
        },
      ],
      tables: [table],
    };
  }

  if (reportType === "incident_timeline") {
    const table: SectionExportTable = {
      title: "Issue timeline rows",
      headers: ["Date", "Time", "Issue", "Source", "Title", "Detail", "Summary", "Notes", "Tags"],
      rows: timelineIssueRows(issueEvents).map((row) => [
        row.date,
        row.time || "",
        row.issue,
        row.source,
        row.title,
        row.detail,
        row.summary,
        row.notes,
        row.tags,
      ]),
    };

    return {
      ...base,
      title: reportTypeLabels.incident_timeline,
      focus: "Timeline issue pattern",
      summaries: [
        `${issueEvents.length} timeline record${issueEvents.length === 1 ? "" : "s"} match the issue filters in this range.`,
        `${lateExchangeEvents.length} are marked late exchange records and ${noFaceTimeEvents.length} are no-FaceTime records.`,
        "Custody-day color blocks are excluded from this report so the timeline only shows event records.",
      ],
      metrics: [
        { label: "Issue records", value: issueEvents.length, detail: `${range.from} to ${range.to}` },
        { label: "Late exchanges", value: lateExchangeEvents.length, detail: "Log or note pattern" },
        { label: "No FaceTime", value: noFaceTimeEvents.length, detail: "Communication notes" },
        { label: "Missed/refused", value: missedExchangeEvents.length, detail: "Exchange records" },
      ],
      charts: [
        {
          kind: "bar",
          orientation: "horizontal",
          title: "Issue counts by category",
          unit: "records",
          rows: countBy(issueEvents, issueLabelForEvent),
          emptyLabel: "No issue records in this range.",
        },
        {
          kind: "line",
          title: "Monthly issue trend",
          unit: "records",
          seriesLabels: ["Late exchange", "No FaceTime", "Missed/refused exchange"],
          rows: issueTrendRows,
          emptyLabel: "No issue trend rows in this range.",
        },
      ],
      tables: [table],
    };
  }

  const issueTable: SectionExportTable = {
    title: "Combined issue rows",
    headers: ["Date", "Time", "Issue", "Source", "Title", "Detail", "Summary", "Notes", "Tags"],
    rows: timelineIssueRows(issueEvents).map((row) => [
      row.date,
      row.time || "",
      row.issue,
      row.source,
      row.title,
      row.detail,
      row.summary,
      row.notes,
      row.tags,
    ]),
  };

  return {
    ...base,
    title: reportTypeLabels[reportType],
    focus: reportType === "combined_court_packet" ? "Combined court issue packet" : "Attorney issue review",
    summaries: [
      `${issueEvents.length} issue record${issueEvents.length === 1 ? "" : "s"} are included from ${range.from} to ${range.to}.`,
      `${lateExchangeEvents.length} late exchange record${lateExchangeEvents.length === 1 ? "" : "s"}, ${noFaceTimeEvents.length} no-FaceTime record${noFaceTimeEvents.length === 1 ? "" : "s"}, and ${filingEvents.length} court/attorney filing note${filingEvents.length === 1 ? "" : "s"} are detected.`,
      "The combined packet prioritizes custody timeline issues and does not include child support or expense sections.",
    ],
    metrics: [
      { label: "Issue records", value: issueEvents.length, detail: `${range.from} to ${range.to}` },
      { label: "Late exchanges", value: lateExchangeEvents.length, detail: "Exchange logs/notes" },
      { label: "No FaceTime", value: noFaceTimeEvents.length, detail: `${postCallNoFaceTimeEvents.length} after call/request` },
      { label: "Filing notes", value: filingEvents.length, detail: "Court/attorney timing records" },
    ],
    charts: [
      {
        kind: "bar",
        orientation: "horizontal",
        title: "Issue counts by category",
        unit: "records",
        rows: countBy(issueEvents, issueLabelForEvent),
        emptyLabel: "No issue records in this range.",
      },
      {
        kind: "line",
        title: "Monthly issue trend",
        unit: "records",
        seriesLabels: ["Late exchange", "No FaceTime", "Missed/refused exchange"],
        rows: issueTrendRows,
        emptyLabel: "No issue trend rows in this range.",
      },
      {
        kind: "bar",
        orientation: "horizontal",
        title: "Late exchanges by direction",
        unit: "exchanges",
        seriesLabels: ["Late", "Not late"],
        rows: exchangeDirectionRows(exchangeLogs),
        emptyLabel: "No exchange direction data in this range.",
      },
    ],
    tables: [issueTable],
  };
}

export function reportPreviewToCsv(preview: ReportPreview) {
  const rows: Array<Record<string, unknown>> = [];

  for (const metric of preview.metrics) {
    rows.push({
      export_part: "metric",
      report: preview.title,
      item: metric.label,
      value: metric.value,
      detail: metric.detail || "",
    });
  }

  for (const chart of preview.charts) {
    for (const row of chart.rows) {
      rows.push({
        export_part: "chart_data",
        report: preview.title,
        chart: chart.title,
        label: row.label,
        value: row.value,
        secondary_value: row.secondaryValue ?? "",
        tertiary_value: row.tertiaryValue ?? "",
        unit: chart.unit || "",
      });
    }
  }

  for (const table of preview.tables) {
    for (const row of table.rows) {
      const record: Record<string, unknown> = {
        export_part: "table_row",
        report: preview.title,
        table: table.title,
      };
      table.headers.forEach((header, index) => {
        record[header.toLowerCase().replaceAll(" ", "_").replaceAll("/", "_")] = row[index] || "";
      });
      rows.push(record);
    }
  }

  if (rows.length === 0) {
    rows.push({
      export_part: "empty_report",
      report: preview.title,
      item: "No report data",
      value: "",
      detail: preview.focus,
    });
  }

  return rowsToCsv(rows);
}
