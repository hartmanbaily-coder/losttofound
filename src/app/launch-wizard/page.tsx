import Link from "next/link";
import {
  evaluateProductionReadiness,
  summarizeReadinessPhases,
  type ProductionReadinessCheck,
} from "@/lib/production/readiness";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Launch Wizard | Lost to Found Records",
  description: "Guided production launch path for Lost to Found Records.",
};

const preSupabaseCommands = [
  {
    command: "npm run verify:env-template",
    detail: "Confirms the committed production template is complete and contains no real secrets.",
  },
  {
    command: "npm run security:secrets",
    detail: "Scans tracked source files for committed service keys, tokens, and private keys.",
  },
  {
    command: "npm run lint && npm run typecheck && npm run test:unit && npm run build",
    detail: "Verifies the application still compiles, types, and passes unit coverage.",
  },
  {
    command: "npm run check:pre-supabase",
    detail: "Blocks on non-Supabase launch gates while intentionally deferring the final Supabase step.",
  },
  {
    command: "npm run verify:headers",
    detail: "Checks CSP, HSTS, frame blocking, referrer policy, and browser permission restrictions.",
  },
  {
    command: "npm run verify:security-events",
    detail: "Emits or delivers a synthetic sanitized security event to the configured monitoring sink.",
  },
  {
    command: "npm run verify:malware",
    detail: "Verifies the production malware scanner with clean and EICAR test payloads.",
  },
];

const supabaseFinalCommands = [
  {
    command: "npm run verify:backup-restore",
    detail: "Runs after the production backup restore artifact exists at the ignored ops path.",
  },
  {
    command: "npm run verify:isolation",
    detail: "Runs with synthetic users after Supabase Auth, RLS, and private storage are live.",
  },
  {
    command: "npm run check:production",
    detail: "Requires every production environment variable and live verification date.",
  },
  {
    command: "npm run check:live",
    detail: "Confirms the deployed HTTPS readiness endpoint returns ready before traffic cutover.",
  },
];

const ownerDocuments = [
  "EDGE_SECURITY_RULES.md",
  "MONITORING_ALERTING_RUNBOOK.md",
  "DATA_RETENTION_DELETION_RUNBOOK.md",
  "INCIDENT_RESPONSE_RUNBOOK.md",
  "LEGAL_REVIEW_PACKET.md",
  "SUPABASE_LIVE_VERIFICATION.md",
];

function statusClass(check: ProductionReadinessCheck) {
  if (check.ready) return "border-teal-200 bg-teal-50 text-teal-900";
  if (check.severity === "blocker") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function statusLabel(check: ProductionReadinessCheck) {
  if (check.ready) return "Ready";
  return check.severity === "blocker" ? "Blocker" : "Warning";
}

function CommandList({
  title,
  commands,
}: {
  title: string;
  commands: Array<{ command: string; detail: string }>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 space-y-3">
        {commands.map((item) => (
          <div key={item.command} className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <code className="block text-sm font-semibold text-slate-950 [overflow-wrap:anywhere]">
              {item.command}
            </code>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CheckList({
  title,
  checks,
  empty,
}: {
  title: string;
  checks: ProductionReadinessCheck[];
  empty: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      {checks.length === 0 ? (
        <p className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm leading-6 text-teal-900">
          {empty}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {checks.map((check) => (
            <li key={check.id} className={`rounded-md border p-3 ${statusClass(check)}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold [overflow-wrap:anywhere]">{check.label}</p>
                  <p className="mt-1 text-xs leading-5 opacity-85 [overflow-wrap:anywhere]">
                    {check.detail}
                  </p>
                </div>
                <span className="shrink-0 rounded border border-current/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide">
                  {statusLabel(check)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function LaunchWizardPage() {
  const report = evaluateProductionReadiness();
  const phases = summarizeReadinessPhases(report);
  const preSupabaseReady = phases.preSupabaseChecks.filter((check) => check.ready).length;
  const supabaseReady = phases.supabaseFinalChecks.filter((check) => check.ready).length;
  const preSupabasePercent =
    phases.preSupabaseChecks.length > 0
      ? Math.round((preSupabaseReady / phases.preSupabaseChecks.length) * 100)
      : 0;
  const supabasePercent =
    phases.supabaseFinalChecks.length > 0
      ? Math.round((supabaseReady / phases.supabaseFinalChecks.length) * 100)
      : 0;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Production launch path
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Launch wizard
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Supabase is intentionally saved for last. This view separates
                the work that can be closed now from the final live database,
                auth, storage, restore, and isolation gates.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/launch-readiness" className="btn-primary">
                  Open launch cockpit
                </Link>
                <Link href="/records" className="btn-secondary">
                  Back to records
                </Link>
              </div>
            </div>
            <div
              className={`rounded-lg border p-4 text-sm ${
                phases.preSupabaseReady
                  ? "border-teal-200 bg-teal-50 text-teal-950"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide">
                {phases.preSupabaseReady ? "Pre-Supabase ready" : "Pre-Supabase blockers"}
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {preSupabaseReady}/{phases.preSupabaseChecks.length} checks
              </p>
              <p className="mt-1 text-xs leading-5">
                {preSupabasePercent}% complete before the final Supabase pass.
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Phase 1
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Everything before Supabase
            </h2>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-teal-600" style={{ width: `${preSupabasePercent}%` }} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Close host configuration, release checks, headers, monitoring,
              edge controls, malware scanning, and owner approvals first.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Phase 2
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Supabase final step
            </h2>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-amber-500" style={{ width: `${supabasePercent}%` }} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Finish production Supabase secrets, Auth hardening, private
              evidence storage, backup restore proof, and two-user isolation.
            </p>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <CommandList title="Run Now" commands={preSupabaseCommands} />
          <CommandList title="Run After Supabase" commands={supabaseFinalCommands} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <CheckList
            title="Current Pre-Supabase Blockers"
            checks={phases.preSupabaseBlockers}
            empty="No pre-Supabase blockers are currently reported by this environment."
          />
          <CheckList
            title="Supabase Last Blockers"
            checks={phases.supabaseFinalBlockers}
            empty="No Supabase-final blockers are currently reported by this environment."
          />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Owner Review Packet</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                These local documents are the non-code launch controls to close
                before real records are accepted.
              </p>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
              {ownerDocuments.length} files
            </span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {ownerDocuments.map((document) => (
              <div
                key={document}
                className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]"
              >
                {document}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
