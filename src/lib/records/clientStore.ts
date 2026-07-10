"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export type RecordsSessionReadResult =
  | { status: "signed_in"; session: RecordsSession }
  | { status: "mfa_required" }
  | { status: "signed_out" };

export type RecordsAuthMessage = {
  ok: boolean;
  message: string;
};

let remoteSessionStateRequest: Promise<RecordsSessionReadResult> | null = null;

export const recordsStorageMode: RecordsStorageMode =
  process.env.NEXT_PUBLIC_RECORDS_STORAGE_MODE === "supabase" ? "supabase" : "local";

function cloneDataset(dataset: RecordsDataset): RecordsDataset {
  return JSON.parse(JSON.stringify(dataset)) as RecordsDataset;
}

function normalizeDataset(dataset: Partial<RecordsDataset>, fallback: RecordsDataset): RecordsDataset {
  return {
    ...fallback,
    ...dataset,
    users: dataset.users || fallback.users,
    matters: dataset.matters || fallback.matters,
    exchangeRules: dataset.exchangeRules || fallback.exchangeRules,
    scheduleExceptions: dataset.scheduleExceptions || fallback.scheduleExceptions,
    custodyDayAssignments: dataset.custodyDayAssignments || fallback.custodyDayAssignments,
    exchangeLogs: dataset.exchangeLogs || fallback.exchangeLogs,
    dateNotes: dataset.dateNotes || fallback.dateNotes,
    evidenceItems: dataset.evidenceItems || fallback.evidenceItems,
    childSupportOrders: dataset.childSupportOrders || fallback.childSupportOrders,
    childSupportPayments: dataset.childSupportPayments || fallback.childSupportPayments,
    expenseItems: dataset.expenseItems || fallback.expenseItems,
    auditLogs: dataset.auditLogs || fallback.auditLogs,
  };
}

function readLocalDataset() {
  if (typeof window === "undefined") return createRecordsSeed();
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return createRecordsSeed();

  try {
    return normalizeDataset(JSON.parse(stored) as Partial<RecordsDataset>, createRecordsSeed());
  } catch {
    return createRecordsSeed();
  }
}

function persistLocalDataset(dataset: RecordsDataset) {
  window.localStorage.setItem(storageKey, JSON.stringify(dataset));
}

export function parseRecordsSessionResponse(
  status: number,
  body: { session?: RecordsSession; error?: string; mfaRequired?: boolean }
): RecordsSessionReadResult {
  if (status === 403 && body.mfaRequired) return { status: "mfa_required" };
  if (status === 401) return { status: "signed_out" };
  if (status < 200 || status >= 300) {
    throw new Error(body.error || "Records session unavailable.");
  }
  if (!body.session?.userId || !body.session.email) {
    throw new Error("Records session response was invalid.");
  }

  return { status: "signed_in", session: body.session };
}

async function fetchRemoteSessionState() {
  const response = await fetch("/api/records/auth/session", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const body = (await response.json().catch(() => ({}))) as {
    session?: RecordsSession;
    error?: string;
    mfaRequired?: boolean;
  };

  return parseRecordsSessionResponse(response.status, body);
}

async function readRemoteSessionState() {
  const request = remoteSessionStateRequest || fetchRemoteSessionState();
  remoteSessionStateRequest = request;

  try {
    return await request;
  } finally {
    if (remoteSessionStateRequest === request) {
      remoteSessionStateRequest = null;
    }
  }
}

async function readRemoteSession() {
  const state = await readRemoteSessionState();
  if (state.status === "signed_in") return state.session;
  if (state.status === "mfa_required") {
    throw new Error("Multi factor verification required.");
  }
  throw new Error("Sign in to your records workspace.");
}

async function readRemoteDataset(session: RecordsSession) {
  const response = await fetch(`/api/records/dataset?caseId=${encodeURIComponent(remoteDatasetKey)}`, {
    cache: "no-store",
    credentials: "same-origin",
  });

  const body = (await response.json().catch(() => ({}))) as {
    dataset?: Partial<RecordsDataset> | null;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || `Records dataset load failed with ${response.status}.`);
  }

  const emptyDataset = createEmptyRecordsDatasetForUser(session.userId, session.email);
  if (body.dataset) return normalizeDataset(body.dataset, emptyDataset);

  const initial = emptyDataset;
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
    recordsStorageMode === "supabase" ? "Cloud records storage pending." : "Private drafting storage."
  );
  const [storageError, setStorageError] = useState<string | null>(null);
  const datasetRef = useRef(dataset);
  const remoteWriteChainRef = useRef<Promise<void>>(Promise.resolve());

  const setCurrentDataset = useCallback((next: RecordsDataset) => {
    datasetRef.current = next;
    setDataset(next);
  }, []);

  const persistDataset = useCallback((next: RecordsDataset) => {
    if (typeof window === "undefined") return Promise.resolve();

    if (recordsStorageMode === "supabase") {
      const write = remoteWriteChainRef.current.then(() => persistRemoteDataset(next));
      remoteWriteChainRef.current = write.catch(() => undefined);
      return write
        .then(() => {
          setStorageStatus("Cloud records storage saved.");
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Cloud records storage save failed.";
          setStorageStatus(message);
          throw new Error(message);
        });
    }

    persistLocalDataset(next);
    return Promise.resolve();
  }, []);

  const reloadDataset = useCallback(async () => {
    try {
      if (recordsStorageMode === "supabase") {
        const remoteSession = await readRemoteSession();
        const remote = await readRemoteDataset(remoteSession);
        setCurrentDataset(remote);
        setStorageStatus("Cloud records storage connected.");
        setStorageError(null);
      } else {
        setCurrentDataset(readLocalDataset());
        setStorageStatus("Private drafting storage.");
        setStorageError(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Records storage unavailable.";
      if (recordsStorageMode === "supabase") {
        setCurrentDataset({
          users: [],
          matters: [],
          exchangeRules: [],
          scheduleExceptions: [],
          custodyDayAssignments: [],
          exchangeLogs: [],
          dateNotes: [],
          evidenceItems: [],
          childSupportOrders: [],
          childSupportPayments: [],
          expenseItems: [],
          auditLogs: [],
        });
      } else {
        setCurrentDataset(createRecordsSeed());
      }
      setStorageStatus(message);
      setStorageError(message);
    } finally {
      setHydrated(true);
    }
  }, [setCurrentDataset]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void reloadDataset();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [reloadDataset]);

  function updateDataset(updater: (current: RecordsDataset) => RecordsDataset) {
    const next = updater(cloneDataset(datasetRef.current));
    setCurrentDataset(next);
    return persistDataset(next);
  }

  function resetDemoData() {
    const currentProfile =
      dataset.users.find((user) => user.userId !== demoUserId) || dataset.users[0];
    const next =
      recordsStorageMode === "supabase" && currentProfile
        ? createEmptyRecordsDatasetForUser(currentProfile.userId, currentProfile.email)
        : createRecordsSeed();
    setCurrentDataset(next);
    void persistDataset(next)
      .then(() => setStorageStatus(recordsStorageMode === "supabase" ? "Cloud records storage reset." : "Private drafting storage."))
      .catch((error: unknown) =>
        setStorageStatus(error instanceof Error ? error.message : "Cloud records storage reset failed.")
      );
  }

  return {
    dataset,
    hydrated,
    updateDataset,
    resetDemoData,
    reloadDataset,
    storageStatus,
    storageError,
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
  if (recordsStorageMode === "supabase") return readRemoteSessionState();
  const session = readSession();
  return session ? { status: "signed_in" as const, session } : { status: "signed_out" as const };
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
    throw new Error(body.error || `Sign in failed with ${response.status}.`);
  }

  return { status: "signed_in", session: body.session };
}

export async function signUpRecordsAccount(
  email: string,
  password: string,
  adultConfirmed: boolean
): Promise<RecordsAuthMessage> {
  const response = await fetch("/api/records/auth/signup", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, adultConfirmed }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    error?: string;
    detail?: string;
  };

  if (!response.ok) {
    throw new Error([body.error, body.detail].filter(Boolean).join(" ") || `Account creation failed with ${response.status}.`);
  }

  return {
    ok: body.ok === true,
    message: body.message || "Check your email to confirm the account before signing in.",
  };
}

export async function requestRecordsPasswordReset(
  email: string,
  adultConfirmed: boolean
): Promise<RecordsAuthMessage> {
  const response = await fetch("/api/records/auth/password/reset", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, adultConfirmed }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || `Password reset failed with ${response.status}.`);
  }

  return {
    ok: body.ok === true,
    message: body.message || "If an account exists for that email, a password reset link will be sent.",
  };
}

export async function acceptRecordsRecoverySession(input: {
  accessToken: string;
  refreshToken: string;
  expiresIn?: string | number | null;
}) {
  const response = await fetch("/api/records/auth/recovery/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(body.error || `Recovery session failed with ${response.status}.`);
  }
}

export async function updateRecordsPassword(password: string): Promise<RecordsAuthMessage> {
  const response = await fetch("/api/records/auth/password/update", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || `Password update failed with ${response.status}.`);
  }

  return {
    ok: body.ok === true,
    message: body.message || "Password updated. Sign in again with your new password.",
  };
}

async function verifyMfaAt(endpoint: string, body: Record<string, string>) {
  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const parsed = (await response.json().catch(() => ({}))) as {
    session?: RecordsSession;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(parsed.error || `MFA verification failed with ${response.status}.`);
  }

  if (!parsed.session) {
    const state = await fetchRemoteSessionState().catch(() => null);
    if (state?.status === "signed_in") return state.session;
    if (state?.status === "mfa_required") {
      throw new Error("Authenticator verification did not complete. Enter a fresh code and try again.");
    }

    throw new Error(parsed.error || "MFA verification response was incomplete. Sign in and try again.");
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
