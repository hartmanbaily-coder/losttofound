import { z } from "zod";
import type { EvidenceItem } from "./types";

export const timezoneSchema = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Enter a valid IANA timezone.");

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

export const timeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Use HH:mm.");

export const moneySchema = z.coerce
  .number()
  .finite()
  .min(0)
  .max(1_000_000);

export const custodyMatterSchema = z.object({
  caseName: z.string().trim().min(2).max(120),
  courtOrOrderNickname: z.string().trim().max(120).optional().or(z.literal("")),
  courtName: z.string().trim().max(160).optional().or(z.literal("")),
  orderDate: dateStringSchema.optional().or(z.literal("")),
  effectiveStartDate: dateStringSchema.optional().or(z.literal("")),
  effectiveEndDate: dateStringSchema.optional().or(z.literal("")),
  childDisplayLabels: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  userRoleLabel: z.string().trim().min(1).max(60),
  otherParentLabel: z.string().trim().min(1).max(60),
  defaultExchangeLocation: z.string().trim().max(160).optional().or(z.literal("")),
  timezone: timezoneSchema,
  notes: z.string().trim().max(2_000).optional().or(z.literal("")),
});

export const exchangeRuleSchema = z.object({
  ruleName: z.string().trim().min(2).max(120),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  orderedExchangeTime: timeStringSchema,
  direction: z.enum(["other_parent_to_me", "me_to_other_parent"]),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  effectiveStartDate: dateStringSchema,
  effectiveEndDate: dateStringSchema.optional().or(z.literal("")),
  orderProvisionNotes: z.string().trim().max(2_000).optional().or(z.literal("")),
});

export const exchangeLogSchema = z.object({
  orderedExchangeAt: z.string().datetime(),
  actualExchangeAt: z.string().datetime().optional().nullable(),
  direction: z.enum(["other_parent_to_me", "me_to_other_parent"]),
  status: z.enum([
    "completed_on_time",
    "completed_late",
    "completed_early",
    "missed",
    "refused",
    "modified_by_agreement",
    "canceled",
    "other",
  ]),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  reasonGiven: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(2_000).optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  witnesses: z.string().trim().max(500).optional().or(z.literal("")),
});

export const custodyDayColors = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#b45309",
  "#475569",
  "#be123c",
] as const;

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a valid hex color.");

export const custodyDayAssignmentSchema = z.object({
  date: dateStringSchema,
  caregiverLabel: z.string().trim().min(1).max(60),
  color: hexColorSchema,
  startsAt: timeStringSchema.optional().or(z.literal("")),
  endsAt: timeStringSchema.optional().or(z.literal("")),
  exchangeTime: timeStringSchema.optional().or(z.literal("")),
  exchangeDirection: z
    .enum(["other_parent_to_me", "me_to_other_parent"])
    .optional()
    .or(z.literal("")),
  exchangeLocation: z.string().trim().max(160).optional().or(z.literal("")),
  notes: z.string().trim().max(1_000).optional().or(z.literal("")),
});

export const dateNoteSchema = z.object({
  noteDate: dateStringSchema,
  noteTime: timeStringSchema.optional().or(z.literal("")),
  category: z.enum([
    "exchange",
    "communication",
    "school",
    "medical",
    "expense",
    "child_support",
    "safety",
    "schedule_change",
    "child_item",
    "attorney",
    "court",
    "other",
  ]),
  title: z.string().trim().min(2).max(140),
  body: z.string().trim().min(1).max(5_000),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  includeInReports: z.boolean(),
});

export const childSupportOrderSchema = z.object({
  orderNickname: z.string().trim().min(2).max(120),
  orderedAmount: moneySchema,
  currency: z.string().trim().length(3),
  paymentFrequency: z.enum([
    "weekly",
    "biweekly",
    "monthly",
    "semi_monthly",
    "custom",
  ]),
  dueDayOrSchedule: z.string().trim().min(1).max(120),
  effectiveStartDate: dateStringSchema,
  effectiveEndDate: dateStringSchema.optional().or(z.literal("")),
  payerLabel: z.string().trim().min(1).max(60),
  recipientLabel: z.string().trim().min(1).max(60),
  paymentMethodExpected: z.string().trim().max(120).optional().or(z.literal("")),
  agencyOrCaseNumber: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(2_000).optional().or(z.literal("")),
});

export const childSupportPaymentSchema = z.object({
  childSupportOrderId: z.string().min(1),
  dueDate: dateStringSchema,
  amountDue: moneySchema,
  amountPaid: moneySchema,
  paymentDate: dateStringSchema.optional().or(z.literal("")),
  paymentStatus: z.enum([
    "paid",
    "partial",
    "unpaid",
    "late",
    "disputed",
    "waived_by_agreement",
    "unknown",
  ]),
  paymentMethod: z.enum([
    "state_agency",
    "wage_withholding",
    "bank_transfer",
    "check",
    "cash",
    "money_order",
    "payment_app",
    "other",
    "unknown",
  ]),
  referenceNumber: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(2_000).optional().or(z.literal("")),
});

export const expenseItemSchema = z.object({
  expenseDate: dateStringSchema,
  category: z.enum([
    "medical",
    "school",
    "childcare",
    "extracurricular",
    "transportation",
    "clothing",
    "supplies",
    "other",
  ]),
  description: z.string().trim().min(2).max(180),
  amount: moneySchema,
  currency: z.string().trim().length(3),
  paidByLabel: z.string().trim().min(1).max(60),
  reimbursementRequested: z.boolean(),
  reimbursementDueDate: dateStringSchema.optional().or(z.literal("")),
  amountReimbursed: moneySchema.optional(),
  reimbursementDate: dateStringSchema.optional().or(z.literal("")),
  reimbursementStatus: z.enum([
    "not_requested",
    "requested",
    "partially_reimbursed",
    "reimbursed",
    "unpaid",
    "disputed",
    "unknown",
  ]),
  notes: z.string().trim().max(2_000).optional().or(z.literal("")),
});

export const allowedEvidenceExtensions = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "heic",
  "txt",
  "csv",
] as const;

export const allowedEvidenceMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/heif",
  "text/plain",
  "text/csv",
  "application/csv",
]);

const blockedExtensions = new Set([
  "app",
  "bat",
  "cmd",
  "com",
  "dll",
  "dmg",
  "exe",
  "jar",
  "js",
  "msi",
  "ps1",
  "scr",
  "sh",
  "vb",
  "vbs",
]);

export const maxEvidenceFileBytes = 10 * 1024 * 1024;

export interface EvidenceFileCandidate {
  originalFileName: string;
  fileType: string;
  fileSize: number;
}

export function getFileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1) || "" : "";
}

export function validateEvidenceFile(candidate: EvidenceFileCandidate) {
  const extension = getFileExtension(candidate.originalFileName);

  if (blockedExtensions.has(extension)) {
    return { ok: false as const, error: "Executable or script files are blocked." };
  }

  if (!allowedEvidenceExtensions.includes(extension as (typeof allowedEvidenceExtensions)[number])) {
    return { ok: false as const, error: "File type is not on the evidence allow-list." };
  }

  if (!allowedEvidenceMimeTypes.has(candidate.fileType)) {
    return { ok: false as const, error: "File MIME type is not allowed." };
  }

  if (candidate.fileSize <= 0 || candidate.fileSize > maxEvidenceFileBytes) {
    return { ok: false as const, error: "File must be greater than 0 bytes and 10 MB or smaller." };
  }

  return { ok: true as const };
}

export function buildStoredEvidenceName(item: Pick<EvidenceItem, "id" | "originalFileName">) {
  const extension = getFileExtension(item.originalFileName);
  return `${item.id}.${extension}`;
}

export function malwareScanStub() {
  return {
    status: "not_configured" as const,
    message:
      "Production storage must call a malware scanning provider before evidence is available.",
  };
}
