import type { EvidenceItem } from "./types";
import { buildStoredEvidenceName } from "./validation";

export const defaultEvidenceBucket = "records-evidence";

interface EvidenceSnapshotRow {
  dataset?: {
    evidenceItems?: unknown;
  } | null;
}

interface EvidenceSnapshotQuery {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      order: (column: string, options: { ascending: boolean }) => {
        limit: (count: number) => PromiseLike<{ data: EvidenceSnapshotRow[] | null; error: unknown }>;
      };
    };
  };
}

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 160);
}

export function getEvidenceBucket(env: Record<string, string | undefined> = process.env) {
  return env.RECORDS_EVIDENCE_BUCKET || defaultEvidenceBucket;
}

export function buildEvidenceStoragePath(input: {
  userId: string;
  caseId: string;
  evidenceId: string;
  originalFileName: string;
}) {
  const storedFileName = buildStoredEvidenceName({
    id: safePathSegment(input.evidenceId),
    originalFileName: input.originalFileName,
  });

  return [
    safePathSegment(input.userId),
    safePathSegment(input.caseId),
    safePathSegment(input.evidenceId),
    storedFileName,
  ].join("/");
}

export function isEvidenceStoragePathOwnedByUser(path: string, userId: string) {
  const prefix = `${safePathSegment(userId)}/`;
  return Boolean(path && !path.includes("..") && path.startsWith(prefix));
}

export function assertEvidenceItemAccess(
  item: Pick<EvidenceItem, "id" | "userId" | "caseId" | "storagePath" | "malwareScanStatus">,
  input: { userId: string; caseId: string }
) {
  if (item.userId !== input.userId || item.caseId !== input.caseId) {
    return { ok: false as const, error: "Evidence record is not owned by the authenticated user." };
  }

  const expectedPrefix = [
    safePathSegment(input.userId),
    safePathSegment(input.caseId),
    safePathSegment(item.id),
    "",
  ].join("/");

  if (
    !item.storagePath ||
    !isEvidenceStoragePathOwnedByUser(item.storagePath, input.userId) ||
    !item.storagePath.startsWith(expectedPrefix)
  ) {
    return { ok: false as const, error: "Evidence storage path is invalid." };
  }

  return { ok: true as const };
}

function isStoredEvidenceItem(value: unknown): value is EvidenceItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<EvidenceItem>;
  return (
    typeof item.id === "string" &&
    typeof item.userId === "string" &&
    typeof item.caseId === "string" &&
    typeof item.originalFileName === "string" &&
    typeof item.storedFileName === "string" &&
    typeof item.fileType === "string" &&
    typeof item.storagePath === "string"
  );
}

export function findEvidenceItemInSnapshots(
  rows: EvidenceSnapshotRow[],
  input: { userId: string; evidenceId: string; caseId?: string }
) {
  for (const row of rows) {
    const evidenceItems = row.dataset?.evidenceItems;
    if (!Array.isArray(evidenceItems)) continue;

    const item = evidenceItems.find(
      (candidate) =>
        isStoredEvidenceItem(candidate) &&
        candidate.id === input.evidenceId &&
        candidate.userId === input.userId &&
        (!input.caseId || candidate.caseId === input.caseId)
    );

    if (item) return item;
  }

  return null;
}

export async function getAuthoritativeEvidenceItem(input: {
  supabase: unknown;
  userId: string;
  evidenceId: string;
  caseId?: string;
}) {
  const supabase = input.supabase as {
    from: (table: "records_case_snapshots") => EvidenceSnapshotQuery;
  };
  const { data, error } = await supabase
    .from("records_case_snapshots")
    .select("dataset")
    .eq("user_id", input.userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return { error: "Unable to verify evidence record." } as const;
  }

  const evidence = findEvidenceItemInSnapshots(data || [], {
    userId: input.userId,
    evidenceId: input.evidenceId,
    caseId: input.caseId,
  });

  if (!evidence) {
    return { error: "Evidence record was not found for this account." } as const;
  }

  return { evidence } as const;
}
