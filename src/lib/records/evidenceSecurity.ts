import { maxEvidenceFileBytes, validateEvidenceFile, type EvidenceFileCandidate } from "./validation";

type EnvSource = Record<string, string | undefined>;

const placeholderProviders = new Set([
  "",
  "none",
  "not_configured",
  "not-configured",
  "clamav-or-vendor-name",
  "mock-clean",
  "example",
]);

export interface EvidenceIntakeReport {
  ready: boolean;
  blockers: string[];
}

export function evaluateEvidenceIntakeReadiness(
  env: EnvSource = process.env
): EvidenceIntakeReport {
  const blockers: string[] = [];
  const provider = (env.MALWARE_SCAN_PROVIDER || "").trim().toLowerCase();
  const maxBytes = Number(env.EVIDENCE_MAX_FILE_BYTES || maxEvidenceFileBytes);

  if (env.RECORDS_STORAGE_MODE !== "supabase") {
    blockers.push("Supabase records storage must be enabled before evidence intake.");
  }

  if (placeholderProviders.has(provider)) {
    blockers.push("Configure a real malware scanning provider before evidence intake.");
  }

  if ((provider === "http" || provider === "webhook") && !env.MALWARE_SCAN_ENDPOINT) {
    blockers.push("Configure MALWARE_SCAN_ENDPOINT for the HTTP malware scanning provider.");
  }

  if (!env.RECORDS_EVIDENCE_BUCKET) {
    blockers.push("Configure RECORDS_EVIDENCE_BUCKET for private evidence storage.");
  }

  if (!Number.isFinite(maxBytes) || maxBytes <= 0 || maxBytes > 25 * 1024 * 1024) {
    blockers.push("Configure EVIDENCE_MAX_FILE_BYTES to a positive limit no larger than 25 MB.");
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}

export function validateEvidencePreflight(candidate: EvidenceFileCandidate) {
  return validateEvidenceFile(candidate);
}
