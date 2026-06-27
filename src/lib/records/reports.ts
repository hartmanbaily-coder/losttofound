import {
  buildCalendarEvents,
  buildEvidenceIndex,
  buildNeutralChildSupportSummary,
  buildNeutralExchangeSummary,
  calculateChildSupportStats,
  calculateExchangeStats,
  calculateExpenseStats,
  generateExpectedExchangeEvents,
  getIsoDateFromDateTime,
  isWithinDateRange,
  labelEventType,
  labelExchangeStatus,
  labelPaymentStatus,
} from "./calculations";
import type { DateRange, RecordsDataset, ReportType } from "./types";

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
