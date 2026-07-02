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
    blockers.push("Cloud records storage is not enabled for evidence intake.");
  }

  if (placeholderProviders.has(provider)) {
    blockers.push("Evidence malware scanning is not available.");
  }

  if ((provider === "http" || provider === "webhook") && !env.MALWARE_SCAN_ENDPOINT) {
    blockers.push("Evidence malware scanning endpoint is not configured.");
  }

  if (!env.RECORDS_EVIDENCE_BUCKET) {
    blockers.push("Private evidence storage is not configured.");
  }

  if (!Number.isFinite(maxBytes) || maxBytes <= 0 || maxBytes > 25 * 1024 * 1024) {
    blockers.push("Evidence upload size limit is not configured.");
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}

export function validateEvidencePreflight(candidate: EvidenceFileCandidate) {
  return validateEvidenceFile(candidate);
}
