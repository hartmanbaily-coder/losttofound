import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  attachRefreshedRecordsSession,
  getRecordsAuthContext,
  isSupabaseRecordsMode,
} from "@/lib/records/authServer";
import { evaluateEvidenceIntakeReadiness, validateEvidencePreflight } from "@/lib/records/evidenceSecurity";
import {
  buildEvidenceStoragePath,
  getEvidenceBucket,
} from "@/lib/records/evidenceStorage";
import { scanEvidenceFile } from "@/lib/records/malwareScanner";
import { buildStoredEvidenceName, validateEvidenceFileSignature } from "@/lib/records/validation";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { recordSecurityEvent } from "@/lib/security/securityEvents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function disabledResponse() {
  return NextResponse.json(
    {
      error: "Cloud records storage is not enabled.",
      detail: "Enable authenticated cloud records storage before evidence upload.",
    },
    { status: 501 }
  );
}

function isFileLike(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "type" in value &&
    "size" in value &&
    "arrayBuffer" in value
  );
}

export async function POST(request: NextRequest) {
  if (!isSupabaseRecordsMode()) return disabledResponse();

  const rateLimit = checkRateLimit(request, {
    id: "records-evidence-upload",
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimit.limited) return rateLimitExceededResponse(rateLimit);

  const context = await getRecordsAuthContext(request);
  if ("error" in context) return context.error;

  const readiness = evaluateEvidenceIntakeReadiness();
  if (!readiness.ready) {
    return attachRefreshedRecordsSession(
      request,
      NextResponse.json(
        {
          error: "Evidence upload is temporarily unavailable.",
        },
        { status: 503 }
      ),
      context
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const caseId = String(formData.get("caseId") || "");
  const evidenceId = String(formData.get("evidenceId") || "");

  if (!caseId || !evidenceId) {
    return NextResponse.json({ error: "Missing evidence case or id." }, { status: 400 });
  }

  if (!isFileLike(file)) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }

  const validation = validateEvidencePreflight({
    originalFileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const signatureValidation = validateEvidenceFileSignature(
    {
      originalFileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    },
    buffer
  );
  if (!signatureValidation.ok) {
    return NextResponse.json({ error: signatureValidation.error }, { status: 400 });
  }

  const scan = await scanEvidenceFile({
    buffer,
    fileName: file.name,
    fileType: file.type,
  });

  if (scan.status === "blocked") {
    await recordSecurityEvent({
      type: "evidence_upload_scanner_blocked",
      severity: "high",
      request,
      userId: context.userId,
      caseId,
      evidenceId,
      status: 422,
      detail: scan.provider,
    });
    return NextResponse.json(
      {
        error: "Evidence upload blocked by malware scan.",
        malwareScanStatus: "blocked",
      },
      { status: 422 }
    );
  }

  if (scan.status !== "clean") {
    await recordSecurityEvent({
      type: "evidence_upload_scanner_failed",
      severity: "high",
      request,
      userId: context.userId,
      caseId,
      evidenceId,
      status: 503,
      detail: scan.provider,
    });
    return NextResponse.json(
      {
        error: "Evidence upload could not be scanned.",
        malwareScanStatus: "failed",
      },
      { status: 503 }
    );
  }

  const storageBucket = getEvidenceBucket();
  const storagePath = buildEvidenceStoragePath({
    userId: context.userId,
    caseId,
    evidenceId,
    originalFileName: file.name,
  });
  const storedFileName = buildStoredEvidenceName({ id: evidenceId, originalFileName: file.name });
  const storageSha256 = createHash("sha256").update(buffer).digest("hex");

  const { error: uploadError } = await context.supabase.storage.from(storageBucket).upload(
    storagePath,
    buffer,
    {
      cacheControl: "0",
      contentType: file.type,
      upsert: false,
    }
  );

  if (uploadError) {
    await recordSecurityEvent({
      type: "evidence_storage_failed",
      severity: "high",
      request,
      userId: context.userId,
      caseId,
      evidenceId,
      status: 500,
    });
    return NextResponse.json({ error: "Unable to store evidence file." }, { status: 500 });
  }

  const response = NextResponse.json(
    {
      evidence: {
        id: evidenceId,
        userId: context.userId,
        caseId,
        originalFileName: file.name,
        storedFileName,
        fileType: file.type,
        fileSize: file.size,
        storageBucket,
        storagePath,
        storageSha256,
        storageUploadedAt: new Date().toISOString(),
        malwareScanStatus: "clean",
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );

  return attachRefreshedRecordsSession(request, response, context);
}
