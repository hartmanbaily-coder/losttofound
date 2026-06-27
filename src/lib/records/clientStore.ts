"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createEmptyRecordsDatasetForUser,
  createRecordsSeed,
  demoCaseId,
  demoUserId,
} from "./seed";
import type { AuditAction, RecordsDataset } from "./types";

const storageKey = "l2f.records.dataset.v1";
const sessionKey = "l2f.records.session.v1";
const failedLoginKey = "l2f.records.failed-login.v1";
const remoteDatasetKey = "default";

export type RecordsStorageMode = "local" | "supabase";
export type RecordsSession = {
  userId: string;
  caseId: string;
  email: string;
  authMode: RecordsStorageMode;
};

export type RecordsMfaEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export type RecordsSignInResult =
  | { status: "signed_in"; session: RecordsSession }
  | { status: "mfa_required" }
  | { status: "mfa_enrollment_required"; enrollment: RecordsMfaEnrollment };

export const recordsStorageMode: RecordsStorageMode =
  process.env.NEXT_PUBLIC_RECORDS_STORAGE_MODE === "supabase" ? "supabase" : "local";

function cloneDataset(dataset: RecordsDataset): RecordsDataset {
  return JSON.parse(JSON.stringify(dataset)) as RecordsDataset;
}

function normalizeDataset(dataset: Partial<RecordsDataset>): RecordsDataset {
  const seed = createRecordsSeed();
  return {
    ...seed,
    ...dataset,
    users: dataset.users || seed.users,
    matters: dataset.matters || seed.matters,
    exchangeRules: dataset.exchangeRules || seed.exchangeRules,
    scheduleExceptions: dataset.scheduleExceptions || seed.scheduleExceptions,
    custodyDayAssignments: dataset.custodyDayAssignments || seed.custodyDayAssignments,
    exchangeLogs: dataset.exchangeLogs || seed.exchangeLogs,
    dateNotes: dataset.dateNotes || seed.dateNotes,
    evidenceItems: dataset.evidenceItems || seed.evidenceItems,
    childSupportOrders: dataset.childSupportOrders || seed.childSupportOrders,
    childSupportPayments: dataset.childSupportPayments || seed.childSupportPayments,
    expenseItems: dataset.expenseItems || seed.expenseItems,
    auditLogs: dataset.auditLogs || seed.auditLogs,
  };
}

function readLocalDataset() {
  if (typeof window === "undefined") return createRecordsSeed();
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return createRecordsSeed();

  try {
    return normalizeDataset(JSON.parse(stored) as Partial<RecordsDataset>);
  } catch {
    return createRecordsSeed();
  }
}

function persistLocalDataset(dataset: RecordsDataset) {
  window.localStorage.setItem(storageKey, JSON.stringify(dataset));
}

async function readRemoteSession() {
  const response = await fetch("/api/records/auth/session", {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(response.status === 401 ? "Sign in to Supabase records." : "Records session unavailable.");
  }

  const body = (await response.json()) as { session?: RecordsSession };
  if (!body.session?.userId || !body.session.email) {
    throw new Error("Records session response was invalid.");
  }

  return body.session;
}

async function readRemoteDataset(session: RecordsSession) {
  const response = await fetch(`/api/records/dataset?caseId=${encodeURIComponent(remoteDatasetKey)}`, {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Records dataset load failed with ${response.status}.`);
  }

  const body = (await response.json()) as { dataset: Partial<RecordsDataset> | null };
  if (body.dataset) return normalizeDataset(body.dataset);

  const initial = createEmptyRecordsDatasetForUser(session.userId, session.email);
  void persistRemoteDataset(initial);
  return initial;
}

async function persistRemoteDataset(dataset: RecordsDataset) {
  const response = await fetch(`/api/records/dataset?caseId=${encodeURIComponent(remoteDatasetKey)}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dataset }),
  });

  if (!response.ok) {
    throw new Error(`Records dataset save failed with ${response.status}.`);
  }
}

export function useRecordsStore() {
  const [dataset, setDataset] = useState<RecordsDataset>(() => createRecordsSeed());
  const [hydrated, setHydrated] = useState(false);
  const [storageStatus, setStorageStatus] = useState(
    recordsStorageMode === "supabase" ? "Supabase storage pending." : "Local demo storage."
  );

  async function reloadDataset() {
    try {
      if (recordsStorageMode === "supabase") {
        const remoteSession = await readRemoteSession();
        const remote = await readRemoteDataset(remoteSession);
        setDataset(remote);
        setStorageStatus("Supabase records storage connected.");
      } else {
        setDataset(readLocalDataset());
        setStorageStatus("Local demo storage.");
      }
    } catch (error) {
      setDataset(createRecordsSeed());
      setStorageStatus(error instanceof Error ? error.message : "Records storage unavailable.");
    } finally {
      setHydrated(true);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void reloadDataset();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  function updateDataset(updater: (current: RecordsDataset) => RecordsDataset) {
    setDataset((current) => {
      const next = updater(cloneDataset(current));
      if (typeof window !== "undefined") {
        if (recordsStorageMode === "supabase") {
          void persistRemoteDataset(next)
            .then(() => setStorageStatus("Supabase records storage saved."))
            .catch((error: unknown) =>
              setStorageStatus(
                error instanceof Error ? error.message : "Supabase records storage save failed."
              )
            );
        } else {
          persistLocalDataset(next);
        }
      }
      return next;
    });
  }

  function resetDemoData() {
    const currentProfile =
      dataset.users.find((user) => user.userId !== demoUserId) || dataset.users[0];
    const next =
      recordsStorageMode === "supabase" && currentProfile
        ? createEmptyRecordsDatasetForUser(currentProfile.userId, currentProfile.email)
        : createRecordsSeed();
    setDataset(next);
    if (typeof window !== "undefined") {
      if (recordsStorageMode === "supabase") {
        void persistRemoteDataset(next)
          .then(() => setStorageStatus("Supabase records storage reset."))
          .catch((error: unknown) =>
            setStorageStatus(
              error instanceof Error ? error.message : "Supabase records storage reset failed."
            )
          );
      } else {
        persistLocalDataset(next);
      }
    }
  }

  return {
    dataset,
    hydrated,
    updateDataset,
    resetDemoData,
    reloadDataset,
    storageStatus,
    recordsStorageMode,
  };
}

export function readSession() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(sessionKey);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as RecordsSession;
  } catch {
    return null;
  }
}

export function writeSession(email: string) {
  const session = { userId: demoUserId, caseId: demoCaseId, email, authMode: "local" as const };
  window.localStorage.setItem(sessionKey, JSON.stringify(session));
  return session;
}

export function clearSession() {
  window.localStorage.removeItem(sessionKey);
}

export async function readRecordsSession() {
  if (recordsStorageMode === "supabase") return readRemoteSession();
  return readSession();
}

export async function signInRecordsSession(
  email: string,
  password: string,
  adultConfirmed: boolean
): Promise<RecordsSignInResult> {
  const response = await fetch("/api/records/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, adultConfirmed }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    session?: RecordsSession;
    error?: string;
    mfaRequired?: boolean;
    mfaEnrollmentRequired?: boolean;
    enrollment?: RecordsMfaEnrollment;
  };

  if (response.status === 403 && body.mfaRequired) {
    if (body.mfaEnrollmentRequired && body.enrollment?.factorId && body.enrollment.qrCode) {
      return { status: "mfa_enrollment_required", enrollment: body.enrollment };
    }
    return { status: "mfa_required" };
  }

  if (!response.ok || !body.session) {
    throw new Error(body.error || `Supabase sign-in failed with ${response.status}.`);
  }

  return { status: "signed_in", session: body.session };
}

export async function createRecordsTestingAccount(
  email: string,
  password: string,
  adultConfirmed: boolean,
  inviteCode: string
) {
  const response = await fetch("/api/records/auth/register", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, adultConfirmed, inviteCode }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || `Testing account creation failed with ${response.status}.`);
  }
}

async function verifyMfaAt(endpoint: string, body: Record<string, string>) {
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const parsed = (await response.json().catch(() => ({}))) as {
    session?: RecordsSession;
    error?: string;
  };

  if (!response.ok || !parsed.session) {
    throw new Error(parsed.error || `MFA verification failed with ${response.status}.`);
  }

  return parsed.session;
}

export async function verifyRecordsMfa(code: string) {
  return verifyMfaAt("/api/records/auth/mfa/verify", { code });
}

export async function verifyRecordsMfaEnrollment(input: { factorId: string; code: string }) {
  return verifyMfaAt("/api/records/auth/mfa/enroll/verify", input);
}

export async function signOutRecordsSession() {
  if (recordsStorageMode !== "supabase") {
    clearSession();
    return;
  }

  await fetch("/api/records/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
}

export function readFailedLoginState() {
  if (typeof window === "undefined") return { count: 0, lockedUntil: 0 };
  const stored = window.localStorage.getItem(failedLoginKey);
  if (!stored) return { count: 0, lockedUntil: 0 };

  try {
    return JSON.parse(stored) as { count: number; lockedUntil: number };
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

export function recordFailedLoginAttempt() {
  const current = readFailedLoginState();
  const nextCount = current.count + 1;
  const lockedUntil = nextCount >= 5 ? Date.now() + 5 * 60 * 1000 : current.lockedUntil;
  const next = { count: nextCount, lockedUntil };
  window.localStorage.setItem(failedLoginKey, JSON.stringify(next));
  return next;
}

export function clearFailedLoginAttempts() {
  window.localStorage.removeItem(failedLoginKey);
}

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function downloadTextFile(fileName: string, body: string, contentType: string) {
  const blob = new Blob([body], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function withAudit(
  dataset: RecordsDataset,
  input: {
    userId: string;
    caseId?: string;
    entityType: string;
    entityId: string;
    action: AuditAction;
    metadataSummary: string;
  }
) {
  dataset.auditLogs.unshift({
    id: createId("audit"),
    timestamp: nowIso(),
    ...input,
  });
  return dataset;
}

export function useSelectedRecords(dataset: RecordsDataset, userId: string, caseId: string) {
  return useMemo(
    () => ({
      matters: dataset.matters.filter((item) => item.userId === userId),
      matter: dataset.matters.find((item) => item.userId === userId && item.id === caseId),
      exchangeRules: dataset.exchangeRules.filter(
        (item) => item.userId === userId && item.caseId === caseId
      ),
      custodyDayAssignments: dataset.custodyDayAssignments.filter(
        (item) => item.userId === userId && item.caseId === caseId
      ),
      exchangeLogs: dataset.exchangeLogs.filter(
        (item) => item.userId === userId && item.caseId === caseId
      ),
      dateNotes: dataset.dateNotes.filter((item) => item.userId === userId && item.caseId === caseId),
      evidenceItems: dataset.evidenceItems.filter(
        (item) => item.userId === userId && item.caseId === caseId
      ),
      childSupportOrders: dataset.childSupportOrders.filter(
        (item) => item.userId === userId && item.caseId === caseId
      ),
      childSupportPayments: dataset.childSupportPayments.filter(
        (item) => item.userId === userId && item.caseId === caseId
      ),
      expenseItems: dataset.expenseItems.filter(
        (item) => item.userId === userId && item.caseId === caseId
      ),
      auditLogs: dataset.auditLogs.filter(
        (item) => item.userId === userId && (!item.caseId || item.caseId === caseId)
      ),
    }),
    [dataset, userId, caseId]
  );
}
