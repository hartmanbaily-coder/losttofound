import { NextRequest, NextResponse } from "next/server";
import {
  attachRefreshedRecordsSession,
  getRecordsAuthContext,
  isSupabaseRecordsMode,
} from "@/lib/records/authServer";
import {
  assertEvidenceItemAccess,
  getAuthoritativeEvidenceItem,
  getEvidenceBucket,
} from "@/lib/records/evidenceStorage";
import type { EvidenceItem } from "@/lib/records/types";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { recordSecurityEvent } from "@/lib/security/securityEvents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readEvidenceBody(request: NextRequest) {
  try {
    const body = (await request.json()) as { evidence?: Partial<EvidenceItem> };
    return body.evidence || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseRecordsMode()) {
    return NextResponse.json({ error: "Supabase records storage is not enabled." }, { status: 501 });
  }

  const rateLimit = checkRateLimit(request, {
    id: "records-evidence-delete",
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (rateLimit.limited) return rateLimitExceededResponse(rateLimit);

  const context = await getRecordsAuthContext(request);
  if ("error" in context) return context.error;

  const evidence = await readEvidenceBody(request);
  if (!evidence?.id) {
    return NextResponse.json({ error: "Evidence metadata is incomplete." }, { status: 400 });
  }

  const authoritative = await getAuthoritativeEvidenceItem({
    supabase: context.supabase,
    userId: context.userId,
    evidenceId: evidence.id,
    caseId: evidence.caseId,
  });
  if ("error" in authoritative) {
    return NextResponse.json({ error: authoritative.error }, { status: 404 });
  }

  const storedEvidence = authoritative.evidence;
  const access = assertEvidenceItemAccess(
    {
      id: storedEvidence.id,
      userId: storedEvidence.userId,
      caseId: storedEvidence.caseId,
      storagePath: storedEvidence.storagePath,
      malwareScanStatus: storedEvidence.malwareScanStatus,
    },
    { userId: context.userId, caseId: storedEvidence.caseId }
  );
  if (!access.ok) {
    await recordSecurityEvent({
      type: "evidence_delete_denied",
      severity: "high",
      request,
      userId: context.userId,
      caseId: storedEvidence.caseId,
      evidenceId: storedEvidence.id,
      status: 403,
    });
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  const storageBucket = getEvidenceBucket();
  const { error } = await context.supabase.storage.from(storageBucket).remove([storedEvidence.storagePath]);

  if (error) {
    return NextResponse.json({ error: "Unable to delete evidence file." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  return attachRefreshedRecordsSession(request, response, context);
}
