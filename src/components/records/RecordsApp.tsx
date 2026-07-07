"use client";

import type { FormEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  buildDashboardTimelineStats,
  buildCalendarEvents,
  buildCustodyDayMap,
  calculateChildSupportStats,
  calculateExpenseStats,
  childSupportChartRows,
  daysBetween,
  exchangeChartRows,
  formatMoney,
  generateExpectedExchangeEvents,
  getIsoDateFromDateTime,
  isLateExchangeTimelineEvent,
  isMissedExchangeTimelineEvent,
  isNoFaceTimeTimelineEvent,
  isPostCallFaceTimeNotice,
  isTimelineVisibleEvent,
  labelEventType,
  labelExchangeStatus,
  labelNoteCategory,
  labelPaymentStatus,
} from "@/lib/records/calculations";
import {
  acceptRecordsRecoverySession,
  clearFailedLoginAttempts,
  clearSession,
  createId,
  downloadTextFile,
  nowIso,
  parseTags,
  readRecordsSession,
  readSession,
  requestRecordsPasswordReset,
  signInRecordsSession,
  signUpRecordsAccount,
  signOutRecordsSession,
  updateRecordsPassword,
  useRecordsStore,
  useSelectedRecords,
  verifyRecordsMfa,
  verifyRecordsMfaEnrollment,
  withAudit,
  writeSession,
  type RecordsMfaEnrollment,
  type RecordsSession,
} from "@/lib/records/clientStore";
import {
  buildReportPreview,
  buildSectionExportPacket,
  reportPreviewToCsv,
  reportsTabReportTypes,
  rowsToCsv,
  sectionExportToCsv,
  type SectionExportPacket,
} from "@/lib/records/reports";
import {
  buildDateRangePreset,
  buildMonthDays,
  currentMonthKey,
  defaultRecordsTimezone,
  formatLocalDate,
  formatMonthLabel,
  getMonthBounds,
  monthKeyFromDate,
  shiftMonthKey,
  type DateRangePreset,
} from "@/lib/records/dateRanges";
import { demoCaseId, demoUserId } from "@/lib/records/seed";
import type {
  CalendarEvent,
  CustodyDayAssignment,
  DateRange,
  EvidenceItem,
  ExchangeDirection,
  ExchangeStatus,
  NoteCategory,
  PaymentStatus,
  RecordsDataset,
  ReportType,
} from "@/lib/records/types";
import {
  buildStoredEvidenceName,
  childSupportOrderSchema,
  childSupportPaymentSchema,
  custodyMatterSchema,
  custodyDayAssignmentSchema,
  custodyDayColors,
  dateNoteSchema,
  exchangeLogSchema,
  exchangeRuleSchema,
  expenseItemSchema,
  timezoneSchema,
  validateEvidenceFile,
} from "@/lib/records/validation";
import {
  ExchangeTimingChart,
  ExpenseCategoryChart,
  ReportPreviewChartCard,
  SupportTrendLine,
} from "./RecordsCharts";

const disclaimer =
  "This tool helps organize records and does not provide legal advice. Consult a qualified attorney about your situation.";

const navItems = [
  "Dashboard",
  "Calendar",
  "Import",
  "Timeline",
  "Exchanges",
  "Notes",
  "Files",
  "Child Support",
  "Expenses",
  "Reports",
  "Settings",
] as const;

type ActiveView = (typeof navItems)[number];

const recordsTimezoneOptions = [
  "America/Anchorage",
  "America/Adak",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "Pacific/Honolulu",
  "UTC",
];
type Session = RecordsSession;
type SectionExportFormat = "pdf" | "csv" | "json";
type LoginFlowResult =
  | { status: "complete" }
  | { status: "mfa_required" }
  | { status: "mfa_enrollment_required"; enrollment: RecordsMfaEnrollment };
type LoginScreenMode = "login" | "signup" | "reset" | "update_password";

const defaultRangePreset: DateRangePreset = "currentMonth";

const exchangeStatuses: ExchangeStatus[] = [
  "completed_on_time",
  "completed_late",
  "completed_early",
  "missed",
  "refused",
  "modified_by_agreement",
  "canceled",
  "other",
];

const paymentStatuses: PaymentStatus[] = [
  "paid",
  "partial",
  "unpaid",
  "late",
  "disputed",
  "waived_by_agreement",
  "unknown",
];

type TimelineFilter = "all" | "attention" | CalendarEvent["type"];
type EvidenceReviewStatus = NonNullable<EvidenceItem["reviewStatus"]>;
type ParentingSchedulePresetId =
  | "three_four_four_three_flip"
  | "week_on_week_off"
  | "two_two_three"
  | "two_two_five_five"
  | "three_three_four_four"
  | "weekday_alternating_weekend";
type ScheduleParentKey = "you" | "other";

const parentingSchedulePresets: Array<{
  id: ParentingSchedulePresetId;
  label: string;
  description: string;
}> = [
  {
    id: "three_four_four_three_flip",
    label: "3/4/4/3 with 8-week flip",
    description:
      "Alternates 4-3 then 3-4 blocks for eight weeks, then swaps which parent starts the four-day block.",
  },
  {
    id: "week_on_week_off",
    label: "Week on / week off",
    description:
      "Seven days with one parent, then seven days with the other parent.",
  },
  {
    id: "two_two_three",
    label: "2-2-3",
    description:
      "Two days, two days, then a three-day weekend, flipping the long weekend each week.",
  },
  {
    id: "two_two_five_five",
    label: "2-2-5-5",
    description:
      "Two fixed weekdays with each parent, then alternating five-day stretches.",
  },
  {
    id: "three_three_four_four",
    label: "3-3-4-4",
    description:
      "Three days with each parent, then four days with each parent.",
  },
  {
    id: "weekday_alternating_weekend",
    label: "Weekdays + alternating weekend",
    description:
      "Primary weekday pattern with the other parent receiving every other weekend.",
  },
];

const timelineFilterOptions: Array<{ value: TimelineFilter; label: string }> = [
  { value: "all", label: "All records" },
  { value: "attention", label: "Needs review" },
  { value: "scheduled_exchange", label: "Scheduled exchanges" },
  { value: "logged_exchange", label: "Logged exchanges" },
  { value: "custody_note", label: "Notes" },
  { value: "evidence_item", label: "Files" },
  { value: "child_support_due", label: "Support due" },
  { value: "child_support_paid", label: "Support paid" },
  { value: "expense_item", label: "Expenses" },
];

const directTimelineDeleteTypes = new Set<CalendarEvent["type"]>([
  "logged_exchange",
  "custody_note",
  "child_support_due",
  "child_support_paid",
  "expense_item",
]);

const exportReviewItems = [
  {
    key: "neutralLabels",
    label: "Names, file titles, and labels use privacy-friendly wording.",
  },
  {
    key: "paymentRefs",
    label: "Payment references do not include full bank, card, or account numbers.",
  },
  {
    key: "notes",
    label: "Notes are factual and do not include unnecessary third-party details.",
  },
] as const;

type ExportReviewKey = (typeof exportReviewItems)[number]["key"];

const evidenceReviewStatusLabels: Record<EvidenceReviewStatus, string> = {
  needs_review: "Needs review",
  reviewed: "Reviewed",
  submitted: "Submitted",
  rejected: "Rejected",
};

type ImportDraftKind = "note" | "exchange" | "custody_day" | "file";
type ImportDraftConfidence = "high" | "medium" | "low";

type ImportDraft = {
  id: string;
  kind: ImportDraftKind;
  date: string;
  time?: string;
  title: string;
  body: string;
  category: NoteCategory;
  tags: string[];
  includeInReports: boolean;
  confidence: ImportDraftConfidence;
  sourceLabel: string;
  selected: boolean;
  orderedTime?: string;
  actualTime?: string;
  direction?: ExchangeDirection;
  status?: ExchangeStatus;
  caregiverLabel?: string;
  color?: string;
  file?: File;
  fileType?: string;
  fileSize?: number;
};

const importDraftKindLabels: Record<ImportDraftKind, string> = {
  note: "Note",
  exchange: "Exchange",
  custody_day: "Calendar day",
  file: "File",
};

type AiImportKind = "message_archive" | "pasted_notes" | "custody_calendar";
type AiImportDraftPayload = {
  kind: Exclude<ImportDraftKind, "file">;
  date: string;
  time: string | null;
  title: string;
  body: string;
  category: NoteCategory;
  tags: string[];
  includeInReports: boolean;
  confidence: ImportDraftConfidence;
  orderedTime: string | null;
  actualTime: string | null;
  direction: ExchangeDirection | null;
  status: ExchangeStatus | null;
  caregiverLabel: string | null;
  color: string | null;
  sourceQuote: string;
  reviewReason: string;
};

export default function RecordsApp() {
  const { dataset, hydrated, updateDataset, resetDemoData, reloadDataset, storageStatus, recordsStorageMode } =
    useRecordsStore();
  const [session, setSession] = useState<Session | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("Dashboard");
  const [selectedCaseId, setSelectedCaseId] = useState(demoCaseId);
  const [range, setRange] = useState<DateRange>(() =>
    buildDateRangePreset(defaultRangePreset, new Date(), defaultRecordsTimezone)
  );
  const [calendarMonthKey, setCalendarMonthKey] = useState(() =>
    currentMonthKey(new Date(), defaultRecordsTimezone)
  );
  const [calendarMode, setCalendarMode] = useState<"month" | "list" | "timeline">("month");
  const [selectedDay, setSelectedDay] = useState(() => formatLocalDate(new Date(), defaultRecordsTimezone));
  const [reportType, setReportType] = useState<ReportType>("exchange_compliance");
  const [toast, setToast] = useState("");
  const toastTimeoutRef = useRef<number | null>(null);

  const userId = session?.userId || demoUserId;
  const selected = useSelectedRecords(dataset, userId, selectedCaseId);
  const selectedCase = selected.matter || selected.matters[0];
  const effectiveCaseId = selectedCase?.id || selectedCaseId;
  const selectedProfile = dataset.users.find((user) => user.userId === userId);
  const caseTimezone = selectedCase?.timezone || selectedProfile?.timezone || defaultRecordsTimezone;

  const getCaseTimezone = useCallback((caseId: string, ownerId = userId) => {
    const matter = dataset.matters.find((item) => item.userId === ownerId && item.id === caseId);
    const profile = dataset.users.find((item) => item.userId === ownerId);
    return matter?.timezone || profile?.timezone || defaultRecordsTimezone;
  }, [dataset.matters, dataset.users, userId]);

  const selectCase = useCallback((caseId: string) => {
    const nextTimezone = getCaseTimezone(caseId);
    setSelectedCaseId(caseId);
    setCalendarMonthKey(currentMonthKey(new Date(), nextTimezone));
    setSelectedDay(formatLocalDate(new Date(), nextTimezone));
  }, [getCaseTimezone]);

  const openView = useCallback((view: ActiveView) => {
    setActiveView(view);
    if (view === "Calendar") {
      setCalendarMonthKey(currentMonthKey(new Date(), caseTimezone));
      setSelectedDay(formatLocalDate(new Date(), caseTimezone));
    }
  }, [caseTimezone]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      async function loadSession() {
        const stored =
          recordsStorageMode === "supabase" ? await readRecordsSession().catch(() => null) : readSession();
        if (stored) {
          setSession(stored);
          setSelectedCaseId(stored.caseId);
          setSelectedDay(formatLocalDate(new Date(), defaultRecordsTimezone));
        }
      }

      void loadSession();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [recordsStorageMode]);

  useEffect(
    () => () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    },
    []
  );

  const expectedExchanges = useMemo(
    () => generateExpectedExchangeEvents(selected.exchangeRules, range),
    [selected.exchangeRules, range]
  );
  const supportStats = useMemo(
    () => calculateChildSupportStats(selected.childSupportPayments, range),
    [selected.childSupportPayments, range]
  );
  const expenseStats = useMemo(
    () => calculateExpenseStats(selected.expenseItems, range),
    [selected.expenseItems, range]
  );
  const calendarEvents = useMemo(
    () => buildCalendarEvents(dataset, userId, effectiveCaseId, range),
    [dataset, userId, effectiveCaseId, range]
  );
  const calendarViewRange = useMemo(
    () => getMonthBounds(calendarMonthKey, caseTimezone),
    [calendarMonthKey, caseTimezone]
  );
  const calendarViewEvents = useMemo(
    () => buildCalendarEvents(dataset, userId, effectiveCaseId, calendarViewRange).filter(isTimelineVisibleEvent),
    [dataset, userId, effectiveCaseId, calendarViewRange]
  );
  const timelineEvents = useMemo(
    () => calendarEvents.filter(isTimelineVisibleEvent),
    [calendarEvents]
  );
  const supportRows = useMemo(
    () => childSupportChartRows(selected.childSupportPayments, range),
    [selected.childSupportPayments, range]
  );
  const reportPreview = useMemo(
    () => buildReportPreview(dataset, userId, effectiveCaseId, range, reportType),
    [dataset, userId, effectiveCaseId, range, reportType]
  );
  const sectionExportPackets = useMemo(
    () => ({
      calendar: buildSectionExportPacket(dataset, userId, effectiveCaseId, calendarViewRange, "calendar"),
      timeline: buildSectionExportPacket(dataset, userId, effectiveCaseId, range, "timeline"),
      exchanges: buildSectionExportPacket(dataset, userId, effectiveCaseId, range, "exchanges"),
      notes: buildSectionExportPacket(dataset, userId, effectiveCaseId, range, "notes"),
      evidence: buildSectionExportPacket(dataset, userId, effectiveCaseId, range, "evidence"),
      childSupport: buildSectionExportPacket(dataset, userId, effectiveCaseId, range, "child_support"),
      expenses: buildSectionExportPacket(dataset, userId, effectiveCaseId, range, "expenses"),
    }),
    [dataset, userId, effectiveCaseId, range, calendarViewRange]
  );

  function flash(message: string) {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast(message);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast("");
      toastTimeoutRef.current = null;
    }, 2800);
  }

  function exportSectionPacket(packet: SectionExportPacket, format: SectionExportFormat) {
    const slug = `${packet.id}-${packet.range.from}-${packet.range.to}`;

    if (format === "json") {
      downloadTextFile(
        `lost-to-found-${slug}.json`,
        JSON.stringify(packet, null, 2),
        "application/json"
      );
    } else if (format === "csv") {
      downloadTextFile(`lost-to-found-${slug}.csv`, sectionExportToCsv(packet), "text/csv");
    } else {
      const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1000,height=760");
      if (!printWindow) {
        flash("Popup blocked. Allow popups to print the section packet.");
        return;
      }

      printWindow.document.write(buildSectionExportPrintHtml(packet));
      printWindow.document.close();
    }

    updateDataset((current) =>
      withAudit(current, {
        userId,
        caseId: effectiveCaseId,
        action: "exported",
        entityType: "sectionExport",
        entityId: `${packet.id}-${format}`,
        metadataSummary: `${packet.title} ${format.toUpperCase()} exported without raw row contents in audit metadata.`,
      })
    );
    flash(`${packet.title} ${format.toUpperCase()} export ready.`);
  }

  async function finishAuthenticatedSession(nextSession: Session) {
    setSession(nextSession);
    clearFailedLoginAttempts();
    setSelectedCaseId(nextSession.caseId);

    if (recordsStorageMode === "supabase") {
      await reloadDataset();
    } else {
      updateDataset((current) =>
        withAudit(current, {
          userId: nextSession.userId,
          caseId: nextSession.caseId,
          action: "login",
          entityType: "session",
          entityId: "local-demo-session",
          metadataSummary: "Demo login recorded without custody details.",
        })
      );
    }

    return { status: "complete" as const };
  }

  async function login(email: string, password: string, adultConfirmed: boolean): Promise<LoginFlowResult> {
    if (recordsStorageMode === "supabase") {
      const result = await signInRecordsSession(email, password, adultConfirmed);
      if (result.status === "mfa_required") return { status: "mfa_required" };
      if (result.status === "mfa_enrollment_required") {
        return { status: "mfa_enrollment_required", enrollment: result.enrollment };
      }
      return finishAuthenticatedSession(result.session);
    }

    return finishAuthenticatedSession(writeSession(email));
  }

  function logout() {
    void signOutRecordsSession();
    clearSession();
    setSession(null);
  }

  if (!hydrated || !session) {
    return (
      <LoginScreen
        appReady={hydrated}
        onLogin={login}
        onMfaVerified={finishAuthenticatedSession}
        recordsStorageMode={recordsStorageMode}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
          <div className="flex flex-col p-4 lg:sticky lg:top-0 lg:h-screen">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
                L2F
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight text-slate-950">
                  Lost to Found Records
                </p>
                <p className="text-xs text-slate-500">losttofound.org</p>
              </div>
            </div>

            <nav className="mt-5 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => openView(item)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                    activeView === item
                      ? "bg-teal-700 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <span>{item}</span>
                  {item === "Files" && (
                    <span className="rounded bg-white/20 px-1.5 text-[11px]">
                      {selected.evidenceItems.length}
                    </span>
                  )}
                  {item === "Timeline" && (
                    <span className="rounded bg-white/20 px-1.5 text-[11px]">
                      {timelineEvents.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950 lg:mt-auto">
              Records are private by default. Use labels such as Child 1 and Parent B instead of real names.
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur lg:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                  Private documentation workspace
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {activeView}
                </h1>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <select
                  value={selectedCaseId}
                  onChange={(event) => selectCase(event.target.value)}
                  className="h-10 min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                >
                  {selected.matters.map((matter) => (
                    <option key={matter.id} value={matter.id}>
                      {matter.caseName}
                    </option>
                  ))}
                </select>
                <RangeToolbar range={range} setRange={setRange} timezone={caseTimezone} />
                <button
                  type="button"
                  onClick={() => openView("Reports")}
                  className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Export
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-teal-500"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          <div className="space-y-5 px-4 py-5 lg:px-6">
            <Disclaimer />
            {toast && (
              <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-900">
                {toast}
              </div>
            )}
            {activeView === "Dashboard" && (
              <DashboardView
                range={range}
                calendarEvents={timelineEvents}
                evidenceCount={selected.evidenceItems.length}
              />
            )}
            {activeView === "Calendar" && (
              <CalendarView
                events={calendarViewEvents}
                custodyDayAssignments={selected.custodyDayAssignments}
                updateDataset={updateDataset}
                userId={userId}
                caseId={effectiveCaseId}
                mode={calendarMode}
                setMode={setCalendarMode}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                calendarMonthKey={calendarMonthKey}
                setCalendarMonthKey={setCalendarMonthKey}
                timezone={caseTimezone}
                sectionExport={sectionExportPackets.calendar}
                onExportSection={exportSectionPacket}
                flash={flash}
              />
            )}
            {activeView === "Import" && (
              <ImportView
                updateDataset={updateDataset}
                userId={userId}
                caseId={effectiveCaseId}
                timezone={caseTimezone}
                recordsStorageMode={recordsStorageMode}
                flash={flash}
              />
            )}
            {activeView === "Timeline" && (
              <TimelineView
                events={timelineEvents}
                range={range}
                updateDataset={updateDataset}
                userId={userId}
                caseId={effectiveCaseId}
                sectionExport={sectionExportPackets.timeline}
                onExportSection={exportSectionPacket}
                flash={flash}
              />
            )}
            {activeView === "Exchanges" && (
              <ExchangesView
                updateDataset={updateDataset}
                userId={userId}
                caseId={effectiveCaseId}
                selected={selected}
                range={range}
                expectedExchanges={expectedExchanges}
                sectionExport={sectionExportPackets.exchanges}
                onExportSection={exportSectionPacket}
                flash={flash}
              />
            )}
            {activeView === "Notes" && (
              <NotesView
                updateDataset={updateDataset}
                userId={userId}
                caseId={effectiveCaseId}
                notes={selected.dateNotes}
                sectionExport={sectionExportPackets.notes}
                onExportSection={exportSectionPacket}
                flash={flash}
              />
            )}
            {activeView === "Files" && (
              <EvidenceView
                updateDataset={updateDataset}
                userId={userId}
                caseId={effectiveCaseId}
                timezone={caseTimezone}
                evidence={selected.evidenceItems}
                recordsStorageMode={recordsStorageMode}
                sectionExport={sectionExportPackets.evidence}
                onExportSection={exportSectionPacket}
                flash={flash}
              />
            )}
            {activeView === "Child Support" && (
              <ChildSupportView
                updateDataset={updateDataset}
                userId={userId}
                caseId={effectiveCaseId}
                orders={selected.childSupportOrders}
                payments={selected.childSupportPayments}
                supportRows={supportRows}
                supportStats={supportStats}
                sectionExport={sectionExportPackets.childSupport}
                onExportSection={exportSectionPacket}
                flash={flash}
              />
            )}
            {activeView === "Expenses" && (
              <ExpensesView
                updateDataset={updateDataset}
                userId={userId}
                caseId={effectiveCaseId}
                expenses={selected.expenseItems}
                expenseStats={expenseStats}
                sectionExport={sectionExportPackets.expenses}
                onExportSection={exportSectionPacket}
                flash={flash}
              />
            )}
            {activeView === "Reports" && (
              <ReportsView
                reportType={reportType}
                setReportType={setReportType}
                preview={reportPreview}
                userId={userId}
                caseId={effectiveCaseId}
                range={range}
                flash={flash}
                updateDataset={updateDataset}
              />
            )}
            {activeView === "Settings" && (
              <SettingsView
                dataset={dataset}
                updateDataset={updateDataset}
                resetDemoData={resetDemoData}
                selected={selected}
                userId={userId}
                caseId={effectiveCaseId}
                setSelectedCaseId={selectCase}
                logout={logout}
                flash={flash}
                storageStatus={storageStatus}
                recordsStorageMode={recordsStorageMode}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function LoginScreen({
  appReady,
  onLogin,
  onMfaVerified,
  recordsStorageMode,
}: {
  appReady: boolean;
  onLogin: (email: string, password: string, adultConfirmed: boolean) => Promise<LoginFlowResult>;
  onMfaVerified: (session: Session) => Promise<LoginFlowResult>;
  recordsStorageMode: "local" | "supabase";
}) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<LoginScreenMode>(() => {
    if (typeof window === "undefined") return "login";
    return new URLSearchParams(window.location.search).get("auth") === "recovery"
      ? "update_password"
      : "login";
  });
  const [submitting, setSubmitting] = useState(false);
  const [mfaMode, setMfaMode] = useState<"verify" | "enroll" | null>(null);
  const [mfaEnrollment, setMfaEnrollment] = useState<RecordsMfaEnrollment | null>(null);
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [recoveryHydrating, setRecoveryHydrating] = useState(false);
  const recoveryHandledRef = useRef(false);
  const minimumPasswordLength = 12;
  const signupsEnabled =
    recordsStorageMode === "supabase" && process.env.NEXT_PUBLIC_RECORDS_SIGNUPS_ENABLED === "true";

  useEffect(() => {
    if (recordsStorageMode !== "supabase" || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const authState = params.get("auth");
    if (authState === "recovery") {
      setMode("update_password");
      setMessage("Choose a new password to finish account recovery.");
    } else if (authState === "confirmed") {
      setMessage("Email confirmed. Sign in to continue.");
    } else if (authState === "confirm-error") {
      setError("Confirmation link is invalid or expired.");
    }

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const expiresIn = hash.get("expires_in");

    if (!accessToken || !refreshToken || recoveryHandledRef.current) return;
    recoveryHandledRef.current = true;
    setMode("update_password");
    setRecoveryHydrating(true);
    setError("");
    setMessage("Preparing password recovery.");

    void acceptRecordsRecoverySession({ accessToken, refreshToken, expiresIn })
      .then(() => {
        window.history.replaceState(null, "", "/records?auth=recovery");
        setMessage("Choose a new password to finish account recovery.");
      })
      .catch((recoveryError: unknown) => {
        window.history.replaceState(null, "", "/records?auth=confirm-error");
        setError(recoveryError instanceof Error ? recoveryError.message : "Recovery link is invalid or expired.");
      })
      .finally(() => setRecoveryHydrating(false));
  }, [recordsStorageMode]);

  function qrCodeSrc(qrCode: string) {
    if (qrCode.startsWith("data:image/")) return qrCode;
    return `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`;
  }

  function switchMode(nextMode: LoginScreenMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
    setMfaMode(null);
    setMfaEnrollment(null);
  }

  async function onLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appReady) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const adultConfirmed = formData.get("adult") === "on";

    if (!adultConfirmed || !email.includes("@") || !password) {
      setError("Enter your email, password, and confirm adult use.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const result = await onLogin(email, password, adultConfirmed);
      if (result.status === "mfa_required") {
        setMfaMode("verify");
        setMfaEnrollment(null);
      }
      if (result.status === "mfa_enrollment_required") {
        setMfaMode("enroll");
        setMfaEnrollment(result.enrollment);
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    const adultConfirmed = formData.get("adult") === "on";

    if (!adultConfirmed || !email.includes("@") || password.length < minimumPasswordLength) {
      setError(`Enter an email, confirm adult use, and use at least ${minimumPasswordLength} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const result = await signUpRecordsAccount(email, password, adultConfirmed);
      setMessage(result.message);
      setMode("login");
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : "Account creation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const adultConfirmed = formData.get("adult") === "on";

    if (!adultConfirmed || !email.includes("@")) {
      setError("Enter your email and confirm adult use.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const result = await requestRecordsPasswordReset(email, adultConfirmed);
      setMessage(result.message);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Password reset failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onPasswordUpdateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (password.length < minimumPasswordLength) {
      setError(`Use at least ${minimumPasswordLength} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const result = await updateRecordsPassword(password);
      window.history.replaceState(null, "", "/records");
      clearSession();
      setMessage(result.message);
      setMode("login");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Password update failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const code = String(formData.get("code") || "").trim();
    setMfaSubmitting(true);
    setError("");

    try {
      const session =
        mfaMode === "enroll"
          ? await verifyRecordsMfaEnrollment({
              factorId: mfaEnrollment?.factorId || "",
              code,
            })
          : await verifyRecordsMfa(code);
      await onMfaVerified(session);
    } catch (mfaError) {
      setError(mfaError instanceof Error ? mfaError.message : "Authenticator code was not accepted.");
    } finally {
      setMfaSubmitting(false);
    }
  }

  const heading = mfaMode
    ? mfaMode === "enroll"
      ? "Set up authenticator"
      : "Verify authenticator"
    : mode === "signup"
      ? "Create account"
      : mode === "reset"
        ? "Reset password"
        : mode === "update_password"
          ? "Choose new password"
          : recordsStorageMode === "supabase"
            ? "Secure sign in"
            : "Local demo access";

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10 text-slate-950">
      <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[1fr_420px]">
          <section className="space-y-6 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
                L2F
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Lost to Found Records</h1>
                <p className="text-sm text-slate-500">Privacy-first custody records workspace</p>
              </div>
            </div>

            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Sign in to organize court-ordered exchange expectations, recorded exchange
              outcomes, child support payment records, expenses, date-based notes, file
              attachments, and neutral report exports.
            </p>

            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              {disclaimer}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatMini label="Adult users" value="Only" />
              <StatMini label="Stored records" value="Private" />
              <StatMini label="Public sharing" value="Off" />
            </div>
          </section>

          <section className="border-t border-slate-200 bg-slate-50 p-6 sm:p-8 lg:border-l lg:border-t-0">
            <h2 className="text-lg font-semibold">{heading}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Supabase mode signs in through server-managed HttpOnly cookies and requires
              authenticator verification. Local mode is limited to development demo data.
            </p>

            {message && (
              <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-900">
                {message}
              </div>
            )}

            {mfaMode ? (
              <form method="post" onSubmit={onMfaSubmit} className="mt-5 space-y-4">
                {mfaMode === "enroll" && mfaEnrollment && (
                  <div className="rounded-md border border-slate-200 bg-white p-4">
                    {/* Supabase returns this as a data URL; a plain img avoids Next image SVG/data URL rewriting. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt="Authenticator QR code"
                      className="mx-auto size-44"
                      height={176}
                      src={qrCodeSrc(mfaEnrollment.qrCode)}
                      width={176}
                    />
                    <Field label="Setup key">
                      <input className="input font-mono text-xs" value={mfaEnrollment.secret} readOnly />
                    </Field>
                  </div>
                )}
                <Field label="Authenticator code">
                  <input
                    name="code"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="input"
                    autoComplete="one-time-code"
                  />
                </Field>
                {error && <p className="text-sm font-medium text-red-700">{error}</p>}
                <button
                  type="submit"
                  disabled={mfaSubmitting}
                  className="h-10 w-full rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  {mfaSubmitting ? "Verifying..." : "Verify authenticator"}
                </button>
                <p className="text-xs leading-5 text-slate-500">
                  Lost authenticator access? Use the security contact for manual account recovery.
                </p>
              </form>
            ) : mode === "reset" ? (
              <form method="post" onSubmit={onResetSubmit} className="mt-5 space-y-4">
                <Field label="Email">
                  <input name="email" type="email" className="input" autoComplete="email" />
                </Field>
                <label className="flex items-start gap-2 text-sm leading-5 text-slate-700">
                  <input name="adult" type="checkbox" defaultChecked className="mt-1" />
                  <span>I am an adult user requesting access to my own records account.</span>
                </label>
                {error && <p className="text-sm font-medium text-red-700">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 w-full rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  {submitting ? "Sending..." : "Send reset link"}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-teal-500"
                >
                  Back to sign in
                </button>
              </form>
            ) : mode === "signup" ? (
              <form method="post" onSubmit={onSignupSubmit} className="mt-5 space-y-4">
                <Field label="Email">
                  <input name="email" type="email" className="input" autoComplete="email" />
                </Field>
                <Field label="Password">
                  <input name="password" type="password" className="input" autoComplete="new-password" />
                </Field>
                <Field label="Confirm password">
                  <input
                    name="confirmPassword"
                    type="password"
                    className="input"
                    autoComplete="new-password"
                  />
                </Field>
                <label className="flex items-start gap-2 text-sm leading-5 text-slate-700">
                  <input name="adult" type="checkbox" defaultChecked className="mt-1" />
                  <span>
                    I am an adult user and will use privacy-friendly labels for sensitive records.
                  </span>
                </label>
                {error && <p className="text-sm font-medium text-red-700">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 w-full rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  {submitting ? "Creating..." : "Create account"}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-teal-500"
                >
                  Back to sign in
                </button>
              </form>
            ) : mode === "update_password" ? (
              <form method="post" onSubmit={onPasswordUpdateSubmit} className="mt-5 space-y-4">
                <Field label="New password">
                  <input
                    name="password"
                    type="password"
                    className="input"
                    autoComplete="new-password"
                    disabled={recoveryHydrating}
                  />
                </Field>
                <Field label="Confirm new password">
                  <input
                    name="confirmPassword"
                    type="password"
                    className="input"
                    autoComplete="new-password"
                    disabled={recoveryHydrating}
                  />
                </Field>
                {error && <p className="text-sm font-medium text-red-700">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting || recoveryHydrating}
                  className="h-10 w-full rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  {recoveryHydrating ? "Preparing..." : submitting ? "Saving..." : "Update password"}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-teal-500"
                >
                  Back to sign in
                </button>
              </form>
            ) : (
              <form method="post" onSubmit={onLoginSubmit} className="mt-5 space-y-4">
                <Field label="Email">
                  <input
                    name="email"
                    type="email"
                    defaultValue={recordsStorageMode === "local" ? "parent-a@example.test" : ""}
                    className="input"
                    autoComplete="email"
                  />
                </Field>
                <Field label="Password">
                  <input
                    name="password"
                    type="password"
                    defaultValue={recordsStorageMode === "local" ? "demo-password" : ""}
                    className="input"
                    autoComplete="current-password"
                  />
                </Field>
                <label className="flex items-start gap-2 text-sm leading-5 text-slate-700">
                  <input name="adult" type="checkbox" defaultChecked className="mt-1" />
                  <span>
                    I am an adult user and will use privacy-friendly labels for sensitive records.
                  </span>
                </label>
                {error && <p className="text-sm font-medium text-red-700">{error}</p>}
                <button
                  type="submit"
                  disabled={!appReady || submitting}
                  className="h-10 w-full rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  {!appReady ? "Loading workspace..." : submitting ? "Signing in..." : "Enter records workspace"}
                </button>
                {recordsStorageMode === "supabase" && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => switchMode("reset")}
                      className="font-semibold text-teal-700 hover:text-teal-900"
                    >
                      Forgot password?
                    </button>
                    {signupsEnabled && (
                      <button
                        type="button"
                        onClick={() => switchMode("signup")}
                        className="font-semibold text-teal-700 hover:text-teal-900"
                      >
                        Create account
                      </button>
                    )}
                  </div>
                )}
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function DashboardView({
  range,
  calendarEvents,
  evidenceCount,
}: {
  range: DateRange;
  calendarEvents: CalendarEvent[];
  evidenceCount: number;
}) {
  const visibleEvents = calendarEvents.filter(isTimelineVisibleEvent);
  const dashboardEvents = visibleEvents.filter(
    (event) =>
      event.type !== "child_support_due" &&
      event.type !== "child_support_paid" &&
      event.type !== "expense_item"
  );
  const stats = buildDashboardTimelineStats(dashboardEvents);
  const focusEvents = dashboardEvents.filter(
    (event) =>
      isLateExchangeTimelineEvent(event) ||
      isMissedExchangeTimelineEvent(event) ||
      isNoFaceTimeTimelineEvent(event) ||
      isPostCallFaceTimeNotice(event) ||
      event.severity === "critical" ||
      event.severity === "attention"
  );
  const sourceCounts = [
    { label: "Late exchanges", value: stats.lateExchangeCount },
    { label: "Missed/refused", value: stats.missedExchangeCount },
    { label: "No FaceTime", value: stats.noFaceTimeCount },
    { label: "Post-call notices", value: stats.postCallNoFaceTimeCount },
    { label: "Attached files", value: stats.evidenceCount },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Timeline records" value={stats.timelineCount} detail={`${range.from} to ${range.to}`} />
        <StatCard label="Late exchanges" value={stats.lateExchangeCount} detail="From visible timeline records" tone="amber" />
        <StatCard label="Missed/refused" value={stats.missedExchangeCount} detail="Exchange issues in timeline" tone="slate" />
        <StatCard label="No FaceTime conducted" value={stats.noFaceTimeCount} detail="FaceTime notes and text archive" tone="amber" />
        <StatCard label="Post-call notices" value={stats.postCallNoFaceTimeCount} detail="Call first, then text response" tone="slate" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Panel title="Dashboard focus" action="Court packet view">
            <div className="grid gap-4">
              <div className="grid gap-2">
                {sourceCounts.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="rounded bg-white px-2 py-1 text-xs font-semibold text-slate-950">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <StatMini label="Needs review" value={String(stats.attentionCount)} />
                <StatMini label="Files in profile" value={String(evidenceCount)} />
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visible sources</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium text-slate-600">
                  {["Exchanges", "FaceTime", "Notes", "Files"].map((source) => (
                    <span key={source} className="rounded bg-white px-2 py-1">
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Case timeline" action={`${dashboardEvents.length} records`}>
          <Timeline events={dashboardEvents} emptyLabel="No timeline records in this date range." />
          {focusEvents.length > 0 && (
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {focusEvents.length} record{focusEvents.length === 1 ? "" : "s"} match the dashboard focus categories.
            </p>
          )}
        </Panel>
      </section>
    </div>
  );
}

function CalendarView({
  events,
  custodyDayAssignments,
  updateDataset,
  userId,
  caseId,
  mode,
  setMode,
  selectedDay,
  setSelectedDay,
  calendarMonthKey,
  setCalendarMonthKey,
  timezone,
  sectionExport,
  onExportSection,
  flash,
}: {
  events: CalendarEvent[];
  custodyDayAssignments: CustodyDayAssignment[];
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  userId: string;
  caseId: string;
  mode: "month" | "list" | "timeline";
  setMode: (mode: "month" | "list" | "timeline") => void;
  selectedDay: string;
  setSelectedDay: (day: string) => void;
  calendarMonthKey: string;
  setCalendarMonthKey: (monthKey: string) => void;
  timezone: string;
  sectionExport: SectionExportPacket;
  onExportSection: (packet: SectionExportPacket, format: SectionExportFormat) => void;
  flash: (message: string) => void;
}) {
  const monthKey = monthKeyFromDate(`${calendarMonthKey}-01`, timezone);
  const monthRange = getMonthBounds(monthKey, timezone);
  const monthDays = buildMonthDays(monthKey);
  const today = formatLocalDate(new Date(), timezone);
  const [paintCaregiverLabel, setPaintCaregiverLabel] = useState("Parent A");
  const [paintColor, setPaintColor] = useState<(typeof custodyDayColors)[number] | string>(
    custodyDayColors[0]
  );
  const [isPainting, setIsPainting] = useState(false);
  const [paintDraftDates, setPaintDraftDates] = useState<Set<string>>(() => new Set());
  const [paintSelectionDates, setPaintSelectionDates] = useState<Set<string>>(() => new Set());
  const paintingRef = useRef(false);
  const paintAnchorDateRef = useRef<string | null>(null);
  const activePaintPointerIdRef = useRef<number | null>(null);
  const paintDraftDatesRef = useRef<Set<string>>(new Set());
  const paintSelectionDatesRef = useRef<Set<string>>(new Set());
  const paintMovedRef = useRef(false);
  const suppressNextCalendarClickRef = useRef(false);
  const visibleEvents = useMemo(() => events.filter(isTimelineVisibleEvent), [events]);
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of visibleEvents) {
    eventsByDate.set(event.date, [...(eventsByDate.get(event.date) || []), event]);
  }
  const custodyDayMap = buildCustodyDayMap(custodyDayAssignments, monthRange);
  const selectedAssignment = custodyDayMap.get(selectedDay);
  const dayEvents = eventsByDate.get(selectedDay) || [];

  function showCalendarMonth(nextMonthKey: string) {
    const nextRange = getMonthBounds(nextMonthKey, timezone);
    setCalendarMonthKey(nextMonthKey);
    setSelectedDay(nextRange.from);
  }

  function showCurrentMonth() {
    const nextMonthKey = currentMonthKey(new Date(), timezone);
    setCalendarMonthKey(nextMonthKey);
    setSelectedDay(formatLocalDate(new Date(), timezone));
  }

  const setPaintDraft = useCallback((dates: Set<string>) => {
    paintDraftDatesRef.current = dates;
    setPaintDraftDates(dates);
  }, []);

  const setPaintSelection = useCallback((dates: Set<string>) => {
    paintSelectionDatesRef.current = dates;
    setPaintSelectionDates(dates);
  }, []);

  const buildPaintDateRange = useCallback((from: string, to: string) => {
    const delta = daysBetween(from, to);
    if (delta === null) return [to];
    const direction = delta >= 0 ? 1 : -1;
    return Array.from({ length: Math.abs(delta) + 1 }, (_, index) =>
      addDays(from, index * direction)
    );
  }, []);

  const applyCustodyDayPaint = useCallback(
    (dates: string[]) => {
      const uniqueDates = Array.from(new Set(dates)).sort();
      if (uniqueDates.length === 0) return;

      const caregiverLabel = paintCaregiverLabel.trim() || "Parent A";
      const parsedPaint = custodyDayAssignmentSchema.safeParse({
        date: uniqueDates[0],
        caregiverLabel,
        color: paintColor,
        startsAt: "00:00",
        endsAt: "23:59",
        exchangeTime: "",
        exchangeDirection: "",
        exchangeLocation: "",
        notes: "",
      });

      if (!parsedPaint.success) {
        flash(parsedPaint.error.issues[0]?.message || "Check the calendar color.");
        return;
      }

      const now = nowIso();
      const targetDates = new Set(uniqueDates);

      updateDataset((current) => {
        const existingByDate = new Map(
          current.custodyDayAssignments
            .filter((item) => item.userId === userId && item.caseId === caseId)
            .map((item) => [item.date, item])
        );
        const paintedAssignments = uniqueDates.map((date) => {
          const existing = existingByDate.get(date);
          return {
            ...existing,
            id: existing?.id || createId("custody-day"),
            caseId,
            userId,
            date,
            caregiverLabel,
            color: parsedPaint.data.color,
            startsAt: existing?.startsAt || "00:00",
            endsAt: existing?.endsAt || "23:59",
            exchangeTime: existing?.exchangeTime,
            exchangeDirection: existing?.exchangeDirection,
            exchangeLocation: existing?.exchangeLocation,
            notes: existing?.notes,
            createdAt: existing?.createdAt || now,
            updatedAt: now,
          } satisfies CustodyDayAssignment;
        });

        const retainedAssignments = current.custodyDayAssignments.filter(
          (item) =>
            item.userId !== userId ||
            item.caseId !== caseId ||
            !targetDates.has(item.date)
        );

        return withAudit(
          {
            ...current,
            custodyDayAssignments: [...paintedAssignments, ...retainedAssignments],
          },
          {
            userId,
            caseId,
            action: "updated",
            entityType: "custodyDayAssignment",
            entityId: uniqueDates.length === 1 ? paintedAssignments[0].id : "calendar-drag-paint",
            metadataSummary:
              uniqueDates.length === 1
                ? "Custody day color assignment painted without child names."
                : `${uniqueDates.length} custody day color assignments painted without child names.`,
          }
        );
      });

      setSelectedDay(uniqueDates[uniqueDates.length - 1]);
      setPaintSelection(new Set());
      flash(uniqueDates.length === 1 ? "Custody day color saved." : `${uniqueDates.length} custody days colored.`);
    },
    [caseId, flash, paintCaregiverLabel, paintColor, setPaintSelection, setSelectedDay, updateDataset, userId]
  );

  const extendPaint = useCallback(
    (day: string) => {
      if (!paintingRef.current) return;
      const anchorDay = paintAnchorDateRef.current || day;
      const nextDates = new Set(buildPaintDateRange(anchorDay, day));
      if (day !== anchorDay) paintMovedRef.current = true;
      const currentDates = paintDraftDatesRef.current;
      if (
        currentDates.size === nextDates.size &&
        Array.from(nextDates).every((date) => currentDates.has(date))
      ) {
        return;
      }
      setSelectedDay(day);
      setPaintDraft(nextDates);
      setPaintSelection(nextDates);
    },
    [buildPaintDateRange, setPaintDraft, setPaintSelection, setSelectedDay]
  );

  const finishPaint = useCallback(
    (event?: globalThis.PointerEvent) => {
      if (!paintingRef.current) return;
      if (
        event &&
        activePaintPointerIdRef.current !== null &&
        event.pointerId !== activePaintPointerIdRef.current
      ) {
        return;
      }

      paintingRef.current = false;
      paintAnchorDateRef.current = null;
      activePaintPointerIdRef.current = null;
      setIsPainting(false);
      const dates = Array.from(paintDraftDatesRef.current);
      suppressNextCalendarClickRef.current = dates.length > 0;
      setPaintDraft(new Set());
      setPaintSelection(new Set(dates));
      if (paintMovedRef.current || dates.length > 1) {
        applyCustodyDayPaint(dates);
      }
      paintMovedRef.current = false;
    },
    [applyCustodyDayPaint, setPaintDraft, setPaintSelection]
  );

  useEffect(() => {
    function handlePointerMove(event: globalThis.PointerEvent) {
      if (!paintingRef.current) return;
      if (
        activePaintPointerIdRef.current !== null &&
        event.pointerId !== activePaintPointerIdRef.current
      ) {
        return;
      }
      event.preventDefault();
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const day = target instanceof Element
        ? target.closest<HTMLElement>("[data-calendar-day]")?.dataset.calendarDay
        : undefined;
      if (day) extendPaint(day);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", finishPaint);
    window.addEventListener("pointercancel", finishPaint);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishPaint);
      window.removeEventListener("pointercancel", finishPaint);
    };
  }, [extendPaint, finishPaint]);

  function beginPaint(day: string, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    suppressNextCalendarClickRef.current = false;
    paintingRef.current = true;
    paintAnchorDateRef.current = day;
    activePaintPointerIdRef.current = event.pointerId;
    paintMovedRef.current = false;
    setIsPainting(true);
    setSelectedDay(day);
    setPaintDraft(new Set([day]));
    setPaintSelection(new Set([day]));
  }

  function handleCalendarDayClick(day: string) {
    if (suppressNextCalendarClickRef.current) {
      suppressNextCalendarClickRef.current = false;
      return;
    }
    setSelectedDay(day);
  }

  function applySelectedPaintDates() {
    const dates = Array.from(paintSelectionDatesRef.current);
    if (dates.length === 0) {
      flash("Select one or more calendar days first.");
      return;
    }
    applyCustodyDayPaint(dates);
  }

  function clearPaintSelection() {
    setPaintDraft(new Set());
    setPaintSelection(new Set());
    paintingRef.current = false;
    paintAnchorDateRef.current = null;
    activePaintPointerIdRef.current = null;
    paintMovedRef.current = false;
    setIsPainting(false);
  }

  function saveCustodyDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = custodyDayAssignmentSchema.safeParse({
      date: text(formData, "date"),
      caregiverLabel: text(formData, "caregiverLabel"),
      color: text(formData, "color"),
      startsAt: text(formData, "startsAt"),
      endsAt: text(formData, "endsAt"),
      exchangeTime: text(formData, "exchangeTime"),
      exchangeDirection: text(formData, "exchangeDirection"),
      exchangeLocation: text(formData, "exchangeLocation"),
      notes: text(formData, "notes"),
    });
    if (!parsed.success) return flash(parsed.error.issues[0]?.message || "Check the custody day form.");

    const date = parsed.data.date;
    updateDataset((current) => {
      const existing = current.custodyDayAssignments.find(
        (item) => item.userId === userId && item.caseId === caseId && item.date === date
      );
      const nextData = emptyToUndefined(parsed.data);
      const nextAssignment: CustodyDayAssignment = {
        id: existing?.id || createId("custody-day"),
        caseId,
        userId,
        createdAt: existing?.createdAt || nowIso(),
        updatedAt: nowIso(),
        date: nextData.date,
        caregiverLabel: nextData.caregiverLabel,
        color: nextData.color,
        startsAt: nextData.startsAt,
        endsAt: nextData.endsAt,
        exchangeTime: nextData.exchangeTime,
        exchangeDirection: nextData.exchangeDirection || undefined,
        exchangeLocation: nextData.exchangeLocation,
        notes: nextData.notes,
      };

      return withAudit(
        {
          ...current,
          custodyDayAssignments: existing
            ? current.custodyDayAssignments.map((item) =>
                item.id === existing.id ? nextAssignment : item
              )
            : [nextAssignment, ...current.custodyDayAssignments],
        },
        {
          userId,
          caseId,
          action: existing ? "updated" : "created",
          entityType: "custodyDayAssignment",
          entityId: nextAssignment.id,
          metadataSummary: "Custody day color assignment saved without child names.",
        }
      );
    });
    setSelectedDay(date);
    flash("Custody day color saved.");
  }

  function clearCustodyDay() {
    if (!selectedAssignment) return;
    updateDataset((current) =>
      withAudit(
        {
          ...current,
          custodyDayAssignments: current.custodyDayAssignments.filter(
            (item) => item.id !== selectedAssignment.id
          ),
        },
        {
          userId,
          caseId,
          action: "deleted",
          entityType: "custodyDayAssignment",
          entityId: selectedAssignment.id,
          metadataSummary: "Custody day color assignment removed.",
        }
      )
    );
    flash("Custody day color cleared.");
  }

  function clearCustodyLabel(caregiverLabel: string) {
    const normalizedLabel = caregiverLabel.trim();
    if (!normalizedLabel) return;

    updateDataset((current) =>
      withAudit(
        {
          ...current,
          custodyDayAssignments: current.custodyDayAssignments.filter(
            (item) =>
              item.userId !== userId ||
              item.caseId !== caseId ||
              item.caregiverLabel !== normalizedLabel
          ),
        },
        {
          userId,
          caseId,
          action: "deleted",
          entityType: "custodyDayAssignment",
          entityId: `calendar-label-${normalizedLabel}`,
          metadataSummary: "Calendar custody label and color assignments removed.",
        }
      )
    );

    flash(`Calendar label "${normalizedLabel}" removed.`);
  }

  function deleteTimelineEvent(event: CalendarEvent) {
    if (!canDeleteTimelineEvent(event)) {
      flash("Delete this generated item from its source tab.");
      return;
    }

    updateDataset((current) => deleteTimelineEventFromDataset(current, event, userId, caseId));
    flash(`${labelEventType(event.type)} deleted from timeline.`);
  }

  return (
    <div className="space-y-4">
      <Segmented
        value={mode}
        options={[
          { value: "month", label: "Month" },
          { value: "list", label: "Weekly/List" },
          { value: "timeline", label: "Timeline" },
        ]}
        onChange={(value) => setMode(value as "month" | "list" | "timeline")}
      />

      {mode === "month" && (
        <section className="grid gap-4 xl:grid-cols-[1fr_400px]">
          <Panel title={`Monthly custody calendar: ${formatMonthLabel(monthKey, timezone)}`} action={`Case timezone: ${timezone}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary h-9 px-3"
                  onClick={() => showCalendarMonth(shiftMonthKey(monthKey, -1, timezone))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-secondary h-9 px-3"
                  onClick={showCurrentMonth}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="btn-secondary h-9 px-3"
                  onClick={() => showCalendarMonth(shiftMonthKey(monthKey, 1, timezone))}
                >
                  Next
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="calendar-month">
                  Month
                </label>
                <input
                  id="calendar-month"
                  aria-label="Calendar month"
                  type="month"
                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
                  value={monthKey}
                  onChange={(event) => showCalendarMonth(event.target.value || currentMonthKey(new Date(), timezone))}
                />
              </div>
            </div>
            <div className="mb-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                <Field label="Caregiver label">
                  <input
                    className="input"
                    value={paintCaregiverLabel}
                    maxLength={60}
                    onChange={(event) => setPaintCaregiverLabel(event.target.value)}
                  />
                </Field>
                <Field label="Active color">
                  <input
                    aria-label="Active calendar color"
                    type="color"
                    value={paintColor}
                    onChange={(event) => setPaintColor(event.target.value)}
                    className="h-10 w-full cursor-pointer rounded-md border border-slate-300 bg-white p-1"
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {custodyDayColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use calendar color ${color}`}
                    aria-pressed={paintColor.toLowerCase() === color.toLowerCase()}
                    onClick={() => setPaintColor(color)}
                    className={`h-9 w-9 rounded-md border-2 transition ${
                      paintColor.toLowerCase() === color.toLowerCase()
                        ? "border-slate-950"
                        : "border-white shadow-sm ring-1 ring-slate-200"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                {paintSelectionDates.size > 0 && (
                  <>
                    <button
                      type="button"
                      className="btn-primary h-9 px-3 text-xs"
                      onClick={applySelectedPaintDates}
                    >
                      Apply {paintSelectionDates.size} day{paintSelectionDates.size === 1 ? "" : "s"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary h-9 px-3 text-xs"
                      onClick={clearPaintSelection}
                    >
                      Clear selection
                    </button>
                  </>
                )}
                {isPainting && (
                  <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">
                    {paintDraftDates.size} day{paintDraftDates.size === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>
            <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              {Array.from(
                new Map(custodyDayAssignments.map((item) => [item.caregiverLabel, item]))
                  .values()
              ).map((assignment) => (
                <span key={assignment.caregiverLabel} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: assignment.color }}
                  />
                  {assignment.caregiverLabel}
                  <button
                    type="button"
                    aria-label={`Delete calendar label ${assignment.caregiverLabel}`}
                    onClick={() => clearCustodyLabel(assignment.caregiverLabel)}
                    className="ml-1 rounded border border-red-200 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-slate-500">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="px-2 py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {monthDays.map((day, index) => {
                const dayEventsForCell = day ? eventsByDate.get(day) || [] : [];
                const recordEventsForCell = dayEventsForCell.filter(
                  (event) => event.type !== "custody_day"
                );
                const assignment = day ? custodyDayMap.get(day) : undefined;
                const isPaintDraft = day ? paintDraftDates.has(day) : false;
                const isToday = day === today;
                const visibleColor = isPaintDraft ? paintColor : assignment?.color;
                const visibleLabel = isPaintDraft
                  ? paintCaregiverLabel.trim() || "Parent A"
                  : assignment?.caregiverLabel;
                return (
                  <button
                    key={day || `blank-${index}`}
                    type="button"
                    disabled={!day}
                    data-calendar-day={day || undefined}
                    aria-label={day ? `Edit calendar day ${day}` : undefined}
                    onPointerDown={(event) => day && beginPaint(day, event)}
                    onPointerEnter={() => day && extendPaint(day)}
                    onPointerMove={() => day && extendPaint(day)}
                    onMouseEnter={() => day && extendPaint(day)}
                    onPointerUp={() => finishPaint()}
                    onClick={() => day && handleCalendarDayClick(day)}
                    style={
                      visibleColor
                        ? {
                            backgroundColor: withAlpha(visibleColor, isPaintDraft ? 0.16 : 0.1),
                            borderColor: visibleColor,
                            touchAction: "none",
                            userSelect: "none",
                          }
                        : {
                            touchAction: "none",
                            userSelect: "none",
                          }
                    }
                    className={`min-h-28 select-none rounded-md border p-2 text-left transition ${
                      day === selectedDay
                        ? "ring-2 ring-teal-500 ring-offset-1"
                        : "border-slate-200 bg-white hover:border-teal-300"
                    } ${isToday ? "shadow-[inset_0_0_0_2px_rgba(15,118,110,0.35)]" : ""} ${day ? "cursor-crosshair" : ""} ${!day ? "bg-transparent hover:border-slate-200" : ""}`}
                  >
                    {day && (
                      <>
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-semibold text-slate-900">{Number(day.slice(-2))}</p>
                          <div className="flex flex-wrap justify-end gap-1">
                            {isToday && (
                              <span className="rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                Today
                              </span>
                            )}
                            {assignment?.exchangeTime && (
                              <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                {assignment.exchangeTime}
                              </span>
                            )}
                          </div>
                        </div>
                        {visibleColor && visibleLabel && (
                          <div
                            className="mt-2 truncate rounded px-2 py-1 text-xs font-semibold text-white"
                            style={{ backgroundColor: visibleColor }}
                          >
                            {visibleLabel}
                          </div>
                        )}
                        <div className="mt-2 space-y-1">
                          {recordEventsForCell
                            .slice(0, 2)
                            .map((event) => (
                            <span
                              key={event.id}
                              className="block truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700"
                            >
                              {event.title}
                            </span>
                          ))}
                          {recordEventsForCell.length > 2 && (
                            <span className="text-[11px] text-slate-500">
                              +{recordEventsForCell.length - 2} more
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel title={`Day detail: ${selectedDay}`} action={`${dayEvents.length} records`}>
              {selectedAssignment && (
                <div className="mb-4 rounded-md border border-slate-200 p-3" style={{ backgroundColor: withAlpha(selectedAssignment.color, 0.08) }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {selectedAssignment.caregiverLabel}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Scheduled parenting-time color for this date
                      </p>
                    </div>
                    <span className="h-6 w-6 rounded-full" style={{ backgroundColor: selectedAssignment.color }} />
                  </div>
                  {selectedAssignment.exchangeTime && (
                    <p className="mt-3 text-sm text-slate-700">
                      Exchange at {selectedAssignment.exchangeTime}
                      {selectedAssignment.exchangeLocation ? ` - ${selectedAssignment.exchangeLocation}` : ""}
                    </p>
                  )}
                </div>
              )}
              <Timeline
                events={dayEvents}
                emptyLabel="No records on this day."
                onDeleteEvent={deleteTimelineEvent}
              />
            </Panel>

            <Panel title="Color selected day" action="Custody schedule">
              <form key={selectedDay} onSubmit={saveCustodyDay} className="grid gap-3">
                <Field label="Date">
                  <input name="date" type="date" className="input" defaultValue={selectedDay} />
                </Field>
                <Field label="Child will be with">
                  <input
                    name="caregiverLabel"
                    className="input"
                    defaultValue={selectedAssignment?.caregiverLabel || "Parent A"}
                    placeholder="Parent A, Parent B, Me, Other Parent"
                  />
                </Field>
                <Field label="Color">
                  <div className="flex flex-wrap gap-2">
                    {custodyDayColors.map((color) => (
                      <label
                        key={color}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                      >
                        <input
                          name="color"
                          type="radio"
                          value={color}
                          defaultChecked={(selectedAssignment?.color || "#0f766e") === color}
                        />
                        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: color }} />
                      </label>
                    ))}
                  </div>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Start">
                    <input name="startsAt" type="time" className="input" defaultValue={selectedAssignment?.startsAt || "00:00"} />
                  </Field>
                  <Field label="End">
                    <input name="endsAt" type="time" className="input" defaultValue={selectedAssignment?.endsAt || "23:59"} />
                  </Field>
                </div>
                <Field label="Exchange time">
                  <input name="exchangeTime" type="time" className="input" defaultValue={selectedAssignment?.exchangeTime || ""} />
                </Field>
                <Field label="Exchange direction">
                  <select name="exchangeDirection" className="input" defaultValue={selectedAssignment?.exchangeDirection || ""}>
                    <option value="">No exchange on this date</option>
                    <option value="other_parent_to_me">Other Parent to Me</option>
                    <option value="me_to_other_parent">Me to Other Parent</option>
                  </select>
                </Field>
                <Field label="Exchange location">
                  <input name="exchangeLocation" className="input" defaultValue={selectedAssignment?.exchangeLocation || ""} />
                </Field>
                <Field label="Notes">
                  <textarea name="notes" className="input min-h-20" defaultValue={selectedAssignment?.notes || ""} />
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button className="btn-primary" type="submit">
                    Save color
                  </button>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={clearCustodyDay}
                    disabled={!selectedAssignment}
                  >
                    Clear selected day
                  </button>
                </div>
              </form>
            </Panel>
          </div>
        </section>
      )}

      {mode === "list" && (
        <Panel title="Weekly/list view" action={`${visibleEvents.length} records`}>
          <Timeline
            events={visibleEvents}
            emptyLabel="No calendar records in this date range."
            onDeleteEvent={deleteTimelineEvent}
          />
        </Panel>
      )}

      {mode === "timeline" && (
        <Panel title="Chronological timeline" action="Order, recorded events, notes, files, expenses">
          <Timeline
            events={visibleEvents}
            emptyLabel="No timeline records in this date range."
            onDeleteEvent={deleteTimelineEvent}
          />
        </Panel>
      )}

      <SectionExportPanel packet={sectionExport} onExport={onExportSection} />
    </div>
  );
}

function TimelineView({
  events,
  range,
  updateDataset,
  userId,
  caseId,
  sectionExport,
  onExportSection,
  flash,
}: {
  events: CalendarEvent[];
  range: DateRange;
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  userId: string;
  caseId: string;
  sectionExport: SectionExportPacket;
  onExportSection: (packet: SectionExportPacket, format: SectionExportFormat) => void;
  flash: (message: string) => void;
}) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const visibleEvents = events.filter(isTimelineVisibleEvent);
  const filteredEvents = visibleEvents.filter((event) => matchesTimelineFilter(event, filter));
  const attentionCount = visibleEvents.filter(isAttentionTimelineEvent).length;
  const exchangeCount = visibleEvents.filter(
    (event) => event.type === "scheduled_exchange" || event.type === "logged_exchange"
  ).length;
  const noteCount = visibleEvents.filter((event) => event.type === "custody_note").length;
  const evidenceCount = visibleEvents.filter((event) => event.type === "evidence_item").length;

  function deleteTimelineEvent(event: CalendarEvent) {
    if (!canDeleteTimelineEvent(event)) {
      flash("Delete this generated item from its source tab.");
      return;
    }

    updateDataset((current) => deleteTimelineEventFromDataset(current, event, userId, caseId));
    flash(`${labelEventType(event.type)} deleted from timeline.`);
  }

  function downloadTimelineCsv() {
    const rows = filteredEvents.map((event) => ({
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
    downloadTextFile(
      `lost-to-found-timeline-${range.from}-${range.to}.csv`,
      rowsToCsv(rows),
      "text/csv"
    );
    updateDataset((current) =>
      withAudit(current, {
        userId,
        caseId,
        action: "exported",
        entityType: "timeline",
        entityId: `${range.from}-${range.to}`,
        metadataSummary: "Timeline CSV exported without raw row contents in audit metadata.",
      })
    );
    flash("Timeline CSV downloaded.");
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Timeline records" value={visibleEvents.length} detail={`${range.from} to ${range.to}`} />
        <StatCard label="Needs review" value={attentionCount} detail="Attention or critical markers" tone="amber" />
        <StatCard label="Exchange entries" value={exchangeCount} detail="Scheduled and logged" />
        <StatCard label="Notes" value={noteCount} detail="Date-based records" tone="slate" />
        <StatCard label="Files" value={evidenceCount} detail="Dated file attachments" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Panel title="Timeline controls" action="Court packet view">
            <div className="grid gap-4">
              <Field label="Show">
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as TimelineFilter)}
                  className="input"
                >
                  {timelineFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <button type="button" onClick={downloadTimelineCsv} className="btn-primary">
                Export timeline CSV
              </button>
              <p className="text-xs leading-5 text-slate-500">
                Delete removes user-entered records from this workspace. Scheduled exchanges and
                uploaded files are managed from the Files tab.
              </p>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium text-slate-600">
                  {["Exchanges", "Notes", "Files", "Support", "Expenses"].map((source) => (
                    <span key={source} className="rounded bg-white px-2 py-1">
                      {source}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {(["critical", "attention", "positive", "neutral"] as const).map((severity) => (
                  <div key={severity} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium capitalize text-slate-700">{severity}</span>
                    <span className={`rounded px-2 py-1 font-semibold ${timelineSeverityPillClass(severity)}`}>
                      {timelineSeverityLabel(severity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <SectionExportPanel packet={sectionExport} onExport={onExportSection} />
        </div>

        <Panel title="Case timeline" action={`${filteredEvents.length} shown`}>
          <Timeline
            events={filteredEvents}
            emptyLabel="No timeline records match this filter."
            onDeleteEvent={deleteTimelineEvent}
          />
        </Panel>
      </section>
    </div>
  );
}

function ExchangesView({
  updateDataset,
  userId,
  caseId,
  selected,
  range,
  expectedExchanges,
  sectionExport,
  onExportSection,
  flash,
}: {
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  userId: string;
  caseId: string;
  selected: ReturnType<typeof useSelectedRecords>;
  range: DateRange;
  expectedExchanges: ReturnType<typeof generateExpectedExchangeEvents>;
  sectionExport: SectionExportPacket;
  onExportSection: (packet: SectionExportPacket, format: SectionExportFormat) => void;
  flash: (message: string) => void;
}) {
  function addRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = exchangeRuleSchema.safeParse({
      ruleName: text(formData, "ruleName"),
      dayOfWeek: text(formData, "dayOfWeek"),
      orderedExchangeTime: text(formData, "orderedExchangeTime"),
      direction: text(formData, "direction"),
      location: text(formData, "location"),
      effectiveStartDate: text(formData, "effectiveStartDate"),
      effectiveEndDate: text(formData, "effectiveEndDate"),
      orderProvisionNotes: text(formData, "orderProvisionNotes"),
    });
    if (!parsed.success) return flash(parsed.error.issues[0]?.message || "Check the exchange rule form.");

    updateDataset((current) =>
      withAudit(
        {
          ...current,
          exchangeRules: [
            {
              id: createId("rule"),
              caseId,
              userId,
              createdAt: nowIso(),
              updatedAt: nowIso(),
              ...emptyToUndefined(parsed.data),
            },
            ...current.exchangeRules,
          ],
        },
        {
          userId,
          caseId,
          action: "created",
          entityType: "custodyExchangeRule",
          entityId: "new-rule",
          metadataSummary: "Exchange rule created without court detail in audit metadata.",
        }
      )
    );
    event.currentTarget.reset();
    flash("Exchange rule saved.");
  }

  function addExchangeLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const actualDate = text(formData, "actualDate");
    const actualTime = text(formData, "actualTime");
    const parsed = exchangeLogSchema.safeParse({
      orderedExchangeAt: `${text(formData, "orderedDate")}T${text(formData, "orderedTime")}:00.000Z`,
      actualExchangeAt: actualDate && actualTime ? `${actualDate}T${actualTime}:00.000Z` : null,
      direction: text(formData, "direction"),
      status: text(formData, "status"),
      location: text(formData, "location"),
      reasonGiven: text(formData, "reasonGiven"),
      notes: text(formData, "notes"),
      tags: parseTags(text(formData, "tags")),
      witnesses: text(formData, "witnesses"),
    });
    if (!parsed.success) return flash(parsed.error.issues[0]?.message || "Check the exchange log form.");

    updateDataset((current) =>
      withAudit(
        {
          ...current,
          exchangeLogs: [
            {
              id: createId("exchange"),
              caseId,
              userId,
              createdAt: nowIso(),
              updatedAt: nowIso(),
              ...emptyToUndefined(parsed.data),
            },
            ...current.exchangeLogs,
          ],
        },
        {
          userId,
          caseId,
          action: "created",
          entityType: "exchangeLog",
          entityId: "new-exchange",
          metadataSummary: "Exchange log created without note body in audit metadata.",
        }
      )
    );
    event.currentTarget.reset();
    flash("Exchange outcome logged.");
  }

  function deleteExchangeRule(ruleId: string) {
    updateDataset((current) =>
      withAudit(
        {
          ...current,
          exchangeRules: current.exchangeRules.filter(
            (item) => !(item.id === ruleId && item.userId === userId && item.caseId === caseId)
          ),
          scheduleExceptions: current.scheduleExceptions.filter(
            (item) =>
              !(
                item.custodyExchangeRuleId === ruleId &&
                item.userId === userId &&
                item.caseId === caseId
              )
          ),
        },
        {
          userId,
          caseId,
          action: "deleted",
          entityType: "custodyExchangeRule",
          entityId: ruleId,
          metadataSummary: "Exchange rule deleted with matching schedule exceptions.",
        }
      )
    );
    flash("Exchange rule deleted.");
  }

  function deleteExchangeLog(logId: string) {
    updateDataset((current) =>
      withAudit(
        {
          ...current,
          exchangeLogs: current.exchangeLogs.filter(
            (item) => !(item.id === logId && item.userId === userId && item.caseId === caseId)
          ),
        },
        {
          userId,
          caseId,
          action: "deleted",
          entityType: "exchangeLog",
          entityId: logId,
          metadataSummary: "Exchange log deleted.",
        }
      )
    );
    flash("Exchange log deleted.");
  }

  const exchangeTimingRows = exchangeChartRows(selected.exchangeLogs, range);

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <div className="space-y-4">
        <Panel title="Court-ordered exchange expectation" action="Simple recurring rule">
          <form onSubmit={addRule} className="grid gap-3">
            <Field label="Rule name">
              <input name="ruleName" className="input" defaultValue="Friday evening exchange" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Day">
                <select name="dayOfWeek" className="input" defaultValue="5">
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </Field>
              <Field label="Ordered time">
                <input name="orderedExchangeTime" type="time" className="input" defaultValue="18:00" />
              </Field>
            </div>
            <Field label="Direction">
              <select name="direction" className="input" defaultValue="other_parent_to_me">
                <option value="other_parent_to_me">Other Parent to Me</option>
                <option value="me_to_other_parent">Me to Other Parent</option>
              </select>
            </Field>
            <Field label="Location">
              <input name="location" className="input" defaultValue="Community center entrance" />
            </Field>
            <Field label="Effective start">
              <input name="effectiveStartDate" type="date" className="input" defaultValue="2026-06-01" />
            </Field>
            <Field label="Order provision notes">
              <textarea
                name="orderProvisionNotes"
                className="input min-h-20"
                placeholder="What the order says, without legal conclusions."
              />
            </Field>
            <button className="btn-primary" type="submit">
              Save exchange rule
            </button>
          </form>
        </Panel>

        <Panel title="Log actual exchange outcome" action="Factual record">
          <form onSubmit={addExchangeLog} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ordered date">
                <input name="orderedDate" type="date" className="input" defaultValue="2026-06-12" />
              </Field>
              <Field label="Ordered time">
                <input name="orderedTime" type="time" className="input" defaultValue="18:00" />
              </Field>
              <Field label="Actual date">
                <input name="actualDate" type="date" className="input" defaultValue="2026-06-12" />
              </Field>
              <Field label="Actual time">
                <input name="actualTime" type="time" className="input" defaultValue="18:18" />
              </Field>
            </div>
            <Field label="Status">
              <select name="status" className="input" defaultValue="completed_late">
                {exchangeStatuses.map((status) => (
                  <option key={status} value={status}>
                    {labelExchangeStatus(status)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Direction">
              <select name="direction" className="input" defaultValue="other_parent_to_me">
                <option value="other_parent_to_me">Other Parent to Me</option>
                <option value="me_to_other_parent">Me to Other Parent</option>
              </select>
            </Field>
            <Field label="Location">
              <input name="location" className="input" />
            </Field>
            <Field label="Reason given">
              <input name="reasonGiven" className="input" />
            </Field>
            <Field label="Notes">
              <textarea
                name="notes"
                className="input min-h-20"
                placeholder="What happened? When? How does it compare to the order?"
              />
            </Field>
            <Field label="Tags">
              <input name="tags" className="input" placeholder="late exchange, exchange" />
            </Field>
            <Field label="Witnesses">
              <input name="witnesses" className="input" />
            </Field>
            <button className="btn-primary" type="submit">
              Save exchange log
            </button>
          </form>
        </Panel>
      </div>

      <div className="space-y-4">
        <SectionExportPanel packet={sectionExport} onExport={onExportSection} />

        <Panel title="Exchange timing graph" action={`${range.from} to ${range.to}`}>
          <ExchangeTimingChart rows={exchangeTimingRows} />
        </Panel>

        <Panel title="Exchange rules" action={`${selected.exchangeRules.length} saved`}>
          <Table
            headers={["Rule", "Day", "Time", "Direction", "Action"]}
            rows={selected.exchangeRules.map((rule) => [
              rule.ruleName,
              ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][rule.dayOfWeek],
              rule.orderedExchangeTime,
              rule.direction.replaceAll("_", " "),
              <DeleteButton
                key={rule.id}
                label="Delete"
                ariaLabel={`Delete exchange rule ${rule.ruleName}`}
                onClick={() => deleteExchangeRule(rule.id)}
              />,
            ])}
          />
        </Panel>

        <Panel title="Scheduled exchanges" action={`${expectedExchanges.length} expected in range`}>
          <Table
            headers={["Date", "Ordered time", "Direction", "Location"]}
            rows={expectedExchanges.slice(0, 12).map((event) => [
              getIsoDateFromDateTime(event.orderedExchangeAt),
              event.orderedExchangeAt.slice(11, 16),
              event.direction.replaceAll("_", " "),
              event.location || "",
            ])}
          />
        </Panel>
        <Panel title="Logged exchanges" action={`${selected.exchangeLogs.length} records`}>
          <Table
            headers={["Date", "Ordered", "Actual", "Status", "Tags", "Action"]}
            rows={selected.exchangeLogs
              .filter((log) => getIsoDateFromDateTime(log.orderedExchangeAt) >= range.from)
              .slice(0, 12)
              .map((log) => [
                getIsoDateFromDateTime(log.orderedExchangeAt),
                log.orderedExchangeAt.slice(11, 16),
                log.actualExchangeAt?.slice(11, 16) || "",
                <StatusPill key={log.id} label={labelExchangeStatus(log.status)} />,
                log.tags.join(", "),
                <DeleteButton
                  key={log.id}
                  label="Delete"
                  ariaLabel={`Delete exchange log ${getIsoDateFromDateTime(log.orderedExchangeAt)}`}
                  onClick={() => deleteExchangeLog(log.id)}
                />,
              ])}
          />
        </Panel>
      </div>
    </div>
  );
}

function NotesView({
  updateDataset,
  userId,
  caseId,
  notes,
  sectionExport,
  onExportSection,
  flash,
}: {
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  userId: string;
  caseId: string;
  notes: ReturnType<typeof useSelectedRecords>["dateNotes"];
  sectionExport: SectionExportPacket;
  onExportSection: (packet: SectionExportPacket, format: SectionExportFormat) => void;
  flash: (message: string) => void;
}) {
  const [filter, setFilter] = useState("all");

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = dateNoteSchema.safeParse({
      noteDate: text(formData, "noteDate"),
      noteTime: text(formData, "noteTime"),
      category: text(formData, "category"),
      title: text(formData, "title"),
      body: text(formData, "body"),
      tags: parseTags(text(formData, "tags")),
      includeInReports: formData.get("includeInReports") === "on",
    });
    if (!parsed.success) return flash(parsed.error.issues[0]?.message || "Check the note form.");

    updateDataset((current) =>
      withAudit(
        {
          ...current,
          dateNotes: [
            {
              id: createId("note"),
              userId,
              caseId,
              createdAt: nowIso(),
              updatedAt: nowIso(),
              ...emptyToUndefined(parsed.data),
            },
            ...current.dateNotes,
          ],
        },
        {
          userId,
          caseId,
          action: "created",
          entityType: "dateNote",
          entityId: "new-note",
          metadataSummary: "Date note created without note body in audit metadata.",
        }
      )
    );
    event.currentTarget.reset();
    flash("Date-based note saved.");
  }

  function deleteNote(noteId: string) {
    updateDataset((current) =>
      withAudit(
        {
          ...current,
          dateNotes: current.dateNotes.filter(
            (item) => !(item.id === noteId && item.userId === userId && item.caseId === caseId)
          ),
        },
        {
          userId,
          caseId,
          action: "deleted",
          entityType: "dateNote",
          entityId: noteId,
          metadataSummary: "Date note deleted.",
        }
      )
    );
    flash("Date-based note deleted.");
  }

  const filteredNotes = filter === "all" ? notes : notes.filter((note) => note.category === filter);

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <div className="space-y-4">
        <Panel title="Add date-based note" action="Factual wording">
          <form onSubmit={addNote} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date">
                <input name="noteDate" type="date" className="input" defaultValue="2026-06-10" />
              </Field>
              <Field label="Time">
                <input name="noteTime" type="time" className="input" />
              </Field>
            </div>
            <Field label="Category">
              <select name="category" className="input" defaultValue="exchange">
                {[
                  "exchange",
                  "communication",
                  "school",
                  "medical",
                  "expense",
                  "child_support",
                  "safety",
                  "schedule_change",
                  "child_item",
                  "attorney",
                  "court",
                  "other",
                ].map((category) => (
                  <option key={category} value={category}>
                    {labelNoteCategory(category as NoteCategory)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input name="title" className="input" placeholder="Short factual title" />
            </Field>
            <Field label="What happened?">
              <textarea name="body" className="input min-h-28" />
            </Field>
            <Field label="Tags">
              <input name="tags" className="input" placeholder="school, exchange" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input name="includeInReports" type="checkbox" defaultChecked />
              Include this note in selected reports
            </label>
            <button className="btn-primary" type="submit">
              Save note
            </button>
          </form>
        </Panel>

        <SectionExportPanel packet={sectionExport} onExport={onExportSection} />
      </div>

      <Panel title="Notes" action={`${filteredNotes.length} records`}>
        <div className="mb-4 flex flex-wrap gap-2">
          {["all", "exchange", "child_support", "school", "expense", "court"].map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setFilter(category)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                filter === category ? "bg-teal-700 text-white" : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {category.replaceAll("_", " ")}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {filteredNotes.map((note) => (
            <div key={note.id} className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-950">{note.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {note.noteDate} {note.noteTime || ""} - {labelNoteCategory(note.category)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill label={note.includeInReports ? "report included" : "not selected"} />
                  <DeleteButton
                    label="Delete"
                    ariaLabel={`Delete note ${note.title}`}
                    onClick={() => deleteNote(note.id)}
                  />
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{note.body}</p>
              <TagList tags={note.tags} />
            </div>
          ))}
          {filteredNotes.length === 0 && <Empty label="No notes match this filter." />}
        </div>
      </Panel>
    </div>
  );
}

function importSubmitterValue(event: FormEvent<HTMLFormElement>) {
  const submitter = (event.nativeEvent as SubmitEvent).submitter;
  return submitter instanceof HTMLButtonElement ? submitter.value : "";
}

async function requestAiImportDrafts({
  content,
  sourceLabel,
  defaultYear,
  defaultOrderedTime,
  importKind,
}: {
  content: string;
  sourceLabel: string;
  defaultYear?: number;
  defaultOrderedTime?: string;
  importKind: AiImportKind;
}) {
  const response = await fetch("/api/records/import/assist", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      sourceLabel,
      importKind,
      ...(defaultYear ? { defaultYear } : {}),
      ...(defaultOrderedTime ? { defaultOrderedTime } : {}),
    }),
  });

  const parsed = (await response.json().catch(() => ({}))) as {
    drafts?: AiImportDraftPayload[];
    error?: string;
    detail?: string;
  };

  if (!response.ok) {
    throw new Error([parsed.error, parsed.detail].filter(Boolean).join(" ") || "AI import failed.");
  }

  return (parsed.drafts || []).map(aiPayloadToImportDraft);
}

function aiPayloadToImportDraft(draft: AiImportDraftPayload): ImportDraft {
  const sourceDetail = [
    draft.sourceQuote ? `Source quote: ${draft.sourceQuote}` : "",
    draft.reviewReason ? `Review note: ${draft.reviewReason}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: createId("import-ai"),
    kind: draft.kind,
    date: draft.date,
    time: draft.time || undefined,
    title: draft.title,
    body: sourceDetail ? `${draft.body}\n\n${sourceDetail}` : draft.body,
    category: draft.category,
    tags: Array.from(new Set([...draft.tags, "ai_assisted"])).slice(0, 12),
    includeInReports: draft.includeInReports,
    confidence: draft.confidence,
    sourceLabel: "AI assist",
    selected: true,
    orderedTime: draft.orderedTime || undefined,
    actualTime: draft.actualTime || undefined,
    direction: draft.direction || undefined,
    status: draft.status || undefined,
    caregiverLabel: draft.caregiverLabel || undefined,
    color: draft.color || undefined,
  };
}

function oppositeScheduleParent(parent: ScheduleParentKey): ScheduleParentKey {
  return parent === "you" ? "other" : "you";
}

function ownerFromBlocks(
  offset: number,
  blocks: Array<{ owner: ScheduleParentKey; days: number }>
) {
  const cycleLength = blocks.reduce((sum, block) => sum + block.days, 0);
  let cursor = offset % cycleLength;
  for (const block of blocks) {
    if (cursor < block.days) return block.owner;
    cursor -= block.days;
  }
  return blocks[0].owner;
}

function scheduleOwnerForOffset(
  presetId: ParentingSchedulePresetId,
  startOwner: ScheduleParentKey,
  offset: number
) {
  const otherOwner = oppositeScheduleParent(startOwner);

  if (presetId === "three_four_four_three_flip") {
    const activeStartOwner = Math.floor(offset / 56) % 2 === 0 ? startOwner : otherOwner;
    const activeOtherOwner = oppositeScheduleParent(activeStartOwner);
    return ownerFromBlocks(offset % 56, [
      { owner: activeStartOwner, days: 4 },
      { owner: activeOtherOwner, days: 3 },
      { owner: activeStartOwner, days: 3 },
      { owner: activeOtherOwner, days: 4 },
    ]);
  }

  if (presetId === "week_on_week_off") {
    return ownerFromBlocks(offset, [
      { owner: startOwner, days: 7 },
      { owner: otherOwner, days: 7 },
    ]);
  }

  if (presetId === "two_two_three") {
    return ownerFromBlocks(offset, [
      { owner: startOwner, days: 2 },
      { owner: otherOwner, days: 2 },
      { owner: startOwner, days: 3 },
      { owner: otherOwner, days: 2 },
      { owner: startOwner, days: 2 },
      { owner: otherOwner, days: 3 },
    ]);
  }

  if (presetId === "two_two_five_five") {
    return ownerFromBlocks(offset, [
      { owner: startOwner, days: 2 },
      { owner: otherOwner, days: 2 },
      { owner: startOwner, days: 5 },
      { owner: otherOwner, days: 5 },
    ]);
  }

  if (presetId === "three_three_four_four") {
    return ownerFromBlocks(offset, [
      { owner: startOwner, days: 3 },
      { owner: otherOwner, days: 3 },
      { owner: startOwner, days: 4 },
      { owner: otherOwner, days: 4 },
    ]);
  }

  return ownerFromBlocks(offset, [
    { owner: startOwner, days: 5 },
    { owner: otherOwner, days: 2 },
    { owner: startOwner, days: 7 },
  ]);
}

function directionForIncomingParent(owner: ScheduleParentKey): ExchangeDirection {
  return owner === "you" ? "other_parent_to_me" : "me_to_other_parent";
}

function buildScheduleSetupAssignments({
  presetId,
  presetLabel,
  startDate,
  endDate,
  startOwner,
  yourLabel,
  otherParentLabel,
  yourColor,
  otherParentColor,
  exchangeTime,
  exchangeLocation,
  sourceLabel,
  orderNotes,
  markStartAsExchange,
  userId,
  caseId,
}: {
  presetId: ParentingSchedulePresetId;
  presetLabel: string;
  startDate: string;
  endDate: string;
  startOwner: ScheduleParentKey;
  yourLabel: string;
  otherParentLabel: string;
  yourColor: string;
  otherParentColor: string;
  exchangeTime: string;
  exchangeLocation?: string;
  sourceLabel: string;
  orderNotes?: string;
  markStartAsExchange: boolean;
  userId: string;
  caseId: string;
}) {
  const dayCount = (daysBetween(startDate, endDate) ?? -1) + 1;
  const now = nowIso();
  const assignments: CustodyDayAssignment[] = [];
  let previousOwner: ScheduleParentKey | undefined;

  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = addDays(startDate, offset);
    const owner = scheduleOwnerForOffset(presetId, startOwner, offset);
    const isExchangeDate = offset === 0 ? markStartAsExchange : owner !== previousOwner;
    const caregiverLabel = owner === "you" ? yourLabel : otherParentLabel;
    const setupNotes = [
      `Generated from ${sourceLabel || "custody order setup"}.`,
      `Pattern: ${presetLabel}.`,
      isExchangeDate ? `Transition marked at ${exchangeTime}${exchangeLocation ? ` at ${exchangeLocation}` : ""}.` : "",
      isExchangeDate && orderNotes ? orderNotes : "",
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 1000);

    assignments.push({
      id: createId("custody-day"),
      caseId,
      userId,
      date,
      caregiverLabel,
      color: owner === "you" ? yourColor : otherParentColor,
      startsAt: isExchangeDate ? exchangeTime : "00:00",
      endsAt: "23:59",
      exchangeTime: isExchangeDate ? exchangeTime : undefined,
      exchangeDirection: isExchangeDate ? directionForIncomingParent(owner) : undefined,
      exchangeLocation: isExchangeDate ? exchangeLocation : undefined,
      notes: setupNotes,
      createdAt: now,
      updatedAt: now,
    });
    previousOwner = owner;
  }

  return assignments;
}

function ImportView({
  updateDataset,
  userId,
  caseId,
  timezone,
  recordsStorageMode,
  flash,
}: {
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  userId: string;
  caseId: string;
  timezone: string;
  recordsStorageMode: "local" | "supabase";
  flash: (message: string) => void;
}) {
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [parsing, setParsing] = useState(false);
  const [assistBusy, setAssistBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [setupSchedulePreset, setSetupSchedulePreset] =
    useState<ParentingSchedulePresetId>("three_four_four_three_flip");
  const selectedCount = drafts.filter((draft) => draft.selected).length;
  const selectedSetupPreset =
    parentingSchedulePresets.find((preset) => preset.id === setupSchedulePreset) ||
    parentingSchedulePresets[0];
  const setupToday = formatLocalDate(new Date(), timezone);
  const setupDefaultEndDate = addDays(setupToday, 90);

  function queueDrafts(nextDrafts: ImportDraft[], sourceLabel: string) {
    if (nextDrafts.length === 0) {
      flash(`No import-ready records found in ${sourceLabel}.`);
      return;
    }

    setDrafts((current) => [...nextDrafts, ...current]);
    flash(`${nextDrafts.length} draft record${nextDrafts.length === 1 ? "" : "s"} queued.`);
  }

  async function reviewMessageArchive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const useAiAssist = importSubmitterValue(event) === "ai";
    const formData = new FormData(form);
    const file = formData.get("archive");
    if (!(file instanceof File) || file.size === 0) {
      flash("Choose a CSV, TXT, or HTML message export.");
      return;
    }

    if (useAiAssist) setAssistBusy(true);
    else setParsing(true);
    try {
      const content = await file.text();
      const nextDrafts = useAiAssist
        ? await requestAiImportDrafts({
            content,
            sourceLabel: file.name,
            importKind: "message_archive",
          })
        : buildMessageImportDrafts({
            content,
            sourceLabel: file.name,
            defaultYear: new Date().getFullYear(),
            defaultOrderedTime: "17:00",
          });
      queueDrafts(
        nextDrafts,
        file.name
      );
      form.reset();
    } catch (error) {
      flash(error instanceof Error ? error.message : "Message import failed.");
    } finally {
      if (useAiAssist) setAssistBusy(false);
      else setParsing(false);
    }
  }

  async function reviewPastedNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const useAiAssist = importSubmitterValue(event) === "ai";
    const formData = new FormData(form);
    const content = text(formData, "notes");
    if (!content) {
      flash("Paste notes before reviewing.");
      return;
    }

    const sourceLabel = text(formData, "sourceLabel") || "Pasted notes";

    if (useAiAssist) setAssistBusy(true);
    try {
      const nextDrafts = useAiAssist
        ? await requestAiImportDrafts({
            content,
            sourceLabel,
            importKind: "pasted_notes",
          })
        : buildPastedNoteDrafts({
            content,
            sourceLabel,
            defaultYear: new Date().getFullYear(),
            defaultOrderedTime: "17:00",
          });
      queueDrafts(nextDrafts, "pasted notes");
      form.reset();
    } catch (error) {
      flash(error instanceof Error ? error.message : "Pasted-note import failed.");
    } finally {
      if (useAiAssist) setAssistBusy(false);
    }
  }

  async function saveDocumentFiles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(event.currentTarget);
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) {
      flash("Choose one or more files.");
      return;
    }

    const evidenceDate = text(formData, "evidenceDate");
    const description = text(formData, "description");
    const tags = parseTags(text(formData, "tags") || "document");
    const includeInReports = formData.get("includeInReports") === "on";
    const evidenceRecords: RecordsDataset["evidenceItems"] = [];
    const now = nowIso();

    setDocumentSaving(true);
    try {
      for (const file of files) {
        const validation = validateEvidenceFile({
          originalFileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
        if (!validation.ok) throw new Error(`${file.name}: ${validation.error}`);

        const id = createId("evidence");
        const uploaded =
          recordsStorageMode === "supabase" ? await uploadImportEvidenceFile(file, id) : undefined;

        evidenceRecords.push({
          id,
          userId,
          caseId,
          originalFileName: file.name,
          storedFileName:
            uploaded?.storedFileName || buildStoredEvidenceName({ id, originalFileName: file.name }),
          fileType: file.type,
          fileSize: file.size,
          storageBucket: uploaded?.storageBucket,
          storagePath: uploaded?.storagePath,
          storageUploadedAt: uploaded?.storageUploadedAt,
          storageSha256: uploaded?.storageSha256,
          uploadedAt: now,
          evidenceDate: evidenceDate || now.slice(0, 10),
          description: description || `Imported document: ${file.name}`,
          tags,
          includeInReports,
          reviewStatus: "needs_review",
          malwareScanStatus: uploaded?.malwareScanStatus || "pending",
          createdAt: now,
          updatedAt: now,
        });
      }

      await updateDataset((current) =>
        withAudit(
          {
            ...current,
            evidenceItems: [...evidenceRecords, ...current.evidenceItems],
          },
          {
            userId,
            caseId,
            action: "uploaded",
            entityType: "evidenceItem",
            entityId: evidenceRecords.length === 1 ? evidenceRecords[0].id : createId("evidence-batch"),
            metadataSummary:
              evidenceRecords.length === 1
                ? "Document imported into the private file index."
                : `${evidenceRecords.length} documents imported into the private file index.`,
          }
        )
      );
      form.reset();
      flash(
        `${evidenceRecords.length} file record${evidenceRecords.length === 1 ? "" : "s"} saved to Files.`
      );
    } catch (error) {
      flash(error instanceof Error ? error.message : "Document import failed.");
    } finally {
      setDocumentSaving(false);
    }
  }

  function saveExchangeRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = exchangeRuleSchema.safeParse({
      ruleName: text(formData, "ruleName"),
      dayOfWeek: text(formData, "dayOfWeek"),
      orderedExchangeTime: text(formData, "orderedExchangeTime"),
      direction: text(formData, "direction"),
      location: text(formData, "location"),
      effectiveStartDate: text(formData, "effectiveStartDate"),
      effectiveEndDate: text(formData, "effectiveEndDate"),
      orderProvisionNotes: text(formData, "orderProvisionNotes"),
    });
    if (!parsed.success) return flash(parsed.error.issues[0]?.message || "Check the exchange rule.");

    updateDataset((current) =>
      withAudit(
        {
          ...current,
          exchangeRules: [
            {
              id: createId("rule"),
              caseId,
              userId,
              createdAt: nowIso(),
              updatedAt: nowIso(),
              ...emptyToUndefined(parsed.data),
            },
            ...current.exchangeRules,
          ],
        },
        {
          userId,
          caseId,
          action: "created",
          entityType: "custodyExchangeRule",
          entityId: "imported-rule",
          metadataSummary: "Exchange rule created from import setup without court text in audit metadata.",
        }
      )
    );
    event.currentTarget.reset();
    flash("Exchange rule saved.");
  }

  function saveCustodyScheduleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const presetId = text(formData, "schedulePreset") as ParentingSchedulePresetId;
    const preset = parentingSchedulePresets.find((item) => item.id === presetId);
    if (!preset) return flash("Choose a custody schedule pattern.");

    const startDate = text(formData, "startDate");
    const endDate = text(formData, "endDate");
    const exchangeTime = text(formData, "exchangeTime") || "17:00";
    const dayCount = (daysBetween(startDate, endDate) ?? -1) + 1;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return flash("Enter a valid schedule start and end date.");
    }
    if (endDate < startDate) return flash("Schedule end date must be after the start date.");
    if (dayCount < 1 || dayCount > 731) return flash("Generate between 1 day and 2 years at a time.");
    if (!/^\d{2}:\d{2}$/.test(exchangeTime)) return flash("Enter a valid exchange time.");

    const yourLabel = text(formData, "yourLabel") || "You";
    const otherParentLabel = text(formData, "otherParentLabel") || "Other Parent";
    const yourColor = text(formData, "yourColor") || custodyDayColors[0];
    const otherParentColor = text(formData, "otherParentColor") || custodyDayColors[1];
    const startOwner = text(formData, "startOwner") === "other" ? "other" : "you";
    const sourceLabel = text(formData, "sourceLabel") || "Custody order setup";
    const exchangeLocation = text(formData, "exchangeLocation");
    const orderNotes = text(formData, "orderNotes");
    const replaceExisting = formData.get("replaceExisting") === "on";
    const markStartAsExchange = formData.get("markStartAsExchange") === "on";

    const firstAssignment = custodyDayAssignmentSchema.safeParse({
      date: startDate,
      caregiverLabel: startOwner === "you" ? yourLabel : otherParentLabel,
      color: startOwner === "you" ? yourColor : otherParentColor,
      startsAt: markStartAsExchange ? exchangeTime : "00:00",
      endsAt: "23:59",
      exchangeTime: markStartAsExchange ? exchangeTime : "",
      exchangeDirection: markStartAsExchange ? directionForIncomingParent(startOwner) : "",
      exchangeLocation,
      notes: orderNotes,
    });
    if (!firstAssignment.success) {
      return flash(firstAssignment.error.issues[0]?.message || "Check the custody setup fields.");
    }

    const generatedAssignments = buildScheduleSetupAssignments({
      presetId,
      presetLabel: preset.label,
      startDate,
      endDate,
      startOwner,
      yourLabel,
      otherParentLabel,
      yourColor,
      otherParentColor,
      exchangeTime,
      exchangeLocation,
      sourceLabel,
      orderNotes,
      markStartAsExchange,
      userId,
      caseId,
    });

    updateDataset((current) => {
      const existingDates = new Set(
        current.custodyDayAssignments
          .filter((item) => item.userId === userId && item.caseId === caseId)
          .map((item) => item.date)
      );
      const assignmentsToSave = replaceExisting
        ? generatedAssignments
        : generatedAssignments.filter((item) => !existingDates.has(item.date));
      const generatedDateSet = new Set(generatedAssignments.map((item) => item.date));
      const retainedAssignments = current.custodyDayAssignments.filter((item) => {
        if (item.userId !== userId || item.caseId !== caseId) return true;
        if (!replaceExisting) return true;
        return !generatedDateSet.has(item.date);
      });

      return withAudit(
        {
          ...current,
          custodyDayAssignments: [...assignmentsToSave, ...retainedAssignments],
        },
        {
          userId,
          caseId,
          action: "created",
          entityType: "custodyScheduleSetup",
          entityId: createId("schedule-setup"),
          metadataSummary: `${assignmentsToSave.length} custody calendar day assignments generated from ${preset.label}.`,
        }
      );
    });

    flash(`${generatedAssignments.length} custody calendar day${generatedAssignments.length === 1 ? "" : "s"} generated.`);
  }

  async function reviewCustodyCalendarRows(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const useAiAssist = importSubmitterValue(event) === "ai";
    const formData = new FormData(form);
    const content = text(formData, "calendarRows");
    if (!content) {
      flash("Paste calendar rows before reviewing.");
      return;
    }

    const sourceLabel = text(formData, "sourceLabel") || "Custody calendar rows";

    if (useAiAssist) setAssistBusy(true);
    try {
      const nextDrafts = useAiAssist
        ? await requestAiImportDrafts({
            content,
            sourceLabel,
            defaultYear: new Date().getFullYear(),
            defaultOrderedTime: "17:00",
            importKind: "custody_calendar",
          })
        : buildCustodyCalendarDrafts({ content, sourceLabel });
      queueDrafts(nextDrafts, "custody calendar rows");
      form.reset();
    } catch (error) {
      flash(error instanceof Error ? error.message : "Calendar import failed.");
    } finally {
      if (useAiAssist) setAssistBusy(false);
    }
  }

  function updateDraft(draftId: string, patch: Partial<ImportDraft>) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === draftId ? { ...draft, ...patch } : draft))
    );
  }

  function removeDraft(draftId: string) {
    setDrafts((current) => current.filter((draft) => draft.id !== draftId));
  }

  async function uploadImportEvidenceFile(file: File, evidenceId: string) {
    const body = new FormData();
    body.append("file", file);
    body.append("caseId", caseId);
    body.append("evidenceId", evidenceId);

    const response = await fetch("/api/records/evidence/upload", {
      method: "POST",
      credentials: "same-origin",
      body,
    });
    const parsed = (await response.json().catch(() => ({}))) as {
      evidence?: Partial<EvidenceItem>;
      error?: string;
      blockers?: string[];
    };

    if (!response.ok) {
      const details = parsed.blockers?.length ? ` ${parsed.blockers.join(" ")}` : "";
      throw new Error(`${parsed.error || "File upload failed."}${details}`);
    }

    if (!parsed.evidence?.storagePath || parsed.evidence.malwareScanStatus !== "clean") {
      throw new Error("File upload response was incomplete.");
    }

    return parsed.evidence;
  }

  async function saveApprovedDrafts() {
    const approved = drafts.filter((draft) => draft.selected);
    if (approved.length === 0) {
      flash("Select at least one draft to save.");
      return;
    }

    setSaving(true);
    try {
      const savedDraftIds = new Set<string>();
      const now = nowIso();
      const noteRecords: RecordsDataset["dateNotes"] = [];
      const exchangeRecords: RecordsDataset["exchangeLogs"] = [];
      const custodyDayRecords: RecordsDataset["custodyDayAssignments"] = [];
      const evidenceRecords: RecordsDataset["evidenceItems"] = [];

      for (const draft of approved) {
        if (draft.kind === "note") {
          const parsed = dateNoteSchema.safeParse({
            noteDate: draft.date,
            noteTime: draft.time || "",
            category: draft.category,
            title: draft.title,
            body: draft.body,
            tags: draft.tags,
            includeInReports: draft.includeInReports,
          });
          if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Check note drafts.");

          noteRecords.push({
            id: createId("note"),
            userId,
            caseId,
            createdAt: now,
            updatedAt: now,
            ...emptyToUndefined(parsed.data),
          });
          savedDraftIds.add(draft.id);
        }

        if (draft.kind === "exchange") {
          const parsed = exchangeLogSchema.safeParse({
            orderedExchangeAt: `${draft.date}T${draft.orderedTime || "17:00"}:00.000Z`,
            actualExchangeAt: draft.actualTime ? `${draft.date}T${draft.actualTime}:00.000Z` : null,
            direction: draft.direction || "other_parent_to_me",
            status: draft.status || "other",
            location: "",
            reasonGiven: "",
            notes: draft.body,
            tags: draft.tags,
            witnesses: "",
          });
          if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Check exchange drafts.");

          exchangeRecords.push({
            id: createId("exchange"),
            userId,
            caseId,
            createdAt: now,
            updatedAt: now,
            ...emptyToUndefined(parsed.data),
          });
          savedDraftIds.add(draft.id);
        }

        if (draft.kind === "custody_day") {
          const parsed = custodyDayAssignmentSchema.safeParse({
            date: draft.date,
            caregiverLabel: draft.caregiverLabel || "Parent A",
            color: draft.color || custodyDayColors[0],
            startsAt: "",
            endsAt: "",
            exchangeTime: "",
            exchangeDirection: "",
            exchangeLocation: "",
            notes: draft.body,
          });
          if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Check calendar drafts.");
          const parsedCustodyDay = emptyToUndefined(parsed.data);

          custodyDayRecords.push({
            id: createId("custody-day"),
            userId,
            caseId,
            createdAt: now,
            updatedAt: now,
            ...parsedCustodyDay,
            exchangeDirection: parsedCustodyDay.exchangeDirection || undefined,
          });
          savedDraftIds.add(draft.id);
        }

        if (draft.kind === "file") {
          if (!draft.file) throw new Error(`Missing file for ${draft.title}.`);
          const validation = validateEvidenceFile({
            originalFileName: draft.file.name,
            fileType: draft.file.type,
            fileSize: draft.file.size,
          });
          if (!validation.ok) throw new Error(`${draft.file.name}: ${validation.error}`);

          const id = createId("evidence");
          const uploaded =
            recordsStorageMode === "supabase" ? await uploadImportEvidenceFile(draft.file, id) : undefined;

          evidenceRecords.push({
            id,
            userId,
            caseId,
            originalFileName: draft.file.name,
            storedFileName:
              uploaded?.storedFileName || buildStoredEvidenceName({ id, originalFileName: draft.file.name }),
            fileType: draft.file.type,
            fileSize: draft.file.size,
            storageBucket: uploaded?.storageBucket,
            storagePath: uploaded?.storagePath,
            storageUploadedAt: uploaded?.storageUploadedAt,
            storageSha256: uploaded?.storageSha256,
            uploadedAt: now,
            evidenceDate: draft.date,
            description: draft.body,
            tags: draft.tags,
            includeInReports: draft.includeInReports,
            reviewStatus: "needs_review",
            malwareScanStatus: uploaded?.malwareScanStatus || "pending",
            createdAt: now,
            updatedAt: now,
          });
          savedDraftIds.add(draft.id);
        }
      }

      await updateDataset((current) =>
        withAudit(
          {
            ...current,
            dateNotes: [...noteRecords, ...current.dateNotes],
            exchangeLogs: [...exchangeRecords, ...current.exchangeLogs],
            custodyDayAssignments: [
              ...custodyDayRecords,
              ...current.custodyDayAssignments.filter(
                (item) =>
                  !custodyDayRecords.some(
                    (record) =>
                      record.userId === item.userId &&
                      record.caseId === item.caseId &&
                      record.date === item.date
                  )
              ),
            ],
            evidenceItems: [...evidenceRecords, ...current.evidenceItems],
          },
          {
            userId,
            caseId,
            action: "created",
            entityType: "importBatch",
            entityId: createId("import-batch"),
            metadataSummary: `${savedDraftIds.size} approved import draft records saved to this case.`,
          }
        )
      );
      setDrafts((current) => current.filter((draft) => !savedDraftIds.has(draft.id)));
      flash(`${savedDraftIds.size} import draft${savedDraftIds.size === 1 ? "" : "s"} saved.`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Import save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <div className="space-y-4">
        <Panel title="Message archive" action="CSV, TXT, HTML">
          <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            AI review sends this import text to the configured server-side model and returns editable drafts only.
          </div>
          <form onSubmit={reviewMessageArchive} className="grid gap-3">
            <Field label="Archive file">
              <input name="archive" type="file" className="input" accept=".csv,.txt,.html,text/csv,text/plain,text/html" />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="btn-primary" type="submit" value="rules" disabled={parsing || assistBusy}>
                {parsing ? "Reviewing..." : "Review message file"}
              </button>
              <button className="btn-secondary" type="submit" value="ai" disabled={parsing || assistBusy}>
                {assistBusy ? "AI reviewing..." : "AI review file"}
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Paste notes" action="Dated entries">
          <form onSubmit={reviewPastedNotes} className="grid gap-3">
            <Field label="Source label">
              <input name="sourceLabel" className="input" defaultValue="Pasted notes" />
            </Field>
            <Field label="Notes">
              <textarea name="notes" className="input min-h-44" />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="btn-primary" type="submit" value="rules" disabled={assistBusy}>
                Review pasted notes
              </button>
              <button className="btn-secondary" type="submit" value="ai" disabled={assistBusy}>
                {assistBusy ? "AI reviewing..." : "AI review notes"}
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Document intake" action={recordsStorageMode === "supabase" ? "Private storage" : "Metadata only"}>
          <form onSubmit={saveDocumentFiles} className="grid gap-3">
            <Field label="Files">
              <input
                name="files"
                type="file"
                multiple
                className="input"
                accept=".docx,.pdf,.png,.jpg,.jpeg,.heic,.txt,.csv"
              />
            </Field>
            <Field label="Record date">
              <input name="evidenceDate" type="date" className="input" defaultValue={formatLocalDate(new Date(), timezone)} />
            </Field>
            <Field label="Description">
              <textarea name="description" className="input min-h-20" />
            </Field>
            <Field label="Tags">
              <input name="tags" className="input" defaultValue="document" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input name="includeInReports" type="checkbox" defaultChecked />
              Include in report file index
            </label>
            <button className="btn-primary" type="submit" disabled={documentSaving}>
              {documentSaving
                ? "Saving files..."
                : recordsStorageMode === "supabase"
                  ? "Upload files to Files"
                  : "Save files to Files"}
            </button>
          </form>
        </Panel>

        <Panel title="Custody order setup" action="Schedule templates">
          <div className="space-y-5">
            <form onSubmit={saveCustodyScheduleSetup} className="grid gap-3">
              <Field label="Order/source label">
                <input name="sourceLabel" className="input" defaultValue="Custody order" />
              </Field>
              <Field label="Schedule pattern">
                <select
                  name="schedulePreset"
                  className="input"
                  value={setupSchedulePreset}
                  onChange={(event) => setSetupSchedulePreset(event.target.value as ParentingSchedulePresetId)}
                >
                  {parentingSchedulePresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                {selectedSetupPreset.description}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Pattern start date">
                  <input name="startDate" type="date" className="input" defaultValue={setupToday} />
                </Field>
                <Field label="Generate through">
                  <input name="endDate" type="date" className="input" defaultValue={setupDefaultEndDate} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Your calendar label">
                  <input name="yourLabel" className="input" defaultValue="You" />
                </Field>
                <Field label="Other parent label">
                  <input name="otherParentLabel" className="input" defaultValue="Other Parent" />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Your color">
                  <input name="yourColor" type="color" className="h-10 w-full cursor-pointer rounded-md border border-slate-300 bg-white p-1" defaultValue={custodyDayColors[0]} />
                </Field>
                <Field label="Other parent color">
                  <input name="otherParentColor" type="color" className="h-10 w-full cursor-pointer rounded-md border border-slate-300 bg-white p-1" defaultValue={custodyDayColors[1]} />
                </Field>
              </div>
              <Field label="Pattern starts with">
                <select name="startOwner" className="input" defaultValue="other">
                  <option value="you">Your label</option>
                  <option value="other">Other parent label</option>
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Exchange time">
                  <input name="exchangeTime" type="time" className="input" defaultValue="17:00" />
                </Field>
                <Field label="Exchange location">
                  <input name="exchangeLocation" className="input" placeholder="Optional" />
                </Field>
              </div>
              <Field label="Order notes">
                <textarea
                  name="orderNotes"
                  className="input min-h-20"
                  placeholder="Vacation, holiday, communication, and order-specific notes."
                  defaultValue="Vacation schedule: each parent may exercise two uninterrupted weeks with notice. Holidays: alternate annually unless the order states otherwise."
                />
              </Field>
              <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-3">
                  <input name="markStartAsExchange" type="checkbox" defaultChecked />
                  <span>Mark the start date as an exchange.</span>
                </label>
                <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-3">
                  <input name="replaceExisting" type="checkbox" defaultChecked />
                  <span>Replace existing calendar colors in this range.</span>
                </label>
              </div>
              <button className="btn-primary" type="submit">
                Generate custody calendar
              </button>
            </form>

            <form onSubmit={saveExchangeRule} className="grid gap-3 border-t border-slate-200 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Manual exchange rule
              </p>
              <Field label="Rule name">
                <input name="ruleName" className="input" placeholder="Standing exchange rule" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Day">
                  <select name="dayOfWeek" className="input" defaultValue="5">
                    <option value="0">Sunday</option>
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                  </select>
                </Field>
                <Field label="Ordered time">
                  <input name="orderedExchangeTime" type="time" className="input" defaultValue="17:00" />
                </Field>
              </div>
              <Field label="Direction">
                <select name="direction" className="input" defaultValue="other_parent_to_me">
                  <option value="other_parent_to_me">Other Parent to Me</option>
                  <option value="me_to_other_parent">Me to Other Parent</option>
                </select>
              </Field>
              <Field label="Effective start">
                <input name="effectiveStartDate" type="date" className="input" />
              </Field>
              <Field label="Effective end">
                <input name="effectiveEndDate" type="date" className="input" />
              </Field>
              <Field label="Location">
                <input name="location" className="input" />
              </Field>
              <Field label="Order notes">
                <textarea name="orderProvisionNotes" className="input min-h-20" />
              </Field>
              <button className="btn-secondary" type="submit">
                Save exchange rule
              </button>
            </form>

            <form onSubmit={reviewCustodyCalendarRows} className="grid gap-3 border-t border-slate-200 pt-5">
              <Field label="Source label">
                <input name="sourceLabel" className="input" defaultValue="Custody calendar" />
              </Field>
              <Field label="Calendar rows">
                <textarea
                  name="calendarRows"
                  className="input min-h-32"
                  placeholder="2026-07-05, Parent A, #0f766e"
                />
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <button className="btn-secondary" type="submit" value="rules" disabled={assistBusy}>
                  Review calendar rows
                </button>
                <button className="btn-secondary" type="submit" value="ai" disabled={assistBusy}>
                  {assistBusy ? "AI reviewing..." : "AI review calendar"}
                </button>
              </div>
            </form>
          </div>
        </Panel>
      </div>

      <Panel title="Assisted review queue" action={`${drafts.length} drafts`}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">
              {selectedCount} selected for save
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDrafts((current) => current.map((draft) => ({ ...draft, selected: true })))}
                disabled={drafts.length === 0}
              >
                Select all
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDrafts((current) => current.map((draft) => ({ ...draft, selected: false })))}
                disabled={drafts.length === 0}
              >
                Select none
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void saveApprovedDrafts()}
                disabled={saving || selectedCount === 0}
              >
                {saving ? "Saving..." : "Save approved records"}
              </button>
            </div>
          </div>

          {drafts.length === 0 ? (
            <Empty label="No import drafts are queued." />
          ) : (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <div key={draft.id} className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <input
                        type="checkbox"
                        checked={draft.selected}
                        onChange={(event) => updateDraft(draft.id, { selected: event.target.checked })}
                      />
                      {importDraftKindLabels[draft.kind]}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill label={draft.confidence} />
                      <StatusPill label={draft.sourceLabel} />
                      <DeleteButton
                        label="Remove"
                        ariaLabel={`Remove import draft ${draft.title}`}
                        onClick={() => removeDraft(draft.id)}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Field label="Date">
                      <input
                        type="date"
                        className="input"
                        value={draft.date}
                        onChange={(event) => updateDraft(draft.id, { date: event.target.value })}
                      />
                    </Field>
                    <Field label="Time">
                      <input
                        type="time"
                        className="input"
                        value={draft.time || ""}
                        onChange={(event) => updateDraft(draft.id, { time: event.target.value })}
                        disabled={draft.kind === "file" || draft.kind === "custody_day"}
                      />
                    </Field>
                  </div>

                  {draft.kind === "exchange" && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Field label="Ordered time">
                        <input
                          type="time"
                          className="input"
                          value={draft.orderedTime || "17:00"}
                          onChange={(event) => updateDraft(draft.id, { orderedTime: event.target.value })}
                        />
                      </Field>
                      <Field label="Actual time">
                        <input
                          type="time"
                          className="input"
                          value={draft.actualTime || ""}
                          onChange={(event) => updateDraft(draft.id, { actualTime: event.target.value })}
                        />
                      </Field>
                      <Field label="Status">
                        <select
                          className="input"
                          value={draft.status || "other"}
                          onChange={(event) => updateDraft(draft.id, { status: event.target.value as ExchangeStatus })}
                        >
                          {exchangeStatuses.map((status) => (
                            <option key={status} value={status}>
                              {labelExchangeStatus(status)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Direction">
                        <select
                          className="input"
                          value={draft.direction || "other_parent_to_me"}
                          onChange={(event) => updateDraft(draft.id, { direction: event.target.value as ExchangeDirection })}
                        >
                          <option value="other_parent_to_me">Other Parent to Me</option>
                          <option value="me_to_other_parent">Me to Other Parent</option>
                        </select>
                      </Field>
                    </div>
                  )}

                  {draft.kind === "custody_day" && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Field label="Caregiver label">
                        <input
                          className="input"
                          value={draft.caregiverLabel || "Parent A"}
                          onChange={(event) => updateDraft(draft.id, { caregiverLabel: event.target.value })}
                        />
                      </Field>
                      <Field label="Color">
                        <input
                          type="color"
                          className="input h-10"
                          value={draft.color || custodyDayColors[0]}
                          onChange={(event) => updateDraft(draft.id, { color: event.target.value })}
                        />
                      </Field>
                    </div>
                  )}

                  <div className="mt-3 grid gap-3">
                    <Field label="Title">
                      <input
                        className="input"
                        value={draft.title}
                        onChange={(event) => updateDraft(draft.id, { title: event.target.value })}
                      />
                    </Field>
                    {draft.kind === "note" && (
                      <Field label="Category">
                        <select
                          className="input"
                          value={draft.category}
                          onChange={(event) => updateDraft(draft.id, { category: event.target.value as NoteCategory })}
                        >
                          {[
                            "exchange",
                            "communication",
                            "school",
                            "medical",
                            "expense",
                            "child_support",
                            "safety",
                            "schedule_change",
                            "child_item",
                            "attorney",
                            "court",
                            "other",
                          ].map((category) => (
                            <option key={category} value={category}>
                              {labelNoteCategory(category as NoteCategory)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field label={draft.kind === "file" ? "Description" : "Record text"}>
                      <textarea
                        className="input min-h-24"
                        value={draft.body}
                        onChange={(event) => updateDraft(draft.id, { body: event.target.value })}
                      />
                    </Field>
                    <Field label="Tags">
                      <input
                        className="input"
                        value={draft.tags.join(", ")}
                        onChange={(event) => updateDraft(draft.id, { tags: parseTags(event.target.value) })}
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.includeInReports}
                        onChange={(event) => updateDraft(draft.id, { includeInReports: event.target.checked })}
                      />
                      Include in reports
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function EvidenceView({
  updateDataset,
  userId,
  caseId,
  timezone,
  evidence,
  recordsStorageMode,
  sectionExport,
  onExportSection,
  flash,
}: {
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  userId: string;
  caseId: string;
  timezone: string;
  evidence: ReturnType<typeof useSelectedRecords>["evidenceItems"];
  recordsStorageMode: "local" | "supabase";
  sectionExport: SectionExportPacket;
  onExportSection: (packet: SectionExportPacket, format: SectionExportFormat) => void;
  flash: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [busyEvidenceId, setBusyEvidenceId] = useState("");

  async function uploadEvidenceFile(file: File, evidenceId: string) {
    const body = new FormData();
    body.append("file", file);
    body.append("caseId", caseId);
    body.append("evidenceId", evidenceId);

    const response = await fetch("/api/records/evidence/upload", {
      method: "POST",
      credentials: "same-origin",
      body,
    });
    const parsed = (await response.json().catch(() => ({}))) as {
      evidence?: Partial<EvidenceItem>;
      error?: string;
      blockers?: string[];
    };

    if (!response.ok) {
      const details = parsed.blockers?.length ? ` ${parsed.blockers.join(" ")}` : "";
      throw new Error(`${parsed.error || "File upload failed."}${details}`);
    }

    if (!parsed.evidence?.storagePath || parsed.evidence.malwareScanStatus !== "clean") {
      throw new Error("File upload response was incomplete.");
    }

    return parsed.evidence;
  }

  async function addEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    if (!(file instanceof File)) return flash("Choose a file to attach.");

    const validation = validateEvidenceFile({
      originalFileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
    if (!validation.ok) return flash(validation.error);

    const id = createId("evidence");
    let uploaded: Partial<EvidenceItem> | undefined;

    try {
      setUploading(true);
      uploaded =
        recordsStorageMode === "supabase" ? await uploadEvidenceFile(file, id) : undefined;

      const now = nowIso();
      await updateDataset((current) =>
        withAudit(
          {
            ...current,
            evidenceItems: [
              {
                id,
                caseId,
                userId,
                originalFileName: file.name,
                storedFileName:
                  uploaded?.storedFileName || buildStoredEvidenceName({ id, originalFileName: file.name }),
                fileType: file.type,
                fileSize: file.size,
                storageBucket: uploaded?.storageBucket,
                storagePath: uploaded?.storagePath,
                storageUploadedAt: uploaded?.storageUploadedAt,
                storageSha256: uploaded?.storageSha256,
                uploadedAt: now,
                evidenceDate: text(formData, "evidenceDate") || undefined,
                description: text(formData, "description") || undefined,
                tags: parseTags(text(formData, "tags")),
                includeInReports: formData.get("includeInReports") === "on",
                reviewStatus: "needs_review",
                malwareScanStatus: uploaded?.malwareScanStatus || "pending",
                createdAt: now,
                updatedAt: now,
              },
              ...current.evidenceItems,
            ],
          },
          {
            userId,
            caseId,
            action: "uploaded",
            entityType: "evidenceItem",
            entityId: id,
            metadataSummary:
              recordsStorageMode === "supabase"
                ? "Attached file stored in private storage after malware scanning."
                : "Attached file metadata stored without raw file path or contents.",
          }
        )
      );
      form.reset();
      flash(
        recordsStorageMode === "supabase"
          ? "File uploaded, scanned clean, and metadata saved."
          : "File metadata saved with allow-list validation."
      );
    } catch (error) {
      flash(error instanceof Error ? error.message : "File upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function downloadEvidence(item: EvidenceItem) {
    if (recordsStorageMode !== "supabase" || !item.storagePath) {
      flash("This file record does not have a stored file to download.");
      return;
    }

    setBusyEvidenceId(item.id);
    try {
      const response = await fetch("/api/records/evidence/download", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidence: { id: item.id, caseId: item.caseId } }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "File download failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.originalFileName;
      anchor.click();
      URL.revokeObjectURL(url);
      flash("File downloaded.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "File download failed.");
    } finally {
      setBusyEvidenceId("");
    }
  }

  function downloadEvidenceMetadata() {
    const rows = evidence.map((item) => ({
      file_name: item.originalFileName,
      evidence_date: item.evidenceDate || "",
      uploaded_at: item.uploadedAt,
      file_type: item.fileType,
      file_size_bytes: item.fileSize,
      storage_status: item.storagePath ? "private file" : "metadata only",
      scan_status: item.malwareScanStatus || "pending",
      review_status: evidenceReviewStatusLabels[item.reviewStatus || "needs_review"],
      include_in_reports: item.includeInReports ? "yes" : "no",
      tags: item.tags.join("; "),
      description: item.description || "",
    }));
    downloadTextFile(
      `file-index-${formatLocalDate(new Date(), timezone)}.csv`,
      rowsToCsv(rows),
      "text/csv"
    );
    updateDataset((current) =>
      withAudit(current, {
        userId,
        caseId,
        action: "exported",
        entityType: "evidenceIndex",
        entityId: "file-index",
        metadataSummary: "File attachment metadata index exported.",
      })
    );
    flash("File index downloaded.");
  }

  function printEvidenceSheet(item: EvidenceItem) {
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!printWindow) {
      flash("Popup blocked. Allow popups to print the file sheet.");
      return;
    }

    const rows = [
      ["File name", item.originalFileName],
      ["Record date", item.evidenceDate || ""],
      ["Uploaded", item.uploadedAt],
      ["File type", item.fileType],
      ["File size", `${item.fileSize} bytes`],
      ["Storage", item.storagePath ? "Private file attached" : "Metadata only"],
      ["Scan status", item.malwareScanStatus || "pending"],
      ["Review status", evidenceReviewStatusLabels[item.reviewStatus || "needs_review"]],
      ["Included in reports", item.includeInReports ? "Yes" : "No"],
      ["Tags", item.tags.join(", ")],
      ["Description", item.description || ""],
    ];

    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>File Sheet - ${escapeHtml(item.originalFileName)}</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; margin: 32px; }
            h1 { font-size: 22px; margin: 0 0 8px; }
            p { color: #475569; line-height: 1.5; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; vertical-align: top; text-align: left; }
            th { width: 180px; background: #f8fafc; }
            .notice { border: 1px solid #fde68a; background: #fffbeb; padding: 12px; margin-top: 20px; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>Lost to Found Records File Sheet</h1>
          <p>Private custody records workspace. Use privacy-friendly labels and verify the source document before submission.</p>
          <div class="notice">This sheet is metadata for organizing records. It is not legal advice and does not replace the original document.</div>
          <table>
            <tbody>
              ${rows
                .map(
                  ([label, value]) =>
                    `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>`);
    printWindow.document.close();

    updateDataset((current) =>
      withAudit(current, {
        userId,
        caseId,
        action: "exported",
        entityType: "evidenceItem",
        entityId: item.id,
        metadataSummary: "File attachment metadata print sheet opened.",
      })
    );
    flash("File sheet opened.");
  }

  function updateEvidenceReviewStatus(item: EvidenceItem, reviewStatus: EvidenceReviewStatus) {
    const now = nowIso();
    updateDataset((current) =>
      withAudit(
        {
          ...current,
          evidenceItems: current.evidenceItems.map((record) => {
            if (record.id !== item.id || record.userId !== userId || record.caseId !== caseId) {
              return record;
            }

            return {
              ...record,
              reviewStatus,
              reviewedAt: reviewStatus === "reviewed" ? now : record.reviewedAt,
              submittedAt: reviewStatus === "submitted" ? now : record.submittedAt,
              updatedAt: now,
            };
          }),
        },
        {
          userId,
          caseId,
          action: "updated",
          entityType: "evidenceItem",
          entityId: item.id,
          metadataSummary: `File review status changed to ${evidenceReviewStatusLabels[reviewStatus]}.`,
        }
      )
    );
    flash(`File marked ${evidenceReviewStatusLabels[reviewStatus].toLowerCase()}.`);
  }

  async function deleteEvidence(item: EvidenceItem) {
    if (recordsStorageMode === "supabase" && item.storagePath) {
      setBusyEvidenceId(item.id);
      try {
        const response = await fetch("/api/records/evidence/delete", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evidence: { id: item.id, caseId: item.caseId } }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "File delete failed.");
        }
      } catch (error) {
        flash(error instanceof Error ? error.message : "File delete failed.");
        setBusyEvidenceId("");
        return;
      } finally {
        setBusyEvidenceId("");
      }
    }

    updateDataset((current) =>
      withAudit(
        {
          ...current,
          evidenceItems: current.evidenceItems.filter(
            (record) => !(record.id === item.id && record.userId === userId && record.caseId === caseId)
          ),
        },
        {
          userId,
          caseId,
          action: "deleted",
          entityType: "evidenceItem",
          entityId: item.id,
          metadataSummary:
            recordsStorageMode === "supabase"
              ? "Attached file and metadata record deleted."
              : "Attached file metadata record deleted.",
        }
      )
    );
    flash(recordsStorageMode === "supabase" ? "File and metadata deleted." : "File metadata deleted.");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Panel
        title="Private file attachment"
        action={recordsStorageMode === "supabase" ? "Authenticated storage" : "Safe dev adapter"}
      >
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
          Avoid uploading unnecessary Social Security numbers, full bank account numbers, card
          numbers, or unrelated third-party private information. Supabase mode stores files only
          after authenticated server-side validation and malware scanning; local mode saves metadata
          only.
        </div>
        <form onSubmit={addEvidence} className="grid gap-3">
          <Field label="File">
            <input
              name="file"
              type="file"
              className="input"
              accept=".docx,.pdf,.png,.jpg,.jpeg,.heic,.txt,.csv"
            />
          </Field>
          <Field label="Record date">
            <input name="evidenceDate" type="date" className="input" defaultValue="2026-06-10" />
          </Field>
          <Field label="Description">
            <textarea name="description" className="input min-h-20" />
          </Field>
          <Field label="Tags">
            <input name="tags" className="input" placeholder="exchange, receipt" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input name="includeInReports" type="checkbox" defaultChecked />
            Include in file index for selected reports
          </label>
          <button className="btn-primary" type="submit" disabled={uploading}>
            {uploading
              ? "Scanning and uploading..."
              : recordsStorageMode === "supabase"
                ? "Upload file"
                : "Save file record"}
          </button>
        </form>
      </Panel>

      <div className="space-y-4">
        <SectionExportPanel packet={sectionExport} onExport={onExportSection} />

        <Panel title="File index" action={`${evidence.length} records`}>
          {evidence.length === 0 ? (
            <Empty label="No files attached yet." />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-700">
                  {evidence.filter((item) => (item.reviewStatus || "needs_review") === "needs_review").length} need review
                </p>
                <button type="button" className="btn-secondary" onClick={downloadEvidenceMetadata}>
                  Download index
                </button>
              </div>
              <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
                {evidence.map((item) => (
                <div key={item.id} className="grid gap-3 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-semibold text-slate-950">
                        {item.originalFileName}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.evidenceDate || item.uploadedAt.slice(0, 10)} -{" "}
                        {Math.round(item.fileSize / 1024)} KB - {item.fileType}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <select
                        aria-label={`Review status for ${item.originalFileName}`}
                        value={item.reviewStatus || "needs_review"}
                        onChange={(event) =>
                          updateEvidenceReviewStatus(item, event.target.value as EvidenceReviewStatus)
                        }
                        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700"
                      >
                        {Object.entries(evidenceReviewStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {recordsStorageMode === "supabase" && item.storagePath ? (
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs"
                          disabled={busyEvidenceId === item.id || item.malwareScanStatus !== "clean"}
                          onClick={() => void downloadEvidence(item)}
                        >
                          {busyEvidenceId === item.id ? "Working" : "Download"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn-secondary px-3 py-1.5 text-xs"
                        onClick={() => printEvidenceSheet(item)}
                      >
                        Print sheet
                      </button>
                      <DeleteButton
                        label="Delete"
                        ariaLabel={`Delete file ${item.originalFileName}`}
                        disabled={busyEvidenceId === item.id}
                        onClick={() => void deleteEvidence(item)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill label={`scan: ${item.malwareScanStatus || "pending"}`} />
                    <StatusPill label={evidenceReviewStatusLabels[item.reviewStatus || "needs_review"]} />
                    <StatusPill label={item.storagePath ? "private file" : "metadata only"} />
                    <StatusPill label={item.includeInReports ? "report included" : "not selected"} />
                  </div>
                  {item.reviewedAt || item.submittedAt ? (
                    <p className="text-xs text-slate-500">
                      {item.reviewedAt ? `Reviewed ${item.reviewedAt.slice(0, 10)}. ` : ""}
                      {item.submittedAt ? `Submitted ${item.submittedAt.slice(0, 10)}.` : ""}
                    </p>
                  ) : null}
                </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ChildSupportView({
  updateDataset,
  userId,
  caseId,
  orders,
  payments,
  supportRows,
  supportStats,
  sectionExport,
  onExportSection,
  flash,
}: {
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  userId: string;
  caseId: string;
  orders: ReturnType<typeof useSelectedRecords>["childSupportOrders"];
  payments: ReturnType<typeof useSelectedRecords>["childSupportPayments"];
  supportRows: Array<{ month: string; amountDue: number; amountPaid: number; unpaidBalance: number }>;
  supportStats: ReturnType<typeof calculateChildSupportStats>;
  sectionExport: SectionExportPacket;
  onExportSection: (packet: SectionExportPacket, format: SectionExportFormat) => void;
  flash: (message: string) => void;
}) {
  const firstOrder = orders[0];

  function addOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = childSupportOrderSchema.safeParse({
      orderNickname: text(formData, "orderNickname"),
      orderedAmount: text(formData, "orderedAmount"),
      currency: text(formData, "currency"),
      paymentFrequency: text(formData, "paymentFrequency"),
      dueDayOrSchedule: text(formData, "dueDayOrSchedule"),
      effectiveStartDate: text(formData, "effectiveStartDate"),
      payerLabel: text(formData, "payerLabel"),
      recipientLabel: text(formData, "recipientLabel"),
      paymentMethodExpected: text(formData, "paymentMethodExpected"),
      agencyOrCaseNumber: text(formData, "agencyOrCaseNumber"),
      notes: text(formData, "notes"),
    });
    if (!parsed.success) return flash(parsed.error.issues[0]?.message || "Check the support order form.");

    updateDataset((current) =>
      withAudit(
        {
          ...current,
          childSupportOrders: [
            {
              id: createId("support-order"),
              caseId,
              userId,
              createdAt: nowIso(),
              updatedAt: nowIso(),
              ...emptyToUndefined(parsed.data),
            },
            ...current.childSupportOrders,
          ],
        },
        {
          userId,
          caseId,
          action: "created",
          entityType: "childSupportOrder",
          entityId: "new-support-order",
          metadataSummary: "Child support order created without agency details in audit metadata.",
        }
      )
    );
    event.currentTarget.reset();
    flash("Child support order saved.");
  }

  function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = childSupportPaymentSchema.safeParse({
      childSupportOrderId: text(formData, "childSupportOrderId"),
      dueDate: text(formData, "dueDate"),
      amountDue: text(formData, "amountDue"),
      amountPaid: text(formData, "amountPaid"),
      paymentDate: text(formData, "paymentDate"),
      paymentStatus: text(formData, "paymentStatus"),
      paymentMethod: text(formData, "paymentMethod"),
      referenceNumber: text(formData, "referenceNumber"),
      notes: text(formData, "notes"),
    });
    if (!parsed.success) return flash(parsed.error.issues[0]?.message || "Check the payment form.");

    updateDataset((current) =>
      withAudit(
        {
          ...current,
          childSupportPayments: [
            {
              id: createId("support-payment"),
              caseId,
              userId,
              createdAt: nowIso(),
              updatedAt: nowIso(),
              ...emptyToUndefined(parsed.data),
            },
            ...current.childSupportPayments,
          ],
        },
        {
          userId,
          caseId,
          action: "created",
          entityType: "childSupportPayment",
          entityId: "new-support-payment",
          metadataSummary: "Payment record created without reference number in audit metadata.",
        }
      )
    );
    event.currentTarget.reset();
    flash("Payment record saved.");
  }

  function deleteSupportOrder(orderId: string) {
    if (payments.some((payment) => payment.childSupportOrderId === orderId)) {
      flash("Delete related payment records before deleting this support order.");
      return;
    }

    updateDataset((current) =>
      withAudit(
        {
          ...current,
          childSupportOrders: current.childSupportOrders.filter(
            (item) => !(item.id === orderId && item.userId === userId && item.caseId === caseId)
          ),
        },
        {
          userId,
          caseId,
          action: "deleted",
          entityType: "childSupportOrder",
          entityId: orderId,
          metadataSummary: "Child support order deleted after dependency check.",
        }
      )
    );
    flash("Child support order deleted.");
  }

  function deleteSupportPayment(paymentId: string) {
    updateDataset((current) =>
      withAudit(
        {
          ...current,
          childSupportPayments: current.childSupportPayments.filter(
            (item) => !(item.id === paymentId && item.userId === userId && item.caseId === caseId)
          ),
        },
        {
          userId,
          caseId,
          action: "deleted",
          entityType: "childSupportPayment",
          entityId: paymentId,
          metadataSummary: "Child support payment record deleted.",
        }
      )
    );
    flash("Payment record deleted.");
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total due" value={formatMoney(supportStats.totalDue)} detail="Selected range" />
        <StatCard label="Total paid" value={formatMoney(supportStats.totalPaid)} detail="User-entered records" />
        <StatCard label="Payments marked partial" value={supportStats.partialCount} detail="Selected range" tone="amber" />
        <StatCard label="Payments marked unpaid" value={supportStats.unpaidCount} detail={formatMoney(supportStats.unpaidBalance)} tone="amber" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Panel title="Child support order" action="Documentation only">
            <form onSubmit={addOrder} className="grid gap-3">
              <Field label="Order nickname">
                <input name="orderNickname" className="input" defaultValue="Current support order" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ordered amount">
                  <input name="orderedAmount" type="number" step="0.01" className="input" defaultValue="450" />
                </Field>
                <Field label="Currency">
                  <input name="currency" className="input" defaultValue="USD" />
                </Field>
              </div>
              <Field label="Payment frequency">
                <select name="paymentFrequency" className="input" defaultValue="monthly">
                  <option value="weekly">weekly</option>
                  <option value="biweekly">biweekly</option>
                  <option value="monthly">monthly</option>
                  <option value="semi_monthly">semi monthly</option>
                  <option value="custom">custom</option>
                </select>
              </Field>
              <Field label="Due day or schedule">
                <input name="dueDayOrSchedule" className="input" defaultValue="1st day of each month" />
              </Field>
              <Field label="Effective start">
                <input name="effectiveStartDate" type="date" className="input" defaultValue="2026-06-01" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Payer label">
                  <input name="payerLabel" className="input" defaultValue="Other Parent" />
                </Field>
                <Field label="Recipient label">
                  <input name="recipientLabel" className="input" defaultValue="Me" />
                </Field>
              </div>
              <Field label="Expected method">
                <input name="paymentMethodExpected" className="input" placeholder="State agency, wage withholding" />
              </Field>
              <Field label="Agency or case number">
                <input name="agencyOrCaseNumber" className="input" placeholder="Treat as sensitive" />
              </Field>
              <Field label="Notes">
                <textarea name="notes" className="input min-h-20" />
              </Field>
              <button className="btn-primary" type="submit">
                Save support order
              </button>
            </form>
          </Panel>

          <Panel title="Log payment record" action="No payment processing">
            <form onSubmit={addPayment} className="grid gap-3">
              <Field label="Order">
                <select name="childSupportOrderId" className="input" defaultValue={firstOrder?.id}>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNickname}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Due date">
                  <input name="dueDate" type="date" className="input" defaultValue="2026-06-01" />
                </Field>
                <Field label="Payment date">
                  <input name="paymentDate" type="date" className="input" />
                </Field>
                <Field label="Amount due">
                  <input name="amountDue" type="number" step="0.01" className="input" defaultValue={firstOrder?.orderedAmount || 0} />
                </Field>
                <Field label="Amount paid">
                  <input name="amountPaid" type="number" step="0.01" className="input" defaultValue="0" />
                </Field>
              </div>
              <Field label="Status">
                <select name="paymentStatus" className="input" defaultValue="unpaid">
                  {paymentStatuses.map((status) => (
                    <option key={status} value={status}>
                      {labelPaymentStatus(status)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Payment method">
                <select name="paymentMethod" className="input" defaultValue="unknown">
                  {[
                    "state_agency",
                    "wage_withholding",
                    "bank_transfer",
                    "check",
                    "cash",
                    "money_order",
                    "payment_app",
                    "other",
                    "unknown",
                  ].map((method) => (
                    <option key={method} value={method}>
                      {method.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reference number">
                <input name="referenceNumber" className="input" placeholder="Do not enter full bank/card numbers" />
              </Field>
              <Field label="Notes">
                <textarea name="notes" className="input min-h-20" />
              </Field>
              <button className="btn-primary" type="submit">
                Save payment record
              </button>
            </form>
          </Panel>
        </div>

        <div className="space-y-4">
          <SectionExportPanel packet={sectionExport} onExport={onExportSection} />

          <Panel title="Support orders" action={`${orders.length} saved`}>
            <Table
              headers={["Order", "Amount", "Frequency", "Payer", "Recipient", "Action"]}
              rows={orders.map((order) => [
                order.orderNickname,
                formatMoney(order.orderedAmount, order.currency),
                order.paymentFrequency.replaceAll("_", " "),
                order.payerLabel,
                order.recipientLabel,
                <DeleteButton
                  key={order.id}
                  label="Delete"
                  ariaLabel={`Delete support order ${order.orderNickname}`}
                  onClick={() => deleteSupportOrder(order.id)}
                />,
              ])}
            />
          </Panel>

          <Panel title="Payment history by month" action="Due vs paid">
            <SupportTrendLine rows={supportRows} />
          </Panel>
          <Panel title="Payment records" action={`${payments.length} records`}>
            <Table
              headers={["Due date", "Due", "Paid", "Payment date", "Status", "Action"]}
              rows={payments.map((payment) => [
                payment.dueDate,
                formatMoney(payment.amountDue),
                formatMoney(payment.amountPaid),
                payment.paymentDate || "",
                <StatusPill key={payment.id} label={labelPaymentStatus(payment.paymentStatus)} />,
                <DeleteButton
                  key={payment.id}
                  label="Delete"
                  ariaLabel={`Delete payment record ${payment.dueDate}`}
                  onClick={() => deleteSupportPayment(payment.id)}
                />,
              ])}
            />
          </Panel>
        </div>
      </section>
    </div>
  );
}

function ExpensesView({
  updateDataset,
  userId,
  caseId,
  expenses,
  expenseStats,
  sectionExport,
  onExportSection,
  flash,
}: {
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  userId: string;
  caseId: string;
  expenses: ReturnType<typeof useSelectedRecords>["expenseItems"];
  expenseStats: ReturnType<typeof calculateExpenseStats>;
  sectionExport: SectionExportPacket;
  onExportSection: (packet: SectionExportPacket, format: SectionExportFormat) => void;
  flash: (message: string) => void;
}) {
  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = expenseItemSchema.safeParse({
      expenseDate: text(formData, "expenseDate"),
      category: text(formData, "category"),
      description: text(formData, "description"),
      amount: text(formData, "amount"),
      currency: text(formData, "currency"),
      paidByLabel: text(formData, "paidByLabel"),
      reimbursementRequested: formData.get("reimbursementRequested") === "on",
      reimbursementDueDate: text(formData, "reimbursementDueDate"),
      amountReimbursed: Number(text(formData, "amountReimbursed") || 0),
      reimbursementDate: text(formData, "reimbursementDate"),
      reimbursementStatus: text(formData, "reimbursementStatus"),
      notes: text(formData, "notes"),
    });
    if (!parsed.success) return flash(parsed.error.issues[0]?.message || "Check the expense form.");

    updateDataset((current) =>
      withAudit(
        {
          ...current,
          expenseItems: [
            {
              id: createId("expense"),
              userId,
              caseId,
              createdAt: nowIso(),
              updatedAt: nowIso(),
              ...emptyToUndefined(parsed.data),
            },
            ...current.expenseItems,
          ],
        },
        {
          userId,
          caseId,
          action: "created",
          entityType: "expenseItem",
          entityId: "new-expense",
          metadataSummary: "Expense item created without receipt contents in audit metadata.",
        }
      )
    );
    event.currentTarget.reset();
    flash("Expense record saved.");
  }

  function deleteExpense(expenseId: string) {
    updateDataset((current) =>
      withAudit(
        {
          ...current,
          expenseItems: current.expenseItems.filter(
            (item) => !(item.id === expenseId && item.userId === userId && item.caseId === caseId)
          ),
        },
        {
          userId,
          caseId,
          action: "deleted",
          entityType: "expenseItem",
          entityId: expenseId,
          metadataSummary: "Expense record deleted.",
        }
      )
    );
    flash("Expense record deleted.");
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total expenses" value={formatMoney(expenseStats.totalExpenses)} detail="Selected range" />
        <StatCard label="Reimbursement requested" value={formatMoney(expenseStats.reimbursementRequested)} detail="User-entered records" />
        <StatCard label="Reimbursement received" value={formatMoney(expenseStats.reimbursementReceived)} detail="User-entered records" />
        <StatCard label="Unpaid reimbursement" value={formatMoney(expenseStats.unpaidReimbursement)} detail="Based on records" tone="amber" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Panel title="Add expense record" action="Custody-related expense">
          <form onSubmit={addExpense} className="grid gap-3">
            <Field label="Expense date">
              <input name="expenseDate" type="date" className="input" defaultValue="2026-06-05" />
            </Field>
            <Field label="Category">
              <select name="category" className="input" defaultValue="school">
                {["medical", "school", "childcare", "extracurricular", "transportation", "clothing", "supplies", "other"].map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <input name="description" className="input" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Amount">
                <input name="amount" type="number" step="0.01" className="input" />
              </Field>
              <Field label="Currency">
                <input name="currency" className="input" defaultValue="USD" />
              </Field>
            </div>
            <Field label="Paid by label">
              <input name="paidByLabel" className="input" defaultValue="Me" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input name="reimbursementRequested" type="checkbox" defaultChecked />
              Reimbursement requested
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Due date">
                <input name="reimbursementDueDate" type="date" className="input" />
              </Field>
              <Field label="Amount reimbursed">
                <input name="amountReimbursed" type="number" step="0.01" className="input" defaultValue="0" />
              </Field>
            </div>
            <Field label="Reimbursement status">
              <select name="reimbursementStatus" className="input" defaultValue="requested">
                {[
                  "not_requested",
                  "requested",
                  "partially_reimbursed",
                  "reimbursed",
                  "unpaid",
                  "disputed",
                  "unknown",
                ].map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes">
              <textarea name="notes" className="input min-h-20" />
            </Field>
            <button className="btn-primary" type="submit">
              Save expense
            </button>
          </form>
        </Panel>

        <div className="space-y-4">
          <SectionExportPanel packet={sectionExport} onExport={onExportSection} />

          <Panel title="Expenses by category" action={`${expenses.length} records`}>
            <ExpenseCategoryChart rows={expenseStats.byCategory} />
          </Panel>
          <Panel title="Expense records" action="Files can be attached separately">
            <Table
              headers={["Date", "Category", "Description", "Amount", "Reimbursement", "Action"]}
              rows={expenses.map((expense) => [
                expense.expenseDate,
                expense.category,
                expense.description,
                formatMoney(expense.amount),
                expense.reimbursementStatus.replaceAll("_", " "),
                <DeleteButton
                  key={expense.id}
                  label="Delete"
                  ariaLabel={`Delete expense ${expense.description}`}
                  onClick={() => deleteExpense(expense.id)}
                />,
              ])}
            />
          </Panel>
        </div>
      </section>
    </div>
  );
}

function ReportsView({
  reportType,
  setReportType,
  preview,
  userId,
  caseId,
  range,
  updateDataset,
  flash,
}: {
  reportType: ReportType;
  setReportType: (type: ReportType) => void;
  preview: ReturnType<typeof buildReportPreview>;
  userId: string;
  caseId: string;
  range: DateRange;
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  flash: (message: string) => void;
}) {
  const [exportReview, setExportReview] = useState<Record<ExportReviewKey, boolean>>({
    neutralLabels: false,
    paymentRefs: false,
    notes: false,
  });
  const exportReviewComplete = exportReviewItems.every((item) => exportReview[item.key]);
  const selectedReportOption =
    reportsTabReportTypes.find((item) => item.value === reportType) || reportsTabReportTypes[0];

  function toggleExportReview(key: ExportReviewKey, checked: boolean) {
    setExportReview((current) => ({ ...current, [key]: checked }));
  }

  function downloadCsv() {
    if (!exportReviewComplete) {
      flash("Complete the pre-export review first.");
      return;
    }
    const csv = reportPreviewToCsv(preview);
    downloadTextFile(`lost-to-found-records-${reportType}-${range.from}-${range.to}.csv`, csv, "text/csv");
    updateDataset((current) =>
      withAudit(current, {
        userId,
        caseId,
        action: "exported",
        entityType: "report",
        entityId: reportType,
        metadataSummary: "CSV report exported without sensitive row contents in audit metadata.",
      })
    );
    flash("CSV report downloaded.");
  }

  function downloadJson() {
    if (!exportReviewComplete) {
      flash("Complete the pre-export review first.");
      return;
    }
    const body = JSON.stringify({ report: preview, dataScope: { userId, caseId, range } }, null, 2);
    downloadTextFile(
      `lost-to-found-records-${reportType}-${range.from}-${range.to}.json`,
      body,
      "application/json"
    );
    updateDataset((current) =>
      withAudit(current, {
        userId,
        caseId,
        action: "exported",
        entityType: "report",
        entityId: reportType,
        metadataSummary: "Structured report JSON exported without sensitive row contents in audit metadata.",
      })
    );
    flash("Structured report JSON downloaded.");
  }

  function printPdf() {
    if (!exportReviewComplete) {
      flash("Complete the pre-export review first.");
      return;
    }
    updateDataset((current) =>
      withAudit(current, {
        userId,
        caseId,
        action: "exported",
        entityType: "report",
        entityId: reportType,
        metadataSummary: "Printable report opened for PDF save.",
      })
    );
    window.print();
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[360px_1fr]">
      <Panel title="Report builder" action="Issue-focused">
        <div className="grid gap-3">
          <Field label="Report type">
            <select
              value={reportType}
              onChange={(event) => setReportType(event.target.value as ReportType)}
              className="input"
            >
              {reportsTabReportTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          {selectedReportOption && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
              <p className="font-semibold text-slate-950">{selectedReportOption.label}</p>
              <p>{selectedReportOption.description}</p>
            </div>
          )}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-950">Pre-export privacy review</p>
            <div className="mt-3 space-y-2">
              {exportReviewItems.map((item) => (
                <label key={item.key} className="flex items-start gap-2 text-xs leading-5 text-amber-950">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={exportReview[item.key]}
                    onChange={(event) => toggleExportReview(item.key, event.target.checked)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
          <button className="btn-primary" type="button" onClick={downloadCsv} disabled={!exportReviewComplete}>
            Download CSV
          </button>
          <button className="btn-secondary" type="button" onClick={printPdf} disabled={!exportReviewComplete}>
            Print or save PDF
          </button>
          <button className="btn-secondary" type="button" onClick={downloadJson} disabled={!exportReviewComplete}>
            Download report JSON
          </button>
          <p className="text-xs leading-5 text-slate-500">
            CSV includes report metrics, chart data, and table rows. PDF output uses your browser print dialog.
            Downloaded reports leave protected storage.
          </p>
        </div>
      </Panel>

      <Panel title={preview.title} action={preview.caseName}>
        <article className="report-surface space-y-5">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {range.from} to {range.to}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              {preview.title}
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-800">{preview.focus}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{preview.disclaimer}</p>
            <p className="mt-2 text-xs text-slate-500">Generated {preview.generatedAt}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {preview.metrics.map((metric) => (
              <StatMini key={metric.label} label={metric.label} value={String(metric.value)} />
            ))}
          </div>
          <div className="grid gap-3">
            {preview.summaries.map((summary) => (
              <p key={summary} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                {summary}
              </p>
            ))}
          </div>
          <div className="grid gap-3">
            {preview.charts.map((chart) => (
              <ReportPreviewChartCard key={chart.title} chart={chart} />
            ))}
          </div>
          <div className="space-y-4">
            {preview.tables.map((table) => (
              <div key={table.title}>
                <h3 className="mb-2 text-sm font-semibold text-slate-950">{table.title}</h3>
                <Table headers={table.headers} rows={table.rows.slice(0, 24)} />
                {table.rows.length > 24 && (
                  <p className="mt-2 text-xs text-slate-500">
                    {table.rows.length - 24} more rows included in CSV/JSON export.
                  </p>
                )}
              </div>
            ))}
          </div>
          {preview.evidenceIndex.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-950">Supporting file index</h3>
              <Table
                headers={["Index", "File", "Date", "Description", "Tags", "Scan", "Storage"]}
                rows={preview.evidenceIndex.map((item) => [
                  item.index,
                  item.fileName,
                  item.evidenceDate,
                  item.description,
                  item.tags,
                  item.scanStatus,
                  item.storageStatus,
                ])}
              />
            </div>
          )}
        </article>
      </Panel>
    </div>
  );
}

function SettingsView({
  dataset,
  updateDataset,
  resetDemoData,
  selected,
  userId,
  caseId,
  setSelectedCaseId,
  logout,
  flash,
  storageStatus,
  recordsStorageMode,
}: {
  dataset: RecordsDataset;
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  resetDemoData: () => void;
  selected: ReturnType<typeof useSelectedRecords>;
  userId: string;
  caseId: string;
  setSelectedCaseId: (caseId: string) => void;
  logout: () => void;
  flash: (message: string) => void;
  storageStatus: string;
  recordsStorageMode: "local" | "supabase";
}) {
  const profile = dataset.users.find((user) => user.userId === userId);
  const selectedMatter = selected.matter;

  function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsedTimezone = timezoneSchema.safeParse(
      text(formData, "timezone") || profile?.timezone || defaultRecordsTimezone
    );
    if (!parsedTimezone.success) return flash(parsedTimezone.error.issues[0]?.message || "Check the timezone.");

    updateDataset((current) => ({
      ...current,
      users: current.users.map((user) =>
        user.userId === userId
          ? {
              ...user,
              displayName: text(formData, "displayName") || undefined,
              timezone: parsedTimezone.data,
              updatedAt: nowIso(),
            }
          : user
      ),
    }));
    flash("Account settings updated.");
  }

  function createMatter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = custodyMatterSchema.safeParse({
      caseName: text(formData, "caseName"),
      courtOrOrderNickname: text(formData, "courtOrOrderNickname"),
      courtName: text(formData, "courtName"),
      orderDate: text(formData, "orderDate"),
      effectiveStartDate: text(formData, "effectiveStartDate"),
      childDisplayLabels: parseTags(text(formData, "childDisplayLabels")),
      userRoleLabel: text(formData, "userRoleLabel"),
      otherParentLabel: text(formData, "otherParentLabel"),
      defaultExchangeLocation: text(formData, "defaultExchangeLocation"),
      timezone: text(formData, "timezone") || profile?.timezone || "America/Anchorage",
      notes: text(formData, "notes"),
    });
    if (!parsed.success) return flash(parsed.error.issues[0]?.message || "Check the custody matter form.");

    const id = createId("case");
    updateDataset((current) =>
      withAudit(
        {
          ...current,
          matters: [
            {
              id,
              userId,
              createdAt: nowIso(),
              updatedAt: nowIso(),
              ...emptyToUndefined(parsed.data),
            },
            ...current.matters,
          ],
        },
        {
          userId,
          caseId: id,
          action: "created",
          entityType: "custodyMatter",
          entityId: id,
          metadataSummary: "Custody matter created without court or child labels in audit metadata.",
        }
      )
    );
    setSelectedCaseId(id);
    flash("Custody matter created.");
  }

  function updateMatter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMatter) return flash("Select a custody matter first.");

    const formData = new FormData(event.currentTarget);
    const parsed = custodyMatterSchema.safeParse({
      caseName: text(formData, "caseName"),
      courtOrOrderNickname: text(formData, "courtOrOrderNickname"),
      courtName: text(formData, "courtName"),
      orderDate: text(formData, "orderDate"),
      effectiveStartDate: text(formData, "effectiveStartDate"),
      effectiveEndDate: text(formData, "effectiveEndDate"),
      childDisplayLabels: parseTags(text(formData, "childDisplayLabels")),
      userRoleLabel: text(formData, "userRoleLabel"),
      otherParentLabel: text(formData, "otherParentLabel"),
      defaultExchangeLocation: text(formData, "defaultExchangeLocation"),
      timezone: text(formData, "timezone") || profile?.timezone || defaultRecordsTimezone,
      notes: text(formData, "notes"),
    });
    if (!parsed.success) return flash(parsed.error.issues[0]?.message || "Check the selected case form.");

    updateDataset((current) =>
      withAudit(
        {
          ...current,
          matters: current.matters.map((matter) =>
            matter.id === selectedMatter.id && matter.userId === userId
              ? {
                  ...matter,
                  ...emptyToUndefined(parsed.data),
                  updatedAt: nowIso(),
                }
              : matter
          ),
        },
        {
          userId,
          caseId: selectedMatter.id,
          action: "updated",
          entityType: "custodyMatter",
          entityId: selectedMatter.id,
          metadataSummary: "Custody matter settings updated without court or child labels in audit metadata.",
        }
      )
    );
    flash("Selected case settings updated.");
  }

  function deleteCase() {
    updateDataset((current) => ({
      ...current,
      matters: current.matters.filter((item) => item.id !== caseId || item.userId !== userId),
      exchangeRules: current.exchangeRules.filter((item) => item.caseId !== caseId || item.userId !== userId),
      scheduleExceptions: current.scheduleExceptions.filter((item) => item.caseId !== caseId || item.userId !== userId),
      custodyDayAssignments: current.custodyDayAssignments.filter(
        (item) => item.caseId !== caseId || item.userId !== userId
      ),
      exchangeLogs: current.exchangeLogs.filter((item) => item.caseId !== caseId || item.userId !== userId),
      dateNotes: current.dateNotes.filter((item) => item.caseId !== caseId || item.userId !== userId),
      evidenceItems: current.evidenceItems.filter((item) => item.caseId !== caseId || item.userId !== userId),
      childSupportOrders: current.childSupportOrders.filter((item) => item.caseId !== caseId || item.userId !== userId),
      childSupportPayments: current.childSupportPayments.filter((item) => item.caseId !== caseId || item.userId !== userId),
      expenseItems: current.expenseItems.filter((item) => item.caseId !== caseId || item.userId !== userId),
    }));
    setSelectedCaseId(selected.matters.find((matter) => matter.id !== caseId)?.id || demoCaseId);
    flash("Selected case deleted.");
  }

  function exportData() {
    const scoped = {
      user: profile,
      matters: selected.matters,
      exchangeRules: selected.exchangeRules,
      scheduleExceptions: dataset.scheduleExceptions.filter(
        (item) => item.userId === userId && item.caseId === caseId
      ),
      custodyDayAssignments: selected.custodyDayAssignments,
      exchangeLogs: selected.exchangeLogs,
      dateNotes: selected.dateNotes,
      evidenceItems: selected.evidenceItems,
      childSupportOrders: selected.childSupportOrders,
      childSupportPayments: selected.childSupportPayments,
      expenseItems: selected.expenseItems,
      auditLogs: selected.auditLogs,
    };
    downloadTextFile("lost-to-found-records-user-export.json", JSON.stringify(scoped, null, 2), "application/json");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <datalist id="records-timezone-options">
        {recordsTimezoneOptions.map((timezone) => (
          <option key={timezone} value={timezone} />
        ))}
      </datalist>
      <div className="space-y-4">
        <Panel title="Account settings" action="MFA-ready structure">
          <form onSubmit={updateProfile} className="grid gap-3">
            <Field label="Display name">
              <input name="displayName" className="input" defaultValue={profile?.displayName || ""} />
            </Field>
            <Field label="Email">
              <input className="input bg-slate-100" value={profile?.email || ""} readOnly />
            </Field>
            <Field label="Timezone">
              <input
                name="timezone"
                className="input"
                defaultValue={profile?.timezone || defaultRecordsTimezone}
                list="records-timezone-options"
              />
            </Field>
            <button className="btn-primary" type="submit">
              Update profile
            </button>
          </form>
        </Panel>

        <Panel title="Selected case settings" action="Calendar timezone">
          {selectedMatter ? (
            <form onSubmit={updateMatter} className="grid gap-3">
              <Field label="Case name">
                <input name="caseName" className="input" defaultValue={selectedMatter.caseName} />
              </Field>
              <Field label="Order nickname">
                <input name="courtOrOrderNickname" className="input" defaultValue={selectedMatter.courtOrOrderNickname || ""} />
              </Field>
              <Field label="Court name">
                <input name="courtName" className="input" defaultValue={selectedMatter.courtName || ""} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Order date">
                  <input name="orderDate" type="date" className="input" defaultValue={selectedMatter.orderDate || ""} />
                </Field>
                <Field label="Effective start">
                  <input
                    name="effectiveStartDate"
                    type="date"
                    className="input"
                    defaultValue={selectedMatter.effectiveStartDate || ""}
                  />
                </Field>
                <Field label="Effective end">
                  <input
                    name="effectiveEndDate"
                    type="date"
                    className="input"
                    defaultValue={selectedMatter.effectiveEndDate || ""}
                  />
                </Field>
              </div>
              <Field label="Child labels">
                <input
                  name="childDisplayLabels"
                  className="input"
                  defaultValue={selectedMatter.childDisplayLabels.join(", ")}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Your label">
                  <input name="userRoleLabel" className="input" defaultValue={selectedMatter.userRoleLabel} />
                </Field>
                <Field label="Other parent label">
                  <input name="otherParentLabel" className="input" defaultValue={selectedMatter.otherParentLabel} />
                </Field>
              </div>
              <Field label="Default exchange location">
                <input
                  name="defaultExchangeLocation"
                  className="input"
                  defaultValue={selectedMatter.defaultExchangeLocation || ""}
                />
              </Field>
              <Field label="Case timezone">
                <input
                  name="timezone"
                  className="input"
                  defaultValue={selectedMatter.timezone || profile?.timezone || defaultRecordsTimezone}
                  list="records-timezone-options"
                />
              </Field>
              <Field label="Notes">
                <textarea name="notes" className="input min-h-20" defaultValue={selectedMatter.notes || ""} />
              </Field>
              <button className="btn-primary" type="submit">
                Save selected case
              </button>
            </form>
          ) : (
            <p className="text-sm leading-6 text-slate-600">Create or select a custody matter before setting a case timezone.</p>
          )}
        </Panel>

        <Panel title="Create custody matter" action="Privacy-friendly labels">
          <form onSubmit={createMatter} className="grid gap-3">
            <Field label="Case name">
              <input name="caseName" className="input" placeholder="Parenting Plan Records" />
            </Field>
            <Field label="Order nickname">
              <input name="courtOrOrderNickname" className="input" />
            </Field>
            <Field label="Court name">
              <input name="courtName" className="input" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Order date">
                <input name="orderDate" type="date" className="input" />
              </Field>
              <Field label="Effective start">
                <input name="effectiveStartDate" type="date" className="input" />
              </Field>
            </div>
            <Field label="Child labels">
              <input name="childDisplayLabels" className="input" defaultValue="Child 1, Child 2" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Your label">
                <input name="userRoleLabel" className="input" defaultValue="Me" />
              </Field>
              <Field label="Other parent label">
                <input name="otherParentLabel" className="input" defaultValue="Other Parent" />
              </Field>
            </div>
            <Field label="Default exchange location">
              <input name="defaultExchangeLocation" className="input" />
            </Field>
            <Field label="Timezone">
              <input
                name="timezone"
                className="input"
                defaultValue={profile?.timezone || defaultRecordsTimezone}
                list="records-timezone-options"
              />
            </Field>
            <Field label="Notes">
              <textarea name="notes" className="input min-h-20" />
            </Field>
            <button className="btn-primary" type="submit">
              Create matter
            </button>
          </form>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Storage status" action={recordsStorageMode === "supabase" ? "Private cloud" : "This browser"}>
          <div className="space-y-3 text-sm leading-6 text-slate-600">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Storage mode</p>
                <p className="mt-1 font-medium text-slate-900">
                  {recordsStorageMode === "supabase" ? "Private cloud storage" : "This browser"}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last status</p>
                <p className="mt-1 font-medium text-slate-900">{storageStatus}</p>
              </div>
            </div>
            <p>
              Records are saved behind authenticated server routes when cloud storage is active.
              Browser-only mode is for private drafting on this device.
            </p>
          </div>
        </Panel>

        <Panel title="Session management" action="Account access">
          <div className="grid gap-3 text-sm leading-6 text-slate-600">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed in as</p>
                <p className="mt-1 font-medium text-slate-900">{profile?.email || "Demo user"}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Session storage</p>
                <p className="mt-1 font-medium text-slate-900">
                  {recordsStorageMode === "supabase" ? "HttpOnly cookie" : "This browser only"}
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={logout} className="btn-secondary">
                Clear session
              </button>
              <button
                type="button"
                onClick={() => {
                  clearFailedLoginAttempts();
                  flash("Demo login lockout counter reset.");
                }}
                className="btn-secondary"
              >
                Reset lockout counter
              </button>
            </div>
            <p>Use the session controls when switching accounts or stepping away from this device.</p>
          </div>
        </Panel>

        <Panel title="User data controls" action="Private by default">
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={exportData} className="btn-secondary">
              Export my data
            </button>
            <button type="button" onClick={deleteCase} className="btn-secondary">
              Delete selected case
            </button>
            <button type="button" onClick={resetDemoData} className="btn-secondary">
              {recordsStorageMode === "supabase" ? "Clear workspace data" : "Reset synthetic demo data"}
            </button>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Export your data before major cleanup. Deleting the selected case removes its records
            from this workspace.
          </p>
        </Panel>

        <Panel title="Workspace setup" action="Recommended order">
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-600">
            <li>Create a custody matter with neutral labels for the children and parents.</li>
            <li>Add the standing exchange rules and any schedule exceptions from the order.</li>
            <li>Use the calendar to color custody days and log exchanges as they happen.</li>
            <li>Attach files only when they support a specific date, note, expense, or exchange.</li>
            <li>Review the Reports tab before exporting anything for another person or agency.</li>
          </ol>
        </Panel>

        <Panel title="Session and security notes" action="Privacy defaults">
          <div className="space-y-3 text-sm leading-6 text-slate-600">
            <p>No child accounts, public profiles, social features, co-parent messaging, advertising trackers, or session replay are included.</p>
            <p>Cloud storage uses server-side auth routes and HttpOnly cookies instead of browser-stored access tokens.</p>
            <p>Attached files use server-mediated private object storage, require a clean malware scan before download, and never expose public or anonymous share links.</p>
          </div>
        </Panel>

        <Panel title="Audit trail" action={`${selected.auditLogs.length} entries`}>
          <Table
            headers={["Time", "Action", "Entity", "Summary"]}
            rows={selected.auditLogs.slice(0, 10).map((audit) => [
              audit.timestamp,
              audit.action.replaceAll("_", " "),
              audit.entityType,
              audit.metadataSummary,
            ])}
          />
        </Panel>
      </div>
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
      {disclaimer}
    </div>
  );
}

function RangeToolbar({
  range,
  setRange,
  timezone,
}: {
  range: DateRange;
  setRange: (range: DateRange) => void;
  timezone: string;
}) {
  const [preset, setPreset] = useState<DateRangePreset | "custom">(defaultRangePreset);

  useEffect(() => {
    if (preset !== "custom") {
      setRange(buildDateRangePreset(preset, new Date(), timezone));
    }
  }, [preset, setRange, timezone]);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <select
        className="h-10 min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
        onChange={(event) => {
          const value = event.target.value as DateRangePreset | "custom";
          setPreset(value);
          if (value !== "custom") setRange(buildDateRangePreset(value, new Date(), timezone));
        }}
        value={preset}
        aria-label="Date range preset"
      >
        <option value="currentMonth">Current month</option>
        <option value="last30">Last 30 days</option>
        <option value="last90">Last 90 days</option>
        <option value="priorMonth">Prior month</option>
        <option value="ytd">Year to date</option>
        <option value="custom">Custom range</option>
      </select>
      <input
        aria-label="From date"
        type="date"
        value={range.from}
        onChange={(event) => {
          setPreset("custom");
          setRange({ ...range, from: event.target.value });
        }}
        className="h-10 min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
      />
      <input
        aria-label="To date"
        type="date"
        value={range.to}
        onChange={(event) => {
          setPreset("custom");
          setRange({ ...range, to: event.target.value });
        }}
        className="h-10 min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
      />
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {action && <span className="text-xs font-medium text-slate-500">{action}</span>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function StatCard({
  label,
  value,
  detail,
  tone = "teal",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "teal" | "amber" | "slate";
}) {
  const color =
    tone === "amber"
      ? "text-amber-700"
      : tone === "slate"
        ? "text-slate-700"
        : "text-teal-700";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function SectionExportPanel({
  packet,
  onExport,
}: {
  packet: SectionExportPacket;
  onExport: (packet: SectionExportPacket, format: SectionExportFormat) => void;
}) {
  return (
    <Panel title="Lawyer/court export" action="Summary + charts">
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {packet.metrics.slice(0, 4).map((metric) => (
            <StatMini key={metric.label} label={metric.label} value={String(metric.value)} />
          ))}
        </div>

        <div className="space-y-3">
          {packet.charts.slice(0, 2).map((chart) => (
            <PacketChart key={chart.title} chart={chart} />
          ))}
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Best use</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">
            {packet.suggestedUses.slice(0, 2).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" className="btn-primary" onClick={() => onExport(packet, "pdf")}>
            Print / save PDF
          </button>
          <button type="button" className="btn-secondary" onClick={() => onExport(packet, "csv")}>
            Download CSV
          </button>
          <button type="button" className="btn-secondary" onClick={() => onExport(packet, "json")}>
            Download JSON
          </button>
        </div>
        <p className="text-xs leading-5 text-slate-500">
          Exports leave protected storage. Review names, account numbers, and third-party details before sharing.
        </p>
      </div>
    </Panel>
  );
}

function PacketChart({ chart }: { chart: SectionExportPacket["charts"][number] }) {
  if (chart.rows.length === 0) return <Empty label="No chart data for this range." />;
  const values = chart.rows.flatMap((row) =>
    [row.value, row.secondaryValue, row.tertiaryValue].filter((value): value is number => typeof value === "number")
  );
  const max = Math.max(1, ...values.map((value) => Math.abs(value)));
  const shownRows = chart.rows.slice(0, 8);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{chart.title}</h3>
          {chart.description && <p className="mt-1 text-xs leading-5 text-slate-500">{chart.description}</p>}
        </div>
        {chart.unit && <span className="text-xs font-medium text-slate-500">{chart.unit}</span>}
      </div>
      <div className="mt-3 space-y-2">
        {shownRows.map((row) => (
          <div key={row.label} className="grid gap-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-medium text-slate-700">{row.label}</span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {formatChartValue(row.value, chart.unit)}
                {typeof row.secondaryValue === "number" ? ` / ${formatChartValue(row.secondaryValue, chart.unit)}` : ""}
                {typeof row.tertiaryValue === "number" ? ` / ${formatChartValue(row.tertiaryValue, chart.unit)}` : ""}
              </span>
            </div>
            <div className="space-y-1">
              <ChartBar value={row.value} max={max} tone={row.value < 0 ? "teal" : "amber"} />
              {typeof row.secondaryValue === "number" && (
                <ChartBar value={row.secondaryValue} max={max} tone="blue" />
              )}
              {typeof row.tertiaryValue === "number" && (
                <ChartBar value={row.tertiaryValue} max={max} tone="slate" />
              )}
            </div>
          </div>
        ))}
      </div>
      {chart.rows.length > shownRows.length && (
        <p className="mt-2 text-xs text-slate-500">{chart.rows.length - shownRows.length} more rows included in export.</p>
      )}
    </div>
  );
}

function ChartBar({
  value,
  max,
  tone,
}: {
  value: number;
  max: number;
  tone: "amber" | "blue" | "slate" | "teal";
}) {
  const width = `${Math.max(4, Math.min(100, (Math.abs(value) / max) * 100))}%`;
  const color =
    tone === "blue"
      ? "bg-blue-600"
      : tone === "slate"
        ? "bg-slate-500"
        : tone === "teal"
          ? "bg-teal-600"
          : "bg-amber-500";
  return (
    <div className="h-2 rounded-full bg-slate-100">
      <div className={`h-2 rounded-full ${color}`} style={{ width }} />
    </div>
  );
}

function formatChartValue(value: number, unit?: string) {
  if (unit === "USD") return formatMoney(value);
  if (unit === "minutes") return `${value} min`;
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded px-3 py-1.5 text-sm font-semibold ${
            value === option.value ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function timelinePrimaryRecordId(event: CalendarEvent) {
  return event.relatedIds?.[0];
}

function canDeleteTimelineEvent(event: CalendarEvent) {
  return directTimelineDeleteTypes.has(event.type) && Boolean(timelinePrimaryRecordId(event));
}

function removeOwnedRecordById<T extends { id: string; userId: string; caseId: string }>(
  records: T[],
  recordId: string,
  userId: string,
  caseId: string
) {
  return records.filter(
    (record) => !(record.id === recordId && record.userId === userId && record.caseId === caseId)
  );
}

function deleteTimelineEventFromDataset(
  dataset: RecordsDataset,
  event: CalendarEvent,
  userId: string,
  caseId: string
) {
  const recordId = timelinePrimaryRecordId(event);
  if (!recordId) return dataset;

  const auditBase = {
    userId,
    caseId,
    action: "deleted" as const,
    entityId: recordId,
    metadataSummary: `${labelEventType(event.type)} removed from timeline.`,
  };

  if (event.type === "logged_exchange") {
    return withAudit(
      {
        ...dataset,
        exchangeLogs: removeOwnedRecordById(dataset.exchangeLogs, recordId, userId, caseId),
      },
      { ...auditBase, entityType: "exchangeLog" }
    );
  }

  if (event.type === "custody_note") {
    return withAudit(
      {
        ...dataset,
        dateNotes: removeOwnedRecordById(dataset.dateNotes, recordId, userId, caseId),
      },
      { ...auditBase, entityType: "dateNote" }
    );
  }

  if (event.type === "child_support_due" || event.type === "child_support_paid") {
    return withAudit(
      {
        ...dataset,
        childSupportPayments: removeOwnedRecordById(
          dataset.childSupportPayments,
          recordId,
          userId,
          caseId
        ),
      },
      { ...auditBase, entityType: "childSupportPayment" }
    );
  }

  if (event.type === "expense_item") {
    return withAudit(
      {
        ...dataset,
        expenseItems: removeOwnedRecordById(dataset.expenseItems, recordId, userId, caseId),
      },
      { ...auditBase, entityType: "expenseItem" }
    );
  }

  return dataset;
}

function matchesTimelineFilter(event: CalendarEvent, filter: TimelineFilter) {
  if (filter === "all") return true;
  if (filter === "attention") return isAttentionTimelineEvent(event);
  return event.type === filter;
}

function isAttentionTimelineEvent(event: CalendarEvent) {
  return event.severity === "attention" || event.severity === "critical";
}

function groupTimelineEvents(events: CalendarEvent[]) {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    groups.set(event.date, [...(groups.get(event.date) || []), event]);
  }
  return Array.from(groups, ([date, rows]) => ({ date, rows }));
}

function formatTimelineDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function timelineSeverity(event: CalendarEvent) {
  return event.severity || "neutral";
}

function timelineSeverityLabel(severity: NonNullable<CalendarEvent["severity"]>) {
  if (severity === "critical") return "Critical";
  if (severity === "attention") return "Needs review";
  if (severity === "positive") return "Recorded";
  return "Neutral";
}

function timelineSeverityPillClass(severity: NonNullable<CalendarEvent["severity"]>) {
  if (severity === "critical") return "bg-red-50 text-red-700";
  if (severity === "attention") return "bg-amber-50 text-amber-700";
  if (severity === "positive") return "bg-teal-50 text-teal-700";
  return "bg-slate-100 text-slate-600";
}

function timelineSeverityBorderClass(severity: NonNullable<CalendarEvent["severity"]>) {
  if (severity === "critical") return "border-red-200";
  if (severity === "attention") return "border-amber-200";
  if (severity === "positive") return "border-teal-200";
  return "border-slate-200";
}

function timelineSeverityDotClass(severity: NonNullable<CalendarEvent["severity"]>) {
  if (severity === "critical") return "bg-red-500";
  if (severity === "attention") return "bg-amber-500";
  if (severity === "positive") return "bg-teal-600";
  return "bg-slate-400";
}

function Timeline({
  events,
  emptyLabel = "No records yet.",
  compact = false,
  onDeleteEvent,
}: {
  events: CalendarEvent[];
  emptyLabel?: string;
  compact?: boolean;
  onDeleteEvent?: (event: CalendarEvent) => void;
}) {
  if (events.length === 0) return <Empty label={emptyLabel} />;

  const groups = compact ? [{ date: "compact", rows: events }] : groupTimelineEvents(events);

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {groups.map((group) => (
        <div
          key={group.date}
          className={compact ? "space-y-2" : "grid gap-2 md:grid-cols-[132px_1fr]"}
        >
          {!compact && (
            <div className="pt-2 text-sm">
              <p className="font-semibold text-slate-950">{formatTimelineDate(group.date)}</p>
              <p className="mt-1 text-xs text-slate-500">{group.rows.length} records</p>
            </div>
          )}
          <div className="space-y-2">
            {group.rows.map((event) => (
              <TimelineEventRow
                key={event.id}
                event={event}
                compact={compact}
                onDeleteEvent={onDeleteEvent}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineEventRow({
  event,
  compact,
  onDeleteEvent,
}: {
  event: CalendarEvent;
  compact: boolean;
  onDeleteEvent?: (event: CalendarEvent) => void;
}) {
  const severity = timelineSeverity(event);
  const tagList = event.tags || [];
  const showDelete = Boolean(onDeleteEvent && canDeleteTimelineEvent(event));

  return (
    <details
      className={`group rounded-md border bg-white shadow-sm ${timelineSeverityBorderClass(severity)}`}
    >
      <summary className="flex cursor-pointer list-none flex-col gap-2 p-3 marker:hidden sm:flex-row sm:items-start sm:justify-between [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 gap-3">
          <span
            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${timelineSeverityDotClass(severity)}`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-slate-950">{event.title}</p>
            <p className="mt-1 break-words text-xs leading-5 text-slate-500">
              {compact ? `${event.date}${event.time ? ` at ${event.time}` : ""}` : event.time || "All day"}
              {event.detail ? ` | ${event.detail}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-5 sm:justify-end sm:pl-0">
          <StatusPill label={labelEventType(event.type)} />
          <span className={`rounded px-2 py-1 text-xs font-semibold ${timelineSeverityPillClass(severity)}`}>
            {timelineSeverityLabel(severity)}
          </span>
          <span
            className="grid h-6 w-6 place-items-center rounded border border-slate-200 text-xs font-semibold text-slate-500 transition group-open:rotate-180"
            aria-hidden="true"
          >
            v
          </span>
        </div>
      </summary>
      <div className="border-t border-slate-100 px-3 pb-3 pt-3 text-sm leading-6 text-slate-600">
        {event.summary && <p>{event.summary}</p>}
        {event.body && <p className={event.summary ? "mt-2" : ""}>{event.body}</p>}
        {!event.summary && !event.body && event.detail && <p>{event.detail}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          {event.sourceLabel && (
            <span className="rounded bg-slate-100 px-2 py-1 font-medium">
              Source: {event.sourceLabel}
            </span>
          )}
          {event.relatedIds && event.relatedIds.length > 0 && (
            <span className="rounded bg-slate-100 px-2 py-1 font-medium">
              Related records: {event.relatedIds.length}
            </span>
          )}
        </div>
        <TagList tags={tagList} />
        {showDelete && (
          <div className="mt-3">
            <DeleteButton
              label="Delete item"
              ariaLabel={`Delete timeline item ${event.title}`}
              onClick={() => onDeleteEvent?.(event)}
            />
          </div>
        )}
      </div>
    </details>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<ReactNode>>;
}) {
  if (headers.length === 0 || rows.length === 0) return <Empty label="No rows to show." />;

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="max-w-[260px] px-3 py-2 align-top text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
      {label}
    </span>
  );
}

function DeleteButton({
  label,
  ariaLabel,
  disabled = false,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-8 items-center justify-center rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {tag}
        </span>
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function buildMessageImportDrafts({
  content,
  sourceLabel,
  defaultYear,
  defaultOrderedTime,
}: {
  content: string;
  sourceLabel: string;
  defaultYear: number;
  defaultOrderedTime: string;
}) {
  const normalizedContent = stripImportHtml(content);
  const rows = parseDelimitedRows(normalizedContent);
  const records = delimitedRowsToRecords(rows);
  const drafts: ImportDraft[] = [];

  if (records.length > 0) {
    for (const record of records) {
      const body = pickImportField(record, ["message", "text", "body", "content", "sms", "imessage"]);
      if (!body) continue;

      const sender = pickImportField(record, ["sender", "from", "contact", "name", "handle", "phone"]);
      const dateRaw = pickImportField(record, ["date", "datetime", "timestamp", "sent_at", "created_at"]);
      const timeRaw = pickImportField(record, ["time"]);
      const date = parseImportDate(dateRaw || body, defaultYear);
      if (!date) continue;

      const time =
        extractImportTime(`${dateRaw} ${timeRaw}`, defaultOrderedTime) ||
        extractImportTime(body, defaultOrderedTime);
      const draft = inferImportDraft({
        rawText: sender ? `Sender: ${sender}\n${body}` : body,
        date,
        time,
        sourceLabel,
        defaultOrderedTime,
        includeGeneric: false,
      });
      if (draft) drafts.push(draft);
    }
  }

  if (drafts.length > 0) return drafts;

  return splitTextIntoDatedEntries(normalizedContent, defaultYear, defaultOrderedTime)
    .map((entry) =>
      inferImportDraft({
        rawText: entry.text,
        date: entry.date,
        time: entry.time,
        sourceLabel,
        defaultOrderedTime,
        includeGeneric: false,
      })
    )
    .filter((draft): draft is ImportDraft => Boolean(draft));
}

function buildPastedNoteDrafts({
  content,
  sourceLabel,
  defaultYear,
  defaultOrderedTime,
}: {
  content: string;
  sourceLabel: string;
  defaultYear: number;
  defaultOrderedTime: string;
}) {
  return splitTextIntoDatedEntries(content, defaultYear, defaultOrderedTime)
    .map((entry) =>
      inferImportDraft({
        rawText: entry.text,
        date: entry.date,
        time: entry.time,
        sourceLabel,
        defaultOrderedTime,
        includeGeneric: true,
      })
    )
    .filter((draft): draft is ImportDraft => Boolean(draft));
}

function buildCustodyCalendarDrafts({
  content,
  sourceLabel,
}: {
  content: string;
  sourceLabel: string;
}) {
  const rows = parseDelimitedRows(content);
  const records = delimitedRowsToRecords(rows);
  const defaultYear = new Date().getFullYear();
  const drafts: ImportDraft[] = [];

  if (records.length > 0) {
    for (const record of records) {
      const date = parseImportDate(pickImportField(record, ["date", "day"]), defaultYear);
      if (!date) continue;
      const caregiverLabel = pickImportField(record, ["caregiver", "parent", "label", "owner"]) || "Parent A";
      const color = normalizeImportColor(pickImportField(record, ["color", "hex"])) || custodyDayColors[0];
      const notes = pickImportField(record, ["notes", "note", "description"]);
      drafts.push(createCustodyDayDraft({ date, caregiverLabel, color, notes, sourceLabel }));
    }

    return drafts;
  }

  for (const row of rows) {
    const date = parseImportDate(row[0] || "", defaultYear);
    if (!date) continue;
    drafts.push(
      createCustodyDayDraft({
        date,
        caregiverLabel: row[1]?.trim() || "Parent A",
        color: normalizeImportColor(row[2] || "") || custodyDayColors[0],
        notes: row.slice(3).join(", ").trim(),
        sourceLabel,
      })
    );
  }

  return drafts;
}

function createCustodyDayDraft({
  date,
  caregiverLabel,
  color,
  notes,
  sourceLabel,
}: {
  date: string;
  caregiverLabel: string;
  color: string;
  notes?: string;
  sourceLabel: string;
}): ImportDraft {
  return {
    id: createId("import-day"),
    kind: "custody_day",
    date,
    title: `${caregiverLabel} custody day`,
    body: notes || "",
    category: "schedule_change",
    tags: ["calendar", "custody_day"],
    includeInReports: false,
    confidence: "high",
    sourceLabel,
    selected: true,
    caregiverLabel,
    color,
  };
}

function inferImportDraft({
  rawText,
  date,
  time,
  sourceLabel,
  defaultOrderedTime,
  includeGeneric,
}: {
  rawText: string;
  date: string;
  time?: string;
  sourceLabel: string;
  defaultOrderedTime: string;
  includeGeneric: boolean;
}): ImportDraft | null {
  const cleanText = truncateImportText(normalizeImportWhitespace(rawText), 4_900);
  if (!date || !cleanText) return null;
  const lower = cleanText.toLowerCase();

  if (hasNoFaceTimeSignal(lower)) {
    const postCallNotice = hasPostCallNoticeSignal(lower);
    return {
      id: createId("import-note"),
      kind: "note",
      date,
      time,
      title: "No FaceTime conducted",
      body: postCallNotice
        ? `No FaceTime conducted. The source indicates the notice was provided after a call or FaceTime attempt was not answered.\n\nSource note: ${cleanText}`
        : `No FaceTime conducted. The source states that FaceTime did not occur or was not available.\n\nSource note: ${cleanText}`,
      category: "communication",
      tags: postCallNotice ? ["facetime", "no_facetime", "post_call_notice"] : ["facetime", "no_facetime"],
      includeInReports: true,
      confidence: postCallNotice ? "high" : "medium",
      sourceLabel,
      selected: true,
    };
  }

  const actualTime = extractActualExchangeTime(cleanText, defaultOrderedTime);
  const orderedTime = extractOrderedExchangeTime(cleanText, defaultOrderedTime);
  const minutesLate = actualTime ? minutesBetweenImportTimes(orderedTime, actualTime) : 0;
  if (hasExchangeSignal(lower) && actualTime && (minutesLate > 0 || hasLateExchangeSignal(lower))) {
    return {
      id: createId("import-exchange"),
      kind: "exchange",
      date,
      time: actualTime,
      title: minutesLate > 0 ? `Late exchange recorded (${minutesLate} min)` : "Exchange issue recorded",
      body: `Source note: ${cleanText}`,
      category: "exchange",
      tags: minutesLate > 0 ? ["exchange", "late_exchange"] : ["exchange", "needs_review"],
      includeInReports: true,
      confidence: minutesLate > 0 ? "high" : "medium",
      sourceLabel,
      selected: true,
      orderedTime,
      actualTime,
      direction: "other_parent_to_me",
      status: minutesLate > 0 ? "completed_late" : "other",
    };
  }

  if (hasCourtOrFilingSignal(lower)) {
    return createNoteImportDraft({
      date,
      time,
      title: "Court or filing note",
      body: cleanText,
      category: "court",
      tags: ["court", "filing"],
      sourceLabel,
      confidence: "medium",
    });
  }

  if (!includeGeneric) return null;

  const category = inferGenericNoteCategory(lower);
  return createNoteImportDraft({
    date,
    time,
    title: buildGenericImportTitle(cleanText, category),
    body: cleanText,
    category,
    tags: [category.replaceAll("_", "-"), "imported"],
    sourceLabel,
    confidence: "low",
  });
}

function createNoteImportDraft({
  date,
  time,
  title,
  body,
  category,
  tags,
  sourceLabel,
  confidence,
}: {
  date: string;
  time?: string;
  title: string;
  body: string;
  category: NoteCategory;
  tags: string[];
  sourceLabel: string;
  confidence: ImportDraftConfidence;
}): ImportDraft {
  return {
    id: createId("import-note"),
    kind: "note",
    date,
    time,
    title: truncateImportText(title, 120),
    body: truncateImportText(body, 4_900),
    category,
    tags,
    includeInReports: true,
    confidence,
    sourceLabel,
    selected: true,
  };
}

function splitTextIntoDatedEntries(content: string, defaultYear: number, defaultOrderedTime: string) {
  const lines = stripImportHtml(content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const entries: Array<{ date: string; time?: string; text: string }> = [];
  let current: { date: string; time?: string; text: string } | null = null;

  for (const line of lines) {
    const date = parseImportDate(line, defaultYear);
    if (date) {
      if (current) entries.push(current);
      current = {
        date,
        time: extractImportTime(line, defaultOrderedTime),
        text: line,
      };
      continue;
    }

    if (current) {
      current.text = `${current.text}\n${line}`;
    }
  }

  if (current) entries.push(current);
  return entries;
}

function stripImportHtml(content: string) {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function parseDelimitedRows(input: string) {
  const sample = input.slice(0, 1_000);
  const delimiter = (sample.match(/\t/g) || []).length > (sample.match(/,/g) || []).length ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function delimitedRowsToRecords(rows: string[][]) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeImportHeader);
  const recognized = new Set([
    "date",
    "datetime",
    "timestamp",
    "sent_at",
    "created_at",
    "time",
    "message",
    "text",
    "body",
    "content",
    "sender",
    "from",
    "contact",
    "name",
    "caregiver",
    "parent",
    "label",
    "color",
    "hex",
    "notes",
    "description",
  ]);
  if (!headers.some((header) => recognized.has(header))) return [];

  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]))
  );
}

function normalizeImportHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function pickImportField(record: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    if (record[key]) return record[key].trim();
  }

  for (const [field, value] of Object.entries(record)) {
    if (keys.some((key) => field.includes(key)) && value.trim()) return value.trim();
  }

  return "";
}

const importMonthLookup: Map<string, number> = new Map(
  [
    ["jan", 1],
    ["january", 1],
    ["feb", 2],
    ["february", 2],
    ["mar", 3],
    ["march", 3],
    ["apr", 4],
    ["april", 4],
    ["may", 5],
    ["jun", 6],
    ["june", 6],
    ["jul", 7],
    ["july", 7],
    ["aug", 8],
    ["august", 8],
    ["sep", 9],
    ["sept", 9],
    ["september", 9],
    ["oct", 10],
    ["october", 10],
    ["nov", 11],
    ["november", 11],
    ["dec", 12],
    ["december", 12],
  ] as const
);

function parseImportDate(value: string, defaultYear: number) {
  const clean = value.trim();
  if (!clean) return "";

  const ymd = clean.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (ymd) return isoDateFromParts(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));

  const slash = clean.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slash) {
    return isoDateFromParts(
      normalizeImportYear(slash[3], defaultYear),
      Number(slash[1]),
      Number(slash[2])
    );
  }

  const monthPattern = Array.from(importMonthLookup.keys()).join("|");
  const month = clean.match(
    new RegExp(`\\b(?:sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?)?\\s*(${monthPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{2,4}))?\\b`, "i")
  );
  if (month) {
    return isoDateFromParts(
      normalizeImportYear(month[3], defaultYear),
      importMonthLookup.get(month[1].toLowerCase()) || 1,
      Number(month[2])
    );
  }

  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function normalizeImportYear(value: string | undefined, defaultYear: number) {
  const year = Number(value || defaultYear);
  if (!Number.isFinite(year)) return defaultYear;
  if (year < 100) return year >= 70 ? 1900 + year : 2000 + year;
  return year;
}

function isoDateFromParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function extractImportTime(value: string, defaultOrderedTime: string) {
  return collectImportTimes(value, defaultOrderedTime)[0]?.time || "";
}

function extractActualExchangeTime(value: string, defaultOrderedTime: string) {
  const times = collectImportTimes(value, defaultOrderedTime);
  if (times.length === 0) return "";
  const lower = value.toLowerCase();
  const anchors = [
    "showed up",
    "dropped off",
    "dropped",
    "drops kids",
    "drops children",
    "drops",
    "drop",
    "drop off",
    "arrived",
    "pulling into",
    "here",
    "got to",
  ];

  for (const anchor of anchors) {
    const anchorIndex = lower.indexOf(anchor);
    if (anchorIndex >= 0) {
      const afterAnchor = times.find((time) => time.index >= anchorIndex);
      if (afterAnchor) return afterAnchor.time;
    }
  }

  return times.at(-1)?.time || "";
}

function extractOrderedExchangeTime(value: string, defaultOrderedTime: string) {
  const lower = value.toLowerCase();
  const phrases = [
    "court order",
    "ordered",
    "refused to bring",
    "refused",
    "exchange time",
    "drop off time",
    "bring kids at",
    "agreed to bring",
  ];

  for (const phrase of phrases) {
    const index = lower.indexOf(phrase);
    if (index < 0) continue;
    const segment = value.slice(index, index + 90);
    const explicitTime = extractImportTime(segment, defaultOrderedTime);
    if (explicitTime) return explicitTime;
    const bareHour = segment.match(/\b(?:is|at|by|for|before)\s+(1[0-2]|0?[1-9])\b/i);
    if (bareHour) return normalizeImportTime(bareHour[1], "00", undefined, defaultOrderedTime);
  }

  return defaultOrderedTime;
}

function collectImportTimes(value: string, defaultOrderedTime: string) {
  const times: Array<{ time: string; index: number }> = [];
  const colonRegex = /\b([01]?\d|2[0-3]):([0-5]\d)\s*([ap]\.?m\.?)?\b/gi;
  for (const match of value.matchAll(colonRegex)) {
    times.push({
      time: normalizeImportTime(match[1], match[2], match[3], defaultOrderedTime),
      index: match.index || 0,
    });
  }

  const ampmRegex = /\b(1[0-2]|0?[1-9])\s*([ap]\.?m\.?)\b/gi;
  for (const match of value.matchAll(ampmRegex)) {
    const index = match.index || 0;
    const alreadyCaptured = times.some((time) => Math.abs(time.index - index) < 4);
    if (alreadyCaptured) continue;
    times.push({
      time: normalizeImportTime(match[1], "00", match[2], defaultOrderedTime),
      index,
    });
  }

  return times.sort((left, right) => left.index - right.index);
}

function normalizeImportTime(
  hourValue: string,
  minuteValue: string,
  meridiem: string | undefined,
  defaultOrderedTime: string
) {
  let hour = Number(hourValue);
  const minute = Number(minuteValue);
  const defaultHour = Number(defaultOrderedTime.slice(0, 2));
  const normalizedMeridiem = meridiem?.toLowerCase().replaceAll(".", "");

  if (normalizedMeridiem === "pm" && hour < 12) hour += 12;
  if (normalizedMeridiem === "am" && hour === 12) hour = 0;
  if (!normalizedMeridiem && defaultHour >= 12 && hour >= 1 && hour <= 7) hour += 12;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function minutesBetweenImportTimes(start: string, end: string) {
  const startMinutes = minutesFromImportTime(start);
  const endMinutes = minutesFromImportTime(end);
  return endMinutes - startMinutes;
}

function minutesFromImportTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function hasNoFaceTimeSignal(lower: string) {
  return (
    /\b(no|not|unable|cannot|can't|won't|will not)\b.{0,55}\bfacetime\b/i.test(lower) ||
    /\bfacetime\b.{0,55}\b(no|not|unable|cannot|can't|asleep|tonight|available)\b/i.test(lower) ||
    /\basleep\b.{0,55}\bfacetime\b/i.test(lower)
  );
}

function hasPostCallNoticeSignal(lower: string) {
  return /\b(call|called|calling|rang|no answer|did not answer|didn't answer|after i)\b/i.test(lower);
}

function hasExchangeSignal(lower: string) {
  return (
    /\b(exchange|transition|showed up|arrived|here|pick up|pickup)\b/i.test(lower) ||
    /\bdrop(?:s|ped)?(?:\s+\w+){0,4}\s+off\b/i.test(lower)
  );
}

function hasLateExchangeSignal(lower: string) {
  return /\b(late|court order|refused|unannounced|wait for|showed up|dropped off)\b/i.test(lower);
}

function hasCourtOrFilingSignal(lower: string) {
  return /\b(court|motion|response|filed|filing|order|hearing|testified|attorney)\b/i.test(lower);
}

function inferGenericNoteCategory(lower: string): NoteCategory {
  if (hasExchangeSignal(lower)) return "exchange";
  if (hasCourtOrFilingSignal(lower)) return "court";
  if (/\b(daycare|child care|childcare|schedule)\b/i.test(lower)) return "schedule_change";
  if (/\b(sick|doctor|medical|appointment)\b/i.test(lower)) return "medical";
  if (/\b(school|teacher|daycare)\b/i.test(lower)) return "school";
  if (/\b(safety|unsafe|danger)\b/i.test(lower)) return "safety";
  return "other";
}

function buildGenericImportTitle(body: string, category: NoteCategory) {
  const firstSentence = body.split(/[.!?\n]/)[0]?.trim() || labelNoteCategory(category);
  return truncateImportText(firstSentence, 90) || "Imported note";
}

function normalizeImportColor(value: string) {
  const color = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "";
}

function normalizeImportWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncateImportText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}...`;
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function emptyToUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value === "" ? undefined : value])
  ) as T;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildSectionExportPrintHtml(packet: SectionExportPacket) {
  return `<!doctype html>
    <html>
      <head>
        <title>${escapeHtml(packet.title)}</title>
        <style>
          @page { margin: 0.55in; }
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; margin: 0; }
          h1 { font-size: 24px; line-height: 1.2; margin: 0 0 6px; }
          h2 { font-size: 15px; margin: 24px 0 8px; }
          h3 { font-size: 13px; margin: 0 0 8px; }
          p { color: #475569; font-size: 12px; line-height: 1.55; margin: 0; }
          .muted { color: #64748b; }
          .notice { border: 1px solid #fde68a; background: #fffbeb; padding: 10px; margin: 14px 0; font-size: 12px; line-height: 1.5; color: #713f12; }
          .summary { display: grid; gap: 8px; margin: 16px 0; }
          .summary p { border: 1px solid #e2e8f0; background: #f8fafc; padding: 10px; color: #334155; }
          .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 14px 0; }
          .metric { border: 1px solid #e2e8f0; padding: 10px; }
          .metric strong { display: block; font-size: 18px; color: #0f766e; margin-top: 4px; }
          .chart { break-inside: avoid; border: 1px solid #e2e8f0; padding: 12px; margin: 12px 0; }
          .chart-row { margin-top: 8px; }
          .chart-label { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: #334155; }
          .track { height: 8px; background: #f1f5f9; border-radius: 999px; margin-top: 4px; overflow: hidden; }
          .bar { height: 8px; border-radius: 999px; background: #d97706; }
          .bar.secondary { background: #2563eb; }
          .bar.tertiary { background: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px; vertical-align: top; text-align: left; }
          th { background: #f8fafc; color: #334155; }
          ul { color: #475569; font-size: 12px; line-height: 1.5; margin: 8px 0 0 18px; padding: 0; }
        </style>
      </head>
      <body>
        <p class="muted">${escapeHtml(packet.range.from)} to ${escapeHtml(packet.range.to)}</p>
        <h1>${escapeHtml(packet.title)}</h1>
        <p>${escapeHtml(packet.caseName)}</p>
        <p class="muted">Generated ${escapeHtml(packet.generatedAt)}</p>
        <div class="notice">${escapeHtml(packet.disclaimer)}</div>
        <section class="metrics">
          ${packet.metrics
            .map(
              (metric) => `<div class="metric"><p>${escapeHtml(metric.label)}</p><strong>${escapeHtml(
                String(metric.value)
              )}</strong><p>${escapeHtml(metric.detail || "")}</p></div>`
            )
            .join("")}
        </section>
        <section class="summary">
          ${packet.summaries.map((summary) => `<p>${escapeHtml(summary)}</p>`).join("")}
        </section>
        <h2>Charts</h2>
        ${packet.charts.map(buildPrintableChartHtml).join("") || "<p>No chart data for this range.</p>"}
        <h2>Suggested use</h2>
        <ul>${packet.suggestedUses.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <h2>Tables</h2>
        ${packet.tables.map(buildPrintableTableHtml).join("")}
        <script>window.print();</script>
      </body>
    </html>`;
}

function buildPrintableChartHtml(chart: SectionExportPacket["charts"][number]) {
  if (chart.rows.length === 0) {
    return `<div class="chart"><h3>${escapeHtml(chart.title)}</h3><p>No chart data for this range.</p></div>`;
  }
  const values = chart.rows.flatMap((row) =>
    [row.value, row.secondaryValue, row.tertiaryValue].filter((value): value is number => typeof value === "number")
  );
  const max = Math.max(1, ...values.map((value) => Math.abs(value)));

  return `<div class="chart">
    <h3>${escapeHtml(chart.title)}${chart.unit ? ` (${escapeHtml(chart.unit)})` : ""}</h3>
    ${chart.description ? `<p>${escapeHtml(chart.description)}</p>` : ""}
    ${chart.rows
      .map((row) => {
        const width = Math.max(4, Math.min(100, (Math.abs(row.value) / max) * 100));
        const secondaryWidth =
          typeof row.secondaryValue === "number"
            ? Math.max(4, Math.min(100, (Math.abs(row.secondaryValue) / max) * 100))
            : 0;
        const tertiaryWidth =
          typeof row.tertiaryValue === "number"
            ? Math.max(4, Math.min(100, (Math.abs(row.tertiaryValue) / max) * 100))
            : 0;
        return `<div class="chart-row">
          <div class="chart-label"><span>${escapeHtml(row.label)}</span><span>${escapeHtml(
            [
              formatChartValue(row.value, chart.unit),
              typeof row.secondaryValue === "number" ? formatChartValue(row.secondaryValue, chart.unit) : "",
              typeof row.tertiaryValue === "number" ? formatChartValue(row.tertiaryValue, chart.unit) : "",
            ]
              .filter(Boolean)
              .join(" / ")
          )}</span></div>
          <div class="track"><div class="bar" style="width:${width}%"></div></div>
          ${
            typeof row.secondaryValue === "number"
              ? `<div class="track"><div class="bar secondary" style="width:${secondaryWidth}%"></div></div>`
              : ""
          }
          ${
            typeof row.tertiaryValue === "number"
              ? `<div class="track"><div class="bar tertiary" style="width:${tertiaryWidth}%"></div></div>`
              : ""
          }
        </div>`;
      })
      .join("")}
  </div>`;
}

function buildPrintableTableHtml(table: SectionExportPacket["tables"][number]) {
  return `<section>
    <h2>${escapeHtml(table.title)}</h2>
    ${
      table.rows.length === 0
        ? "<p>No rows for this range.</p>"
        : `<table>
            <thead>
              <tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${table.rows
                .map(
                  (row) =>
                    `<tr>${table.headers
                      .map((_, index) => `<td>${escapeHtml(row[index] || "")}</td>`)
                      .join("")}</tr>`
                )
                .join("")}
            </tbody>
          </table>`
    }
  </section>`;
}

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
