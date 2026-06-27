import { describe, expect, it } from "vitest";
import {
  assertEvidenceItemAccess,
  buildEvidenceStoragePath,
  findEvidenceItemInSnapshots,
  isEvidenceStoragePathOwnedByUser,
} from "@/lib/records/evidenceStorage";

describe("evidence storage access helpers", () => {
  it("builds storage paths under the authenticated user and case", () => {
    const path = buildEvidenceStoragePath({
      userId: "user_a",
      caseId: "case_1",
      evidenceId: "evidence_9",
      originalFileName: "exchange note.pdf",
    });

    expect(path).toBe("user_a/case_1/evidence_9/evidence_9.pdf");
    expect(isEvidenceStoragePathOwnedByUser(path, "user_a")).toBe(true);
    expect(isEvidenceStoragePathOwnedByUser(path, "user_b")).toBe(false);
  });

  it("rejects evidence metadata with a mismatched owner or path prefix", () => {
    const path = buildEvidenceStoragePath({
      userId: "user_a",
      caseId: "case_1",
      evidenceId: "evidence_9",
      originalFileName: "exchange note.pdf",
    });

    expect(
      assertEvidenceItemAccess(
        {
          id: "evidence_9",
          userId: "user_a",
          caseId: "case_1",
          storagePath: path,
          malwareScanStatus: "clean",
        },
        { userId: "user_a", caseId: "case_1" }
      )
    ).toEqual({ ok: true });

    expect(
      assertEvidenceItemAccess(
        {
          id: "evidence_9",
          userId: "user_b",
          caseId: "case_1",
          storagePath: path.replace("user_a", "user_b"),
          malwareScanStatus: "clean",
        },
        { userId: "user_a", caseId: "case_1" }
      )
    ).toMatchObject({ ok: false });

    expect(
      assertEvidenceItemAccess(
        {
          id: "evidence_9",
          userId: "user_a",
          caseId: "case_1",
          storagePath: "user_a/case_2/evidence_9/evidence_9.pdf",
          malwareScanStatus: "clean",
        },
        { userId: "user_a", caseId: "case_1" }
      )
    ).toMatchObject({ ok: false });
  });

  it("finds evidence only from the authenticated user's stored snapshot", () => {
    const rows = [
      {
        dataset: {
          evidenceItems: [
            {
              id: "evidence_9",
              userId: "user_b",
              caseId: "case_1",
              originalFileName: "other.pdf",
              storedFileName: "evidence_9.pdf",
              fileType: "application/pdf",
              fileSize: 10,
              storagePath: "user_b/case_1/evidence_9/evidence_9.pdf",
              uploadedAt: "2026-06-01T00:00:00.000Z",
              tags: [],
              includeInReports: true,
              createdAt: "2026-06-01T00:00:00.000Z",
              updatedAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        },
      },
      {
        dataset: {
          evidenceItems: [
            {
              id: "evidence_9",
              userId: "user_a",
              caseId: "case_1",
              originalFileName: "exchange note.pdf",
              storedFileName: "evidence_9.pdf",
              fileType: "application/pdf",
              fileSize: 10,
              storagePath: "user_a/case_1/evidence_9/evidence_9.pdf",
              uploadedAt: "2026-06-01T00:00:00.000Z",
              tags: [],
              includeInReports: true,
              createdAt: "2026-06-01T00:00:00.000Z",
              updatedAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        },
      },
    ];

    const evidence = findEvidenceItemInSnapshots(rows, {
      userId: "user_a",
      caseId: "case_1",
      evidenceId: "evidence_9",
    });

    expect(evidence?.storagePath).toBe("user_a/case_1/evidence_9/evidence_9.pdf");
    expect(
      findEvidenceItemInSnapshots(rows, {
        userId: "user_a",
        caseId: "case_2",
        evidenceId: "evidence_9",
      })
    ).toBeNull();
  });
});
