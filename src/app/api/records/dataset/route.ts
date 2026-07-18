import { NextRequest, NextResponse } from "next/server";
import {
  attachRefreshedRecordsSession,
  getRecordsAuthContext,
  getRecordsCaseKey,
  isSupabaseRecordsMode,
} from "@/lib/records/authServer";
import type { RecordsDataset } from "@/lib/records/types";
import { invalidateAttorneyAccessForCases } from "@/lib/records/attorneyAccess";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

const maxDatasetBytes = Number(process.env.RECORDS_DATASET_MAX_BYTES || 2_000_000);

function isRecordsDataset(input: unknown): input is RecordsDataset {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<Record<keyof RecordsDataset, unknown>>;
  return [
    candidate.users,
    candidate.matters,
    candidate.exchangeRules,
    candidate.scheduleExceptions,
    candidate.custodyDayAssignments,
    candidate.exchangeLogs,
    candidate.dateNotes,
    candidate.evidenceItems,
    candidate.childSupportOrders,
    candidate.childSupportPayments,
    candidate.expenseItems,
    candidate.auditLogs,
  ].every(Array.isArray);
}

function disabledResponse() {
  return NextResponse.json(
    {
      error: "Cloud records storage is not enabled.",
      detail: "Records storage is not configured for authenticated cloud access.",
    },
    { status: 501 }
  );
}

export async function GET(request: NextRequest) {
  if (!isSupabaseRecordsMode()) return disabledResponse();

  const rateLimit = checkRateLimit(request, {
    id: "records-dataset-read",
    limit: 240,
    windowMs: 60 * 1000,
  });
  if (rateLimit.limited) return rateLimitExceededResponse(rateLimit);

  const context = await getRecordsAuthContext(request);
  if ("error" in context) return context.error;

  const { supabase, userId } = context;
  const caseKey = getRecordsCaseKey(request);
  const { data, error } = await supabase
    .from("records_case_snapshots")
    .select("dataset, updated_at")
    .eq("user_id", userId)
    .eq("case_key", caseKey)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Unable to load records dataset." }, { status: 500 });
  }

  const response = NextResponse.json(
    {
      dataset: data?.dataset || null,
      updatedAt: data?.updated_at || null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
  return attachRefreshedRecordsSession(request, response, context);
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseRecordsMode()) return disabledResponse();

  const rateLimit = checkRateLimit(request, {
    id: "records-dataset-write",
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (rateLimit.limited) return rateLimitExceededResponse(rateLimit);

  const context = await getRecordsAuthContext(request);
  if ("error" in context) return context.error;

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > maxDatasetBytes) {
    return NextResponse.json({ error: "Records dataset is too large." }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = parsed as { dataset?: unknown };
  if (!isRecordsDataset(body.dataset)) {
    return NextResponse.json({ error: "Invalid records dataset shape." }, { status: 400 });
  }

  const { supabase, userId } = context;
  const caseKey = getRecordsCaseKey(request);
  const { data: currentRow, error: currentError } = await supabase
    .from("records_case_snapshots")
    .select("dataset")
    .eq("user_id", userId)
    .eq("case_key", caseKey)
    .maybeSingle();
  if (currentError) {
    return NextResponse.json({ error: "Unable to verify current records dataset." }, { status: 500 });
  }
  const currentDataset = currentRow?.dataset as Partial<RecordsDataset> | undefined;
  const nextCaseIds = new Set(
    body.dataset.matters.filter((matter) => matter.userId === userId).map((matter) => matter.id)
  );
  const removedCaseIds = (currentDataset?.matters || [])
    .filter((matter) => matter.userId === userId && !nextCaseIds.has(matter.id))
    .map((matter) => matter.id);
  const invalidation = await invalidateAttorneyAccessForCases({
    supabase,
    ownerUserId: userId,
    caseIds: removedCaseIds,
    reason: "case_deleted",
  });
  if (!invalidation.ok) {
    return NextResponse.json(
      { error: "Case deletion was stopped because shared access could not be revoked." },
      { status: 503 }
    );
  }
  const { error } = await supabase.from("records_case_snapshots").upsert(
    {
      user_id: userId,
      case_key: caseKey,
      dataset: body.dataset,
      schema_version: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,case_key" }
  );

  if (error) {
    return NextResponse.json({ error: "Unable to save records dataset." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  return attachRefreshedRecordsSession(request, response, context);
}
