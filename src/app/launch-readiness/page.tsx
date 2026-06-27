import Link from "next/link";
import {
  evaluateProductionReadiness,
  summarizeReadinessPhases,
  type ProductionReadinessCheck,
} from "@/lib/production/readiness";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Launch Readiness | Lost to Found Records",
  description: "Production launch gates for Lost to Found Records.",
};

const groups = [
  {
    title: "Platform",
    description: "Domain, runtime mode, Supabase project, and server secrets.",
    ids: [
      "app-url",
      "records-host",
      "records-storage-mode",
      "supabase-url",
      "supabase-production-project",
      "supabase-anon-key",
      "supabase-service-role",
      "auth-secret",
      "bearer-auth-disabled",
    ],
  },
  {
    title: "Identity",
    description: "Supabase Auth policy and records API session assurance.",
    ids: [
      "supabase-mfa-policy",
      "records-mfa-enforced",
      "supabase-leaked-passwords",
      "supabase-password-minimum",
      "supabase-password-reauth",
    ],
  },
  {
    title: "Evidence",
    description: "Private storage, upload limits, and malware scanning.",
    ids: [
      "records-evidence-bucket",
      "malware-provider",
      "malware-http-endpoint",
      "malware-scanner-tested",
      "evidence-size-limit",
    ],
  },
  {
    title: "Edge And Monitoring",
    description: "Provider controls, alerting, audit review, and contact paths.",
    ids: [
      "edge-rate-limits",
      "edge-waf",
      "security-monitoring",
      "security-event-sink",
      "audit-log-review",
      "security-contact",
    ],
  },
  {
    title: "Governance",
    description: "Restore tests, isolation proof, retention, incident, and legal review.",
    ids: [
      "backup-restore-tested",
      "two-user-isolation-tested",
      "data-retention-policy",
      "incident-response-plan",
      "privacy-policy",
      "legal-review",
      "vendor-security-review",
    ],
  },
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

function CheckRow({ check }: { check: ProductionReadinessCheck }) {
  return (
    <li className={`min-w-0 rounded-md border p-3 ${statusClass(check)}`}>
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
  );
}

export default function LaunchReadinessPage() {
  const report = evaluateProductionReadiness();
  const phases = summarizeReadinessPhases(report);
  const readyCount = report.checks.filter((check) => check.ready).length;
  const totalCount = report.checks.length;
  const percent = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
  const preSupabaseReadyCount = phases.preSupabaseChecks.filter((check) => check.ready).length;
  const preSupabasePercent =
    phases.preSupabaseChecks.length > 0
      ? Math.round((preSupabaseReadyCount / phases.preSupabaseChecks.length) * 100)
      : 0;
  const checksById = new Map(report.checks.map((check) => [check.id, check]));
  const ungrouped = report.checks.filter(
    (check) => !groups.some((group) => group.ids.includes(check.id))
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Production launch cockpit
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Records go-live readiness
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                This page reads the same launch gates as `/api/records/readiness`.
                It shows what is ready, what blocks real custody records, and
                what still needs external owner action.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/launch-wizard" className="btn-primary">
                  Open launch wizard
                </Link>
                <Link href="/records" className="btn-secondary">
                  Back to records
                </Link>
              </div>
            </div>
            <div
              className={`rounded-lg border p-4 text-sm ${
                report.ready
                  ? "border-teal-200 bg-teal-50 text-teal-950"
                  : "border-rose-200 bg-rose-50 text-rose-950"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide">
                {report.ready ? "Go" : "No-go"}
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {readyCount}/{totalCount} checks ready
              </p>
              <p className="mt-1 text-xs leading-5">
                {percent}% complete. Generated {new Date(report.generatedAt).toLocaleString()}.
              </p>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full ${report.ready ? "bg-teal-600" : "bg-amber-500"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div
            className={`rounded-lg border bg-white p-4 shadow-sm ${
              phases.preSupabaseReady ? "border-teal-200" : "border-amber-200"
            }`}
          >
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${
                phases.preSupabaseReady ? "text-teal-700" : "text-amber-700"
              }`}
            >
              Pre-Supabase
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {preSupabaseReadyCount}/{phases.preSupabaseChecks.length}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {preSupabasePercent}% of non-Supabase launch gates are passing now.
            </p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
              Blockers
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {report.blockers.length}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Must be resolved before real user records are accepted.
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Warnings
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {report.warnings.length}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Operational risks that should be closed for launch quality.
            </p>
          </div>
          <div className="rounded-lg border border-teal-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Verified
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {readyCount}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Checks that are currently passing in this environment.
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Fastest remaining path
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Complete the local and provider controls first, then finish
                Supabase as the last live-data step.
              </p>
            </div>
            <Link href="/launch-wizard" className="btn-secondary">
              Guided launch path
            </Link>
          </div>
          <ol className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 lg:grid-cols-2">
            <li className="rounded-md border border-slate-200 bg-slate-50 p-3">
              1. Verify template, secrets scan, tests, build, and header checks.
            </li>
            <li className="rounded-md border border-slate-200 bg-slate-50 p-3">
              2. Configure edge WAF/rate limits, monitoring delivery, and legal approvals.
            </li>
            <li className="rounded-md border border-slate-200 bg-slate-50 p-3">
              3. Run malware and security-event verifiers with production providers.
            </li>
            <li className="rounded-md border border-slate-200 bg-slate-50 p-3">
              4. Finish Supabase Auth, storage, restore, isolation, and live readiness.
            </li>
          </ol>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          {groups.map((group) => {
            const checks = group.ids
              .map((id) => checksById.get(id))
              .filter((check): check is ProductionReadinessCheck => Boolean(check));
            const complete = checks.filter((check) => check.ready).length;
            return (
              <section
                key={group.title}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      {group.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {group.description}
                    </p>
                  </div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {complete}/{checks.length}
                  </span>
                </div>
                <ul className="space-y-2">
                  {checks.map((check) => (
                    <CheckRow key={check.id} check={check} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {ungrouped.length > 0 && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Other Checks</h2>
            <ul className="mt-4 space-y-2">
              {ungrouped.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
