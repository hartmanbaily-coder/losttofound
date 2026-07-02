"use client";

import type { FormEvent, PointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildCalendarEvents,
  buildCustodyDayMap,
  calculateChildSupportStats,
  calculateExchangeStats,
  calculateExpenseStats,
  childSupportChartRows,
  exchangeChartRows,
  formatMoney,
  generateExpectedExchangeEvents,
  getIsoDateFromDateTime,
  labelEventType,
  labelExchangeStatus,
  labelNoteCategory,
  labelPaymentStatus,
} from "@/lib/records/calculations";
import {
  clearFailedLoginAttempts,
  clearSession,
  createId,
  downloadTextFile,
  nowIso,
  parseTags,
  readFailedLoginState,
  readRecordsSession,
  readSession,
  recordFailedLoginAttempt,
  signInRecordsSession,
  signOutRecordsSession,
  useRecordsStore,
  useSelectedRecords,
  verifyRecordsMfa,
  verifyRecordsMfaEnrollment,
  withAudit,
  writeSession,
  type RecordsMfaEnrollment,
  type RecordsSession,
} from "@/lib/records/clientStore";
import { rowsToCsv, buildReportPreview, reportTypeLabels } from "@/lib/records/reports";
import { demoCaseId, demoUserId } from "@/lib/records/seed";
import type {
  CalendarEvent,
  CustodyDayAssignment,
  DateRange,
  EvidenceItem,
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
  validateEvidenceFile,
} from "@/lib/records/validation";
import {
  ExchangeTimingChart,
  ExpenseCategoryChart,
  SupportPaymentChart,
  SupportTrendLine,
} from "./RecordsCharts";

const disclaimer =
  "This tool helps organize records and does not provide legal advice. Consult a qualified attorney about your situation.";

const navItems = [
  "Dashboard",
  "Calendar",
  "Timeline",
  "Exchanges",
  "Notes",
  "Evidence",
  "Child Support",
  "Expenses",
  "Reports",
  "Settings",
] as const;

type ActiveView = (typeof navItems)[number];
type Session = RecordsSession;
type LoginFlowResult =
  | { status: "complete" }
  | { status: "mfa_required" }
  | { status: "mfa_enrollment_required"; enrollment: RecordsMfaEnrollment };

const defaultRange: DateRange = { from: "2026-05-01", to: "2026-06-15" };

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

const timelineFilterOptions: Array<{ value: TimelineFilter; label: string }> = [
  { value: "all", label: "All records" },
  { value: "attention", label: "Needs review" },
  { value: "scheduled_exchange", label: "Scheduled exchanges" },
  { value: "logged_exchange", label: "Logged exchanges" },
  { value: "custody_day", label: "Custody days" },
  { value: "custody_note", label: "Notes" },
  { value: "evidence_item", label: "Evidence" },
  { value: "child_support_due", label: "Support due" },
  { value: "child_support_paid", label: "Support paid" },
  { value: "expense_item", label: "Expenses" },
];

const directTimelineDeleteTypes = new Set<CalendarEvent["type"]>([
  "custody_day",
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

export default function RecordsApp() {
  const { dataset, hydrated, updateDataset, resetDemoData, reloadDataset, storageStatus, recordsStorageMode } =
    useRecordsStore();
  const [session, setSession] = useState<Session | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("Dashboard");
  const [selectedCaseId, setSelectedCaseId] = useState(demoCaseId);
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [calendarMode, setCalendarMode] = useState<"month" | "list" | "timeline">("month");
  const [selectedDay, setSelectedDay] = useState("2026-05-08");
  const [reportType, setReportType] = useState<ReportType>("combined_attorney_summary");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      async function loadSession() {
        const stored =
          recordsStorageMode === "supabase" ? await readRecordsSession().catch(() => null) : readSession();
        if (stored) {
          setSession(stored);
          setSelectedCaseId(stored.caseId);
        }
      }

      void loadSession();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [recordsStorageMode]);

  const userId = session?.userId || demoUserId;
  const selected = useSelectedRecords(dataset, userId, selectedCaseId);
  const selectedCase = selected.matter || selected.matters[0];
  const effectiveCaseId = selectedCase?.id || selectedCaseId;

  const expectedExchanges = useMemo(
    () => generateExpectedExchangeEvents(selected.exchangeRules, range),
    [selected.exchangeRules, range]
  );
  const exchangeStats = useMemo(
    () => calculateExchangeStats(selected.exchangeLogs, expectedExchanges, range),
    [selected.exchangeLogs, expectedExchanges, range]
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
  const exchangeRows = useMemo(
    () => exchangeChartRows(selected.exchangeLogs, range),
    [selected.exchangeLogs, range]
  );
  const supportRows = useMemo(
    () => childSupportChartRows(selected.childSupportPayments, range),
    [selected.childSupportPayments, range]
  );
  const reportPreview = useMemo(
    () => buildReportPreview(dataset, userId, effectiveCaseId, range, reportType),
    [dataset, userId, effectiveCaseId, range, reportType]
  );

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
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
                  onClick={() => setActiveView(item)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                    activeView === item
                      ? "bg-teal-700 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <span>{item}</span>
                  {item === "Evidence" && (
                    <span className="rounded bg-white/20 px-1.5 text-[11px]">
                      {selected.evidenceItems.length}
                    </span>
                  )}
                  {item === "Timeline" && (
                    <span className="rounded bg-white/20 px-1.5 text-[11px]">
                      {calendarEvents.length}
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

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedCaseId}
                  onChange={(event) => setSelectedCaseId(event.target.value)}
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                >
                  {selected.matters.map((matter) => (
                    <option key={matter.id} value={matter.id}>
                      {matter.caseName}
                    </option>
                  ))}
                </select>
                <RangeToolbar range={range} setRange={setRange} />
                <button
                  type="button"
                  onClick={() => setActiveView("Reports")}
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
                exchangeStats={exchangeStats}
                supportStats={supportStats}
                expenseStats={expenseStats}
                exchangeRows={exchangeRows}
                supportRows={supportRows}
                expenseRows={expenseStats.byCategory}
                calendarEvents={calendarEvents}
                evidenceCount={selected.evidenceItems.length}
              />
            )}
            {activeView === "Calendar" && (
              <CalendarView
                events={calendarEvents}
                custodyDayAssignments={selected.custodyDayAssignments}
                updateDataset={updateDataset}
                userId={userId}
                caseId={effectiveCaseId}
                mode={calendarMode}
                setMode={setCalendarMode}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                range={range}
                flash={flash}
              />
            )}
            {activeView === "Timeline" && (
              <TimelineView
                events={calendarEvents}
                range={range}
                updateDataset={updateDataset}
                userId={userId}
                caseId={effectiveCaseId}
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
                flash={flash}
              />
            )}
            {activeView === "Notes" && (
              <NotesView
                updateDataset={updateDataset}
                userId={userId}
                caseId={effectiveCaseId}
                notes={selected.dateNotes}
                flash={flash}
              />
            )}
            {activeView === "Evidence" && (
              <EvidenceView
                updateDataset={updateDataset}
                userId={userId}
                caseId={effectiveCaseId}
                evidence={selected.evidenceItems}
                recordsStorageMode={recordsStorageMode}
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
                setSelectedCaseId={setSelectedCaseId}
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
  const [submitting, setSubmitting] = useState(false);
  const [mfaMode, setMfaMode] = useState<"verify" | "enroll" | null>(null);
  const [mfaEnrollment, setMfaEnrollment] = useState<RecordsMfaEnrollment | null>(null);
  const [mfaSubmitting, setMfaSubmitting] = useState(false);

  function qrCodeSrc(qrCode: string) {
    if (qrCode.startsWith("data:image/")) return qrCode;
    return `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appReady) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const adultConfirmed = formData.get("adult") === "on";
    const failedState = readFailedLoginState();
    const isLocked = failedState.lockedUntil > Date.now();
    const minimumPasswordLength = 12;

    if (isLocked) {
      setError("Too many failed attempts. Try again in a few minutes.");
      return;
    }

    if (!adultConfirmed || !email.includes("@") || password.length < minimumPasswordLength) {
      const next = recordFailedLoginAttempt();
      setError(
        next.lockedUntil > Date.now()
          ? "Too many failed attempts. This browser is temporarily limited."
          : `Enter an email, a password with at least ${minimumPasswordLength} characters, and confirm adult use.`
      );
      return;
    }

    setSubmitting(true);
    setError("");
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
      recordFailedLoginAttempt();
      setError(loginError instanceof Error ? loginError.message : "Sign-in failed.");
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
              outcomes, child support payment records, expenses, date-based notes, evidence
              metadata, and neutral report exports.
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
            <h2 className="text-lg font-semibold">
              {recordsStorageMode === "supabase" ? "Secure sign in" : "Local demo access"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Supabase mode signs in through server-managed HttpOnly cookies and requires
              authenticator verification. Local mode is limited to development demo data.
            </p>

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
              </form>
            ) : (
              <form method="post" onSubmit={onSubmit} className="mt-5 space-y-4">
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
  exchangeStats,
  supportStats,
  expenseStats,
  exchangeRows,
  supportRows,
  expenseRows,
  calendarEvents,
  evidenceCount,
}: {
  range: DateRange;
  exchangeStats: ReturnType<typeof calculateExchangeStats>;
  supportStats: ReturnType<typeof calculateChildSupportStats>;
  expenseStats: ReturnType<typeof calculateExpenseStats>;
  exchangeRows: Array<{ date: string; minutesEarlyOrLate: number; status: string }>;
  supportRows: Array<{ month: string; amountDue: number; amountPaid: number; unpaidBalance: number }>;
  expenseRows: Array<{ category: string; amount: number }>;
  calendarEvents: CalendarEvent[];
  evidenceCount: number;
}) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Scheduled exchanges" value={exchangeStats.scheduledCount} detail="Selected date range" />
        <StatCard label="Late exchanges" value={exchangeStats.lateCount} detail={`${exchangeStats.averageLatenessMinutes} min average delay`} tone="amber" />
        <StatCard label="Missed exchanges" value={exchangeStats.missedCount} detail="Marked by user records" tone="slate" />
        <StatCard label="Payments marked unpaid" value={supportStats.unpaidCount} detail={formatMoney(supportStats.unpaidBalance)} tone="amber" />
        <StatCard label="Evidence items" value={evidenceCount} detail="Private index" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Exchange order comparison" action={`${range.from} to ${range.to}`}>
          <ExchangeTimingChart rows={exchangeRows} />
        </Panel>
        <Panel title="Child support due vs paid" action="Based on user-entered records">
          <SupportPaymentChart rows={supportRows} />
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Panel title="Expenses by category" action={formatMoney(expenseStats.totalExpenses)}>
          <ExpenseCategoryChart rows={expenseRows} />
        </Panel>
        <Panel title="Recent factual timeline" action={`${calendarEvents.length} events`}>
          <Timeline events={calendarEvents.slice(-8).reverse()} compact />
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
  range,
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
  range: DateRange;
  flash: (message: string) => void;
}) {
  const monthKey = range.from.slice(0, 7);
  const monthDays = buildMonthDays(monthKey);
  const [paintCaregiverLabel, setPaintCaregiverLabel] = useState("Parent A");
  const [paintColor, setPaintColor] = useState<(typeof custodyDayColors)[number] | string>(
    custodyDayColors[0]
  );
  const [isPainting, setIsPainting] = useState(false);
  const [paintDraftDates, setPaintDraftDates] = useState<Set<string>>(() => new Set());
  const paintingRef = useRef(false);
  const paintDraftDatesRef = useRef<Set<string>>(new Set());
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    eventsByDate.set(event.date, [...(eventsByDate.get(event.date) || []), event]);
  }
  const custodyDayMap = buildCustodyDayMap(custodyDayAssignments, {
    from: `${monthKey}-01`,
    to: `${monthKey}-31`,
  });
  const selectedAssignment = custodyDayMap.get(selectedDay);
  const dayEvents = eventsByDate.get(selectedDay) || [];

  const setPaintDraft = useCallback((dates: Set<string>) => {
    paintDraftDatesRef.current = dates;
    setPaintDraftDates(dates);
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
      flash(uniqueDates.length === 1 ? "Custody day color saved." : `${uniqueDates.length} custody days colored.`);
    },
    [caseId, flash, paintCaregiverLabel, paintColor, setSelectedDay, updateDataset, userId]
  );

  const extendPaint = useCallback(
    (day: string) => {
      if (!paintingRef.current) return;
      const currentDates = paintDraftDatesRef.current;
      if (currentDates.has(day)) return;
      setSelectedDay(day);
      setPaintDraft(new Set([...currentDates, day]));
    },
    [setPaintDraft, setSelectedDay]
  );

  useEffect(() => {
    function handlePointerMove(event: globalThis.PointerEvent) {
      if (!paintingRef.current) return;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const day = target instanceof Element
        ? target.closest<HTMLElement>("[data-calendar-day]")?.dataset.calendarDay
        : undefined;
      if (day) extendPaint(day);
    }

    function finishPaint() {
      if (!paintingRef.current) return;
      paintingRef.current = false;
      setIsPainting(false);
      const dates = Array.from(paintDraftDatesRef.current);
      setPaintDraft(new Set());
      applyCustodyDayPaint(dates);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishPaint);
    window.addEventListener("pointercancel", finishPaint);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishPaint);
      window.removeEventListener("pointercancel", finishPaint);
    };
  }, [applyCustodyDayPaint, extendPaint, setPaintDraft]);

  function beginPaint(day: string, event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    paintingRef.current = true;
    setIsPainting(true);
    setSelectedDay(day);
    setPaintDraft(new Set([day]));
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
          <Panel title={`Monthly custody calendar: ${monthKey}`} action="Editable color blocks">
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
                    onClick={() => day && setSelectedDay(day)}
                    style={
                      visibleColor
                        ? {
                            backgroundColor: withAlpha(visibleColor, isPaintDraft ? 0.16 : 0.1),
                            borderColor: visibleColor,
                          }
                        : undefined
                    }
                    className={`min-h-28 select-none rounded-md border p-2 text-left transition ${
                      day === selectedDay
                        ? "ring-2 ring-teal-500 ring-offset-1"
                        : "border-slate-200 bg-white hover:border-teal-300"
                    } ${day ? "cursor-crosshair" : ""} ${!day ? "bg-transparent hover:border-slate-200" : ""}`}
                  >
                    {day && (
                      <>
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-semibold text-slate-900">{Number(day.slice(-2))}</p>
                          {assignment?.exchangeTime && (
                            <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              {assignment.exchangeTime}
                            </span>
                          )}
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
        <Panel title="Weekly/list view" action={`${events.length} records`}>
          <Timeline
            events={events}
            emptyLabel="No calendar records in this date range."
            onDeleteEvent={deleteTimelineEvent}
          />
        </Panel>
      )}

      {mode === "timeline" && (
        <Panel title="Chronological timeline" action="Order, recorded events, notes, evidence, expenses">
          <Timeline
            events={events}
            emptyLabel="No timeline records in this date range."
            onDeleteEvent={deleteTimelineEvent}
          />
        </Panel>
      )}
    </div>
  );
}

function TimelineView({
  events,
  range,
  updateDataset,
  userId,
  caseId,
  flash,
}: {
  events: CalendarEvent[];
  range: DateRange;
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  userId: string;
  caseId: string;
  flash: (message: string) => void;
}) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const filteredEvents = events.filter((event) => matchesTimelineFilter(event, filter));
  const attentionCount = events.filter(isAttentionTimelineEvent).length;
  const exchangeCount = events.filter(
    (event) => event.type === "scheduled_exchange" || event.type === "logged_exchange"
  ).length;
  const noteCount = events.filter((event) => event.type === "custody_note").length;
  const evidenceCount = events.filter((event) => event.type === "evidence_item").length;

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
        <StatCard label="Timeline records" value={events.length} detail={`${range.from} to ${range.to}`} />
        <StatCard label="Needs review" value={attentionCount} detail="Attention or critical markers" tone="amber" />
        <StatCard label="Exchange entries" value={exchangeCount} detail="Scheduled and logged" />
        <StatCard label="Notes" value={noteCount} detail="Date-based records" tone="slate" />
        <StatCard label="Evidence" value={evidenceCount} detail="Dated evidence items" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
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
              evidence files are managed from their source tabs.
            </p>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium text-slate-600">
                {["Calendar", "Exchanges", "Notes", "Evidence", "Support", "Expenses"].map((source) => (
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
  flash,
}: {
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  userId: string;
  caseId: string;
  selected: ReturnType<typeof useSelectedRecords>;
  range: DateRange;
  expectedExchanges: ReturnType<typeof generateExpectedExchangeEvents>;
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
  flash,
}: {
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  userId: string;
  caseId: string;
  notes: ReturnType<typeof useSelectedRecords>["dateNotes"];
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

function EvidenceView({
  updateDataset,
  userId,
  caseId,
  evidence,
  recordsStorageMode,
  flash,
}: {
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  userId: string;
  caseId: string;
  evidence: ReturnType<typeof useSelectedRecords>["evidenceItems"];
  recordsStorageMode: "local" | "supabase";
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
      throw new Error(`${parsed.error || "Evidence upload failed."}${details}`);
    }

    if (!parsed.evidence?.storagePath || parsed.evidence.malwareScanStatus !== "clean") {
      throw new Error("Evidence upload response was incomplete.");
    }

    return parsed.evidence;
  }

  async function addEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    if (!(file instanceof File)) return flash("Choose a file for evidence metadata.");

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
    } catch (error) {
      return flash(error instanceof Error ? error.message : "Evidence upload failed.");
    } finally {
      setUploading(false);
    }

    updateDataset((current) =>
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
              uploadedAt: nowIso(),
              evidenceDate: text(formData, "evidenceDate") || undefined,
              description: text(formData, "description") || undefined,
              tags: parseTags(text(formData, "tags")),
              includeInReports: formData.get("includeInReports") === "on",
              reviewStatus: "needs_review",
              malwareScanStatus: uploaded?.malwareScanStatus || "pending",
              createdAt: nowIso(),
              updatedAt: nowIso(),
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
              ? "Evidence file stored in private storage after malware scanning."
              : "Evidence metadata stored without raw file path or contents.",
        }
      )
    );
    event.currentTarget.reset();
    flash(
      recordsStorageMode === "supabase"
        ? "Evidence file uploaded, scanned clean, and metadata saved."
        : "Evidence metadata saved with allow-list validation."
    );
  }

  async function downloadEvidence(item: EvidenceItem) {
    if (recordsStorageMode !== "supabase" || !item.storagePath) {
      flash("This evidence record does not have a stored file to download.");
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
        throw new Error(body.error || "Evidence download failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.originalFileName;
      anchor.click();
      URL.revokeObjectURL(url);
      flash("Evidence file downloaded.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Evidence download failed.");
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
      `evidence-index-${new Date().toISOString().slice(0, 10)}.csv`,
      rowsToCsv(rows),
      "text/csv"
    );
    updateDataset((current) =>
      withAudit(current, {
        userId,
        caseId,
        action: "exported",
        entityType: "evidenceIndex",
        entityId: "evidence-index",
        metadataSummary: "Evidence metadata index exported.",
      })
    );
    flash("Evidence index downloaded.");
  }

  function printEvidenceSheet(item: EvidenceItem) {
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!printWindow) {
      flash("Popup blocked. Allow popups to print the evidence sheet.");
      return;
    }

    const rows = [
      ["File name", item.originalFileName],
      ["Evidence date", item.evidenceDate || ""],
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
          <title>Evidence Sheet - ${escapeHtml(item.originalFileName)}</title>
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
          <h1>Lost to Found Records Evidence Sheet</h1>
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
        metadataSummary: "Evidence metadata print sheet opened.",
      })
    );
    flash("Evidence print sheet opened.");
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
          metadataSummary: `Evidence review status changed to ${evidenceReviewStatusLabels[reviewStatus]}.`,
        }
      )
    );
    flash(`Evidence marked ${evidenceReviewStatusLabels[reviewStatus].toLowerCase()}.`);
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
          throw new Error(body.error || "Evidence file delete failed.");
        }
      } catch (error) {
        flash(error instanceof Error ? error.message : "Evidence file delete failed.");
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
              ? "Evidence file and metadata record deleted."
              : "Evidence metadata record deleted.",
        }
      )
    );
    flash(recordsStorageMode === "supabase" ? "Evidence file and metadata deleted." : "Evidence metadata deleted.");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Panel
        title="Private evidence record"
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
              accept=".pdf,.png,.jpg,.jpeg,.heic,.txt,.csv"
            />
          </Field>
          <Field label="Evidence date">
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
            Include in evidence index for selected reports
          </label>
          <button className="btn-primary" type="submit" disabled={uploading}>
            {uploading
              ? "Scanning and uploading..."
              : recordsStorageMode === "supabase"
                ? "Upload evidence file"
                : "Save evidence record"}
          </button>
        </form>
      </Panel>

      <Panel title="Evidence index" action={`${evidence.length} records`}>
        {evidence.length === 0 ? (
          <Empty label="No evidence records yet." />
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
                      ariaLabel={`Delete evidence ${item.originalFileName}`}
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
  flash,
}: {
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  userId: string;
  caseId: string;
  orders: ReturnType<typeof useSelectedRecords>["childSupportOrders"];
  payments: ReturnType<typeof useSelectedRecords>["childSupportPayments"];
  supportRows: Array<{ month: string; amountDue: number; amountPaid: number; unpaidBalance: number }>;
  supportStats: ReturnType<typeof calculateChildSupportStats>;
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
  flash,
}: {
  updateDataset: ReturnType<typeof useRecordsStore>["updateDataset"];
  userId: string;
  caseId: string;
  expenses: ReturnType<typeof useSelectedRecords>["expenseItems"];
  expenseStats: ReturnType<typeof calculateExpenseStats>;
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
          <Panel title="Expenses by category" action={`${expenses.length} records`}>
            <ExpenseCategoryChart rows={expenseStats.byCategory} />
          </Panel>
          <Panel title="Expense records" action="Evidence can be attached separately">
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
  const previewHeaders = useMemo(
    () => Array.from(new Set(preview.rows.flatMap((row) => Object.keys(row)))),
    [preview.rows]
  );

  function toggleExportReview(key: ExportReviewKey, checked: boolean) {
    setExportReview((current) => ({ ...current, [key]: checked }));
  }

  function downloadCsv() {
    if (!exportReviewComplete) {
      flash("Complete the pre-export review first.");
      return;
    }
    const csv = rowsToCsv(preview.rows);
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
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Panel title="Report builder" action="Neutral summaries">
        <div className="grid gap-3">
          <Field label="Report type">
            <select
              value={reportType}
              onChange={(event) => setReportType(event.target.value as ReportType)}
              className="input"
            >
              {Object.entries(reportTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
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
            PDF output uses your browser print dialog. Downloaded reports leave the app&apos;s protected
            storage and should be kept somewhere private.
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
            <p className="mt-2 text-sm leading-6 text-slate-600">{preview.disclaimer}</p>
            <p className="mt-2 text-xs text-slate-500">Generated {preview.generatedAt}</p>
          </div>
          <div className="grid gap-3">
            {preview.summaries.map((summary) => (
              <p key={summary} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                {summary}
              </p>
            ))}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Report rows</h3>
            <Table
              headers={previewHeaders}
              rows={preview.rows
                .slice(0, 12)
                .map((row) =>
                  previewHeaders.map((header) => String((row as Record<string, unknown>)[header] ?? ""))
                )}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Evidence index</h3>
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

  function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateDataset((current) => ({
      ...current,
      users: current.users.map((user) =>
        user.userId === userId
          ? {
              ...user,
              displayName: text(formData, "displayName") || undefined,
              timezone: text(formData, "timezone") || user.timezone,
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
              <input name="timezone" className="input" defaultValue={profile?.timezone || "America/Anchorage"} />
            </Field>
            <button className="btn-primary" type="submit">
              Update profile
            </button>
          </form>
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
              <input name="timezone" className="input" defaultValue={profile?.timezone || "America/Anchorage"} />
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
            <li>Attach evidence only when it supports a specific date, note, expense, or exchange.</li>
            <li>Review the Reports tab before exporting anything for another person or agency.</li>
          </ol>
        </Panel>

        <Panel title="Session and security notes" action="Privacy defaults">
          <div className="space-y-3 text-sm leading-6 text-slate-600">
            <p>No child accounts, public profiles, social features, co-parent messaging, advertising trackers, or session replay are included.</p>
            <p>Cloud storage uses server-side auth routes and HttpOnly cookies instead of browser-stored access tokens.</p>
            <p>Evidence files use server-mediated private object storage, require a clean malware scan before download, and never expose public or anonymous share links.</p>
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
}: {
  range: DateRange;
  setRange: (range: DateRange) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
        onChange={(event) => {
          const value = event.target.value;
          if (value === "last30") setRange({ from: "2026-05-16", to: "2026-06-15" });
          if (value === "last90") setRange({ from: "2026-03-17", to: "2026-06-15" });
          if (value === "currentMonth") setRange({ from: "2026-06-01", to: "2026-06-30" });
          if (value === "priorMonth") setRange({ from: "2026-05-01", to: "2026-05-31" });
          if (value === "ytd") setRange({ from: "2026-01-01", to: "2026-06-15" });
        }}
        defaultValue="last90"
        aria-label="Date range preset"
      >
        <option value="last30">Last 30 days</option>
        <option value="last90">Last 90 days</option>
        <option value="currentMonth">Current month</option>
        <option value="priorMonth">Prior month</option>
        <option value="ytd">Year to date</option>
      </select>
      <input
        aria-label="From date"
        type="date"
        value={range.from}
        onChange={(event) => setRange({ ...range, from: event.target.value })}
        className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
      />
      <input
        aria-label="To date"
        type="date"
        value={range.to}
        onChange={(event) => setRange({ ...range, to: event.target.value })}
        className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
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
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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

  if (event.type === "custody_day") {
    return withAudit(
      {
        ...dataset,
        custodyDayAssignments: removeOwnedRecordById(
          dataset.custodyDayAssignments,
          recordId,
          userId,
          caseId
        ),
      },
      { ...auditBase, entityType: "custodyDayAssignment" }
    );
  }

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

function buildMonthDays(monthKey: string) {
  const first = new Date(`${monthKey}-01T00:00:00.000Z`);
  const firstDay = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const days: Array<string | null> = Array.from({ length: firstDay }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(`${monthKey}-${String(day).padStart(2, "0")}`);
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
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

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
