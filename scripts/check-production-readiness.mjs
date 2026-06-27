const placeholderValues = new Set([
  "",
  "changeme",
  "change-me",
  "example",
  "example.invalid",
  "clamav-or-vendor-name",
  "cloudflare-or-provider",
  "mock-clean",
  "platform-or-siem",
  "security@example.invalid",
]);

function hasValue(value) {
  return Boolean(value && !placeholderValues.has(value.trim().toLowerCase()));
}

function isHttpsUrl(value) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function hasStrongSecret(value) {
  return hasValue(value) && value.length >= 32;
}

function isEnabled(value) {
  return ["true", "enabled", "yes", "1"].includes(String(value || "").trim().toLowerCase());
}

function isOneOf(value, allowed) {
  return hasValue(value) && allowed.includes(String(value || "").trim().toLowerCase());
}

function supabaseProjectRef(value) {
  if (!value) return "";
  try {
    const host = new URL(value).hostname;
    if (!host.endsWith(".supabase.co")) return "";
    return host.split(".")[0] || "";
  } catch {
    return "";
  }
}

function numberAtLeast(value, minimum) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed >= minimum;
}

const mode = process.argv.includes("--pre-supabase") ? "pre-supabase" : "production";
const supabaseFinalEnvNames = new Set([
  "RECORDS_STORAGE_MODE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "EXPECTED_SUPABASE_PROJECT_REF",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_MFA_POLICY",
  "RECORDS_ENFORCE_MFA",
  "SUPABASE_LEAKED_PASSWORD_PROTECTION_ENABLED",
  "SUPABASE_PASSWORD_MIN_LENGTH",
  "SUPABASE_PASSWORD_REAUTH_ENABLED",
  "RECORDS_EVIDENCE_BUCKET",
  "BACKUP_RESTORE_TESTED_AT",
  "TWO_USER_ISOLATION_TESTED_AT",
]);

function isSkippedForMode(name) {
  return mode === "pre-supabase" && supabaseFinalEnvNames.has(name);
}

function isRecentDate(value, maxAgeDays) {
  if (!value) return false;
  const testedAt = Date.parse(value);
  const now = Date.now();
  if (!Number.isFinite(testedAt) || testedAt > now) return false;
  return now - testedAt <= maxAgeDays * 24 * 60 * 60 * 1000;
}

const malwareProvider = (process.env.MALWARE_SCAN_PROVIDER || "").trim().toLowerCase();
const evidenceMaxBytes = Number(process.env.EVIDENCE_MAX_FILE_BYTES || 0);
const securityEventSink = (process.env.SECURITY_EVENT_SINK || "").trim().toLowerCase();
const configuredSupabaseRef = supabaseProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
const expectedSupabaseRef = (process.env.EXPECTED_SUPABASE_PROJECT_REF || "").trim();

const checks = [
  ["NEXT_PUBLIC_APP_URL", isHttpsUrl(process.env.NEXT_PUBLIC_APP_URL), "must be an https:// URL"],
  [
    "NEXT_PUBLIC_RECORDS_HOST",
    hasValue(process.env.NEXT_PUBLIC_RECORDS_HOST) &&
      !["localhost", "127.0.0.1"].includes(process.env.NEXT_PUBLIC_RECORDS_HOST),
    "must be the production host, not localhost",
  ],
  [
    "RECORDS_STORAGE_MODE",
    process.env.RECORDS_STORAGE_MODE === "supabase" &&
      process.env.NEXT_PUBLIC_RECORDS_STORAGE_MODE === "supabase",
    "and NEXT_PUBLIC_RECORDS_STORAGE_MODE must both be set to supabase",
  ],
  [
    "NEXT_PUBLIC_SUPABASE_URL",
    isHttpsUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    "must be an https:// Supabase URL",
  ],
  [
    "EXPECTED_SUPABASE_PROJECT_REF",
    configuredSupabaseRef !== "adhnoiicwfvppzenwcgv" &&
      (!hasValue(expectedSupabaseRef) || configuredSupabaseRef === expectedSupabaseRef),
    "must match the clean records production project and must not point at the old staging project",
  ],
  [
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    hasValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    "must be configured",
  ],
  [
    "SUPABASE_SERVICE_ROLE_KEY",
    hasValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
    "must be configured as a server-only secret",
  ],
  ["AUTH_SECRET", hasStrongSecret(process.env.AUTH_SECRET), "must be at least 32 characters"],
  ["SUPABASE_MFA_POLICY", process.env.SUPABASE_MFA_POLICY === "required", "must be required"],
  ["RECORDS_ENFORCE_MFA", isEnabled(process.env.RECORDS_ENFORCE_MFA), "must be true"],
  [
    "SUPABASE_LEAKED_PASSWORD_PROTECTION_ENABLED",
    isEnabled(process.env.SUPABASE_LEAKED_PASSWORD_PROTECTION_ENABLED),
    "must be true",
  ],
  [
    "SUPABASE_PASSWORD_MIN_LENGTH",
    numberAtLeast(process.env.SUPABASE_PASSWORD_MIN_LENGTH, 12),
    "must be at least 12",
  ],
  [
    "SUPABASE_PASSWORD_REAUTH_ENABLED",
    isEnabled(process.env.SUPABASE_PASSWORD_REAUTH_ENABLED) &&
      isEnabled(process.env.SUPABASE_CURRENT_PASSWORD_REQUIRED),
    "and SUPABASE_CURRENT_PASSWORD_REQUIRED must both be true",
  ],
  ["RECORDS_EVIDENCE_BUCKET", hasValue(process.env.RECORDS_EVIDENCE_BUCKET), "must be the private evidence bucket"],
  [
    "MALWARE_SCAN_PROVIDER",
    hasValue(process.env.MALWARE_SCAN_PROVIDER),
    "must be selected before real evidence uploads",
  ],
  [
    "MALWARE_SCAN_ENDPOINT",
    !["http", "webhook"].includes(malwareProvider) || isHttpsUrl(process.env.MALWARE_SCAN_ENDPOINT),
    "must be an https:// endpoint when MALWARE_SCAN_PROVIDER is http or webhook",
  ],
  [
    "MALWARE_SCANNER_TESTED_AT",
    isRecentDate(process.env.MALWARE_SCANNER_TESTED_AT, 30),
    "must be an ISO date within the last 30 days after npm run verify:malware passes",
  ],
  [
    "EVIDENCE_MAX_FILE_BYTES",
    Number.isFinite(evidenceMaxBytes) && evidenceMaxBytes > 0 && evidenceMaxBytes <= 25 * 1024 * 1024,
    "must be a positive upload limit no larger than 25 MB",
  ],
  [
    "EDGE_RATE_LIMITING_ENABLED",
    isEnabled(process.env.EDGE_RATE_LIMITING_ENABLED) && hasValue(process.env.EDGE_RATE_LIMITING_PROVIDER),
    "must be true and EDGE_RATE_LIMITING_PROVIDER must name the provider",
  ],
  [
    "EDGE_WAF_ENABLED",
    isEnabled(process.env.EDGE_WAF_ENABLED) && hasValue(process.env.EDGE_WAF_PROVIDER),
    "must be true and EDGE_WAF_PROVIDER must name the provider",
  ],
  ["SECURITY_MONITORING_ENABLED", isEnabled(process.env.SECURITY_MONITORING_ENABLED), "must be true"],
  [
    "SECURITY_EVENT_SINK",
    isOneOf(process.env.SECURITY_EVENT_SINK, ["platform", "siem", "webhook"]) &&
      (securityEventSink !== "webhook" || isHttpsUrl(process.env.SECURITY_EVENT_WEBHOOK_URL)),
    "must be platform, siem, or webhook; webhook requires HTTPS SECURITY_EVENT_WEBHOOK_URL",
  ],
  [
    "BACKUP_RESTORE_TESTED_AT",
    isRecentDate(process.env.BACKUP_RESTORE_TESTED_AT, 180),
    "must be an ISO date within the last 180 days",
  ],
  [
    "TWO_USER_ISOLATION_TESTED_AT",
    isRecentDate(process.env.TWO_USER_ISOLATION_TESTED_AT, 30),
    "must be an ISO date within the last 30 days",
  ],
  ["DATA_RETENTION_POLICY_APPROVED", isEnabled(process.env.DATA_RETENTION_POLICY_APPROVED), "must be true"],
  ["INCIDENT_RESPONSE_PLAN_APPROVED", isEnabled(process.env.INCIDENT_RESPONSE_PLAN_APPROVED), "must be true"],
  ["LEGAL_REVIEW_APPROVED", isEnabled(process.env.LEGAL_REVIEW_APPROVED), "must be true"],
  ["PRIVACY_POLICY_URL", isHttpsUrl(process.env.PRIVACY_POLICY_URL), "must be an https:// URL"],
  [
    "SECURITY_CONTACT_EMAIL",
    hasValue(process.env.SECURITY_CONTACT_EMAIL) && process.env.SECURITY_CONTACT_EMAIL.includes("@"),
    "must be a monitored email address",
  ],
];

const warnings = [
  [
    "VENDOR_SECURITY_REVIEW_APPROVED",
    isEnabled(process.env.VENDOR_SECURITY_REVIEW_APPROVED),
    "should be true after reviewing Supabase, hosting, malware scanning, email, logging, and monitoring vendors",
  ],
  [
    "AUDIT_LOG_REVIEW_ENABLED",
    isEnabled(process.env.AUDIT_LOG_REVIEW_ENABLED),
    "should be true after defining recurring review of auth, evidence, export, and admin audit events",
  ],
];

const activeChecks = checks.filter(([name]) => !isSkippedForMode(name));
const activeWarnings = warnings.filter(([name]) => !isSkippedForMode(name));
const failures = activeChecks.filter(([, ok]) => !ok);
const warningFailures = activeWarnings.filter(([, ok]) => !ok);

if (warningFailures.length > 0) {
  console.warn(
    mode === "pre-supabase"
      ? "Pre-Supabase readiness warnings:"
      : "Production readiness warnings:"
  );
  for (const [name, , reason] of warningFailures) {
    console.warn(`- ${name}: ${reason}`);
  }
}

if (failures.length > 0) {
  console.error(
    mode === "pre-supabase" ? "Pre-Supabase readiness failed:" : "Production readiness failed:"
  );
  for (const [name, , reason] of failures) {
    console.error(`- ${name}: ${reason}`);
  }
  process.exit(1);
}

if (mode === "pre-supabase") {
  console.log("Pre-Supabase readiness checks passed. Supabase final-step gates were intentionally deferred.");
} else {
  console.log("Production readiness checks passed.");
}
