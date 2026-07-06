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
  getIsoDateFromDateTime,
  isWithinDateRange,
  labelEventType,
  labelExchangeStatus,
  labelNoteCategory,
  labelPaymentStatus,
} from "./calculations";
import type { DateRange, RecordsDataset, ReportType } from "./types";

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
  evidence: "Evidence Index Packet",
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
  exchange_compliance: "Exchange Compliance Report",
  incident_timeline: "Incident Timeline Report",
  child_support_payment: "Child Support Payment Report",
  expense_reimbursement: "Expense/Reimbursement Report",
  combined_attorney_summary: "Combined Attorney Summary",
  combined_court_packet: "Combined Court Packet",
};

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

function eventSeverityLabel(value: string | undefined) {
  if (value === "critical") return "Critical";
  if (value === "attention") return "Needs review";
  if (value === "positive") return "Recorded";
  return "Neutral";
}

function evidenceRecordDate(item: RecordsDataset["evidenceItems"][number]) {
  return item.evidenceDate || item.uploadedAt.slice(0, 10);
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
  const generatedAt = new Date().toISOString();
  const disclaimer =
    "This export organizes user-entered records. It is not legal advice; review with a qualified attorney before filing or sharing.";
  const events = buildCalendarEvents(dataset, userId, caseId, range);
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
          description: "Dated exchange, note, evidence, support, and expense records shown on the calendar.",
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
        "Timeline exports combine exchange, note, evidence, support, and expense records in chronological order.",
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
        "Pair with screenshots/messages as evidence items when available.",
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
        `${evidence.length} evidence item${evidence.length === 1 ? "" : "s"} are indexed in this range. ${needsReview} need review before use.`,
        "Evidence exports include metadata only. Download original files separately from the evidence section when needed.",
      ],
      metrics: [
        { label: "Evidence items", value: evidence.length, detail: "Metadata records" },
        { label: "Need review", value: needsReview, detail: "Review status" },
        { label: "Included", value: evidence.filter((item) => item.includeInReports).length, detail: "Selected for reports" },
      ],
      charts: [
        {
          title: "Evidence review status",
          unit: "items",
          rows: countBy(evidence, (item) => (item.reviewStatus || "needs_review").replaceAll("_", " ")),
        },
        {
          title: "Evidence scan status",
          unit: "items",
          rows: countBy(evidence, (item) => item.malwareScanStatus || "pending"),
        },
      ],
      tables: [
        {
          title: "Evidence index",
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
        "Give counsel an evidence index before sending original files.",
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
      "Pair with receipt evidence sheets when asking counsel to review support documents.",
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
  const exchangeRows = dataset.exchangeLogs
    .filter((log) => log.userId === userId && log.caseId === caseId)
    .filter((log) => isWithinDateRange(getIsoDateFromDateTime(log.orderedExchangeAt), range))
    .map((log) => ({
      date: getIsoDateFromDateTime(log.orderedExchangeAt),
      ordered_exchange_time: log.orderedExchangeAt.slice(11, 16),
      actual_exchange_time: log.actualExchangeAt ? log.actualExchangeAt.slice(11, 16) : "",
      status: labelExchangeStatus(log.status),
      location: log.location || "",
      reason_given: log.reasonGiven || "",
      tags: log.tags.join("; "),
    }));

  const timelineRows = buildCalendarEvents(dataset, userId, caseId, range).map((event) => ({
    date: event.date,
    time: event.time || "",
    type: labelEventType(event.type),
    source: event.sourceLabel || "",
    title: event.title,
    detail: event.detail || "",
    summary: event.summary || "",
    notes: event.body || "",
    tags: event.tags?.join("; ") || "",
    attention_level: event.severity || "neutral",
  }));

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
  if (reportType === "incident_timeline") return timelineRows;
  if (reportType === "child_support_payment") return childSupportRows;
  if (reportType === "expense_reimbursement") return expenseRows;

  return [
    ...custodyScheduleRows.map((row) => ({ section: "custody_schedule", ...row })),
    ...exchangeRows.map((row) => ({ section: "exchange", ...row })),
    ...timelineRows.map((row) => ({ section: "timeline", ...row })),
    ...childSupportRows.map((row) => ({ section: "child_support", ...row })),
    ...expenseRows.map((row) => ({ section: "expense", ...row })),
  ];
}

export function buildReportPreview(
  dataset: RecordsDataset,
  userId: string,
  caseId: string,
  range: DateRange,
  reportType: ReportType
) {
  const matter = dataset.matters.find((item) => item.id === caseId && item.userId === userId);
  const rules = dataset.exchangeRules.filter((item) => item.caseId === caseId && item.userId === userId);
  const expected = generateExpectedExchangeEvents(rules, range);
  const exchangeLogs = dataset.exchangeLogs.filter((item) => item.caseId === caseId && item.userId === userId);
  const payments = dataset.childSupportPayments.filter((item) => item.caseId === caseId && item.userId === userId);
  const expenses = dataset.expenseItems.filter((item) => item.caseId === caseId && item.userId === userId);
  const evidence = dataset.evidenceItems.filter((item) => item.caseId === caseId && item.userId === userId);

  const exchangeStats = calculateExchangeStats(exchangeLogs, expected, range);
  const supportStats = calculateChildSupportStats(payments, range);
  const expenseStats = calculateExpenseStats(expenses, range);
  const rows = buildReportRows(dataset, userId, caseId, range, reportType);

  return {
    title: reportTypeLabels[reportType],
    caseName: matter?.caseName || "Selected custody matter",
    generatedAt: new Date().toISOString(),
    disclaimer:
      "This tool helps organize records and does not provide legal advice. Consult a qualified attorney about your situation.",
    summaries: [
      buildNeutralExchangeSummary(
        range,
        exchangeStats.scheduledCount,
        exchangeStats.lateCount,
        exchangeStats.averageLatenessMinutes,
        exchangeStats.missedCount
      ),
      buildNeutralChildSupportSummary(range, supportStats),
      `Based on records entered in this app, expenses in this range total ${expenseStats.totalExpenses.toFixed(
        2
      )}. Unpaid reimbursement based on user-entered records is ${expenseStats.unpaidReimbursement.toFixed(2)}.`,
    ],
    rows,
    evidenceIndex: buildEvidenceIndex(evidence, range),
  };
}
