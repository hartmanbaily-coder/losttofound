import { demoCaseId } from "./seed";

export function cleanMfaCode(value: unknown) {
  return typeof value === "string" ? value.replace(/\s/g, "") : "";
}

export function isValidMfaCode(value: string) {
  return /^\d{6,8}$/.test(value);
}

export function sessionFromMfaVerify(data: { user: { id: string; email?: string } }) {
  return {
    userId: data.user.id,
    caseId: demoCaseId,
    email: data.user.email || "",
    authMode: "supabase" as const,
  };
}
