import { readFile } from "node:fs/promises";
import path from "node:path";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function dateWithinDays(value, maxAgeDays) {
  const testedAt = Date.parse(value);
  const now = Date.now();
  if (!Number.isFinite(testedAt) || testedAt > now) return false;
  return now - testedAt <= maxAgeDays * 24 * 60 * 60 * 1000;
}

const evidencePath = process.env.BACKUP_RESTORE_EVIDENCE_FILE || "ops/backup-restore-evidence.json";
const expectedProjectRef = process.env.EXPECTED_SUPABASE_PROJECT_REF || "cieuilbpnwuvnrxrlczj";
const absolutePath = path.resolve(process.cwd(), evidencePath);

let evidence;
try {
  evidence = JSON.parse(await readFile(absolutePath, "utf8"));
} catch (error) {
  fail(`Unable to read backup restore evidence at ${evidencePath}: ${error.message}`);
}

const requiredTextFields = [
  "testedAt",
  "projectRef",
  "restoreSource",
  "restoreTarget",
  "validatedBy",
  "validationSummary",
];

for (const field of requiredTextFields) {
  if (!hasText(evidence[field])) fail(`Backup restore evidence is missing ${field}.`);
}

if (evidence.projectRef !== expectedProjectRef) {
  fail(`Backup restore evidence projectRef must be ${expectedProjectRef}.`);
}

if (!dateWithinDays(evidence.testedAt, 180)) {
  fail("Backup restore evidence testedAt must be an ISO date within the last 180 days.");
}

if (!Array.isArray(evidence.validationChecks) || evidence.validationChecks.length < 3) {
  fail("Backup restore evidence must include at least three validationChecks.");
}

for (const [index, item] of evidence.validationChecks.entries()) {
  if (!item || item.passed !== true || !hasText(item.label)) {
    fail(`Backup restore validationChecks[${index}] must include a label and passed=true.`);
  }
}

if (
  typeof evidence.restoredRecordCount !== "number" ||
  !Number.isFinite(evidence.restoredRecordCount) ||
  evidence.restoredRecordCount < 0
) {
  fail("Backup restore evidence restoredRecordCount must be a non-negative number.");
}

console.log(`Backup restore evidence verified at ${new Date().toISOString()}.`);
console.log(`BACKUP_RESTORE_TESTED_AT=${String(evidence.testedAt).slice(0, 10)}`);
