import { describe, expect, it } from "vitest";
import { evaluateEvidenceIntakeReadiness } from "@/lib/records/evidenceSecurity";
import {
  normalizeEvidenceFileType,
  validateEvidenceFile,
  validateEvidenceFileSignature,
} from "@/lib/records/validation";

describe("evidence intake readiness", () => {
  it("blocks placeholder malware providers", () => {
    const report = evaluateEvidenceIntakeReadiness({
      RECORDS_STORAGE_MODE: "supabase",
      RECORDS_EVIDENCE_BUCKET: "records-evidence",
      MALWARE_SCAN_PROVIDER: "clamav-or-vendor-name",
      EVIDENCE_MAX_FILE_BYTES: "10485760",
    });

    expect(report.ready).toBe(false);
    expect(report.blockers).toContain("Evidence malware scanning is not available.");
  });

  it("passes when Supabase storage and malware scanning are configured", () => {
    const report = evaluateEvidenceIntakeReadiness({
      RECORDS_STORAGE_MODE: "supabase",
      RECORDS_EVIDENCE_BUCKET: "records-evidence",
      MALWARE_SCAN_PROVIDER: "clamav",
      EVIDENCE_MAX_FILE_BYTES: "10485760",
    });

    expect(report.ready).toBe(true);
    expect(report.blockers).toHaveLength(0);
  });

  it("requires an endpoint for HTTP malware scanners", () => {
    const report = evaluateEvidenceIntakeReadiness({
      RECORDS_STORAGE_MODE: "supabase",
      RECORDS_EVIDENCE_BUCKET: "records-evidence",
      MALWARE_SCAN_PROVIDER: "http",
      EVIDENCE_MAX_FILE_BYTES: "10485760",
    });

    expect(report.ready).toBe(false);
    expect(report.blockers).toContain("Evidence malware scanning endpoint is not configured.");
  });

  it("blocks the non-production mock scanner", () => {
    const report = evaluateEvidenceIntakeReadiness({
      RECORDS_STORAGE_MODE: "supabase",
      RECORDS_EVIDENCE_BUCKET: "records-evidence",
      MALWARE_SCAN_PROVIDER: "mock-clean",
      EVIDENCE_MAX_FILE_BYTES: "10485760",
    });

    expect(report.ready).toBe(false);
    expect(report.blockers).toContain("Evidence malware scanning is not available.");
  });

  it("validates evidence file signatures before upload", () => {
    expect(
      validateEvidenceFileSignature(
        { originalFileName: "order.pdf", fileType: "application/pdf", fileSize: 12 },
        Buffer.from("%PDF-1.7\nbody", "utf8")
      )
    ).toEqual({ ok: true });

    expect(
      validateEvidenceFileSignature(
        { originalFileName: "order.pdf", fileType: "application/pdf", fileSize: 12 },
        Buffer.from("not a pdf", "utf8")
      )
    ).toMatchObject({ ok: false });

    expect(
      validateEvidenceFileSignature(
        { originalFileName: "notes.txt", fileType: "text/plain", fileSize: 5 },
        Buffer.from([0x68, 0x69, 0x00])
      )
    ).toMatchObject({ ok: false });
  });

  it("normalizes browser file types for advertised document and message imports", () => {
    const docxType = normalizeEvidenceFileType({
      originalFileName: "custody-order.docx",
      fileType: "application/octet-stream",
    });
    const htmlType = normalizeEvidenceFileType({
      originalFileName: "message-archive.html",
      fileType: "",
    });

    expect(docxType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(htmlType).toBe("text/html");
    expect(
      validateEvidenceFile({
        originalFileName: "custody-order.docx",
        fileType: docxType,
        fileSize: 100,
      })
    ).toEqual({ ok: true });
    expect(
      validateEvidenceFile({
        originalFileName: "message-archive.html",
        fileType: htmlType,
        fileSize: 100,
      })
    ).toEqual({ ok: true });
  });
});
