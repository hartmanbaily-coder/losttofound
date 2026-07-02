import { describe, expect, it } from "vitest";
import { evaluateEvidenceIntakeReadiness } from "@/lib/records/evidenceSecurity";

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
});
