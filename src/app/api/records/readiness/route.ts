import { NextResponse } from "next/server";
import { evaluateProductionReadiness } from "@/lib/production/readiness";

export const dynamic = "force-dynamic";

export function GET() {
  const report = evaluateProductionReadiness();
  const status = report.ready ? 200 : process.env.NODE_ENV === "production" ? 503 : 200;

  return NextResponse.json(
    {
      status: report.ready ? "ready" : "not_ready",
      generatedAt: report.generatedAt,
      blockers: report.blockers.map(({ id, label, detail }) => ({ id, label, detail })),
      warnings: report.warnings.map(({ id, label, detail }) => ({ id, label, detail })),
      checks: report.checks.map(({ id, label, ready, severity }) => ({
        id,
        label,
        ready,
        severity,
      })),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
