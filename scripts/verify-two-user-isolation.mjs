import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RECORDS_APP_BASE_URL",
  "RECORDS_EVIDENCE_BUCKET",
];

const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const appBaseUrl = (process.env.RECORDS_APP_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const runId = randomUUID();
const password = `L2F-${randomUUID()}-isolation`;
const emailDomain = process.env.RECORDS_ISOLATION_EMAIL_DOMAIN || "example.test";
const userAEmail = `l2f-isolation-a-${runId}@${emailDomain}`;
const userBEmail = `l2f-isolation-b-${runId}@${emailDomain}`;
const caseKey = `isolation-${runId}`;
const caseId = `case-${runId}`;
const evidenceId = `evidence-${runId}`;
const evidenceContent = `Lost to Found synthetic isolation evidence ${runId}\n`;
const storageBucket = process.env.RECORDS_EVIDENCE_BUCKET;

let userAId = "";
let userBId = "";
let storagePath = "";
let userACookies = "";
let userBCookies = "";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cookieHeader(response) {
  const headers = response.headers;
  const setCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : headers.get("set-cookie")?.split(/,(?=[^;,]+=)/g) || [];

  return setCookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

async function createTestUser(email) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      purpose: "lost-to-found-two-user-isolation-test",
      run_id: runId,
    },
  });

  if (error || !data.user?.id) {
    throw new Error(`Unable to create synthetic isolation user: ${error?.message || "missing user id"}`);
  }

  return data.user.id;
}

async function login(email) {
  const response = await fetch(`${appBaseUrl}/api/records/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      adultConfirmed: true,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Records login failed with ${response.status}: ${body.error || "unknown error"}`
    );
  }

  const cookies = cookieHeader(response);
  assert(cookies.includes("l2f-records-access") || cookies.includes("__Host-l2f-records-access"), "Records login did not set an access cookie.");
  assert(body.session?.userId, "Records login did not return a user id.");
  return { cookies, userId: body.session.userId };
}

function syntheticDataset(ownerUserId, evidenceItems = []) {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: ownerUserId,
        email: "synthetic-isolation@example.invalid",
        displayName: "Synthetic Isolation User",
        timezone: "America/Anchorage",
        createdAt: now,
        updatedAt: now,
      },
    ],
    matters: [],
    exchangeRules: [],
    scheduleExceptions: [],
    custodyDayAssignments: [],
    exchangeLogs: [],
    dateNotes: [],
    evidenceItems,
    childSupportOrders: [],
    childSupportPayments: [],
    expenseItems: [],
    auditLogs: [],
  };
}

async function saveDataset(cookies, ownerUserId, evidenceItems = []) {
  const response = await fetch(`${appBaseUrl}/api/records/dataset?caseId=${encodeURIComponent(caseKey)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
    },
    body: JSON.stringify({ dataset: syntheticDataset(ownerUserId, evidenceItems) }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Dataset save failed with ${response.status}: ${body.error || "unknown error"}`);
  }
}

async function loadDataset(cookies) {
  const response = await fetch(`${appBaseUrl}/api/records/dataset?caseId=${encodeURIComponent(caseKey)}`, {
    headers: { Cookie: cookies },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Dataset load failed with ${response.status}: ${body.error || "unknown error"}`);
  }

  return body.dataset || null;
}

function safePathSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 160);
}

async function createSyntheticEvidenceObject() {
  storagePath = [
    safePathSegment(userAId),
    safePathSegment(caseId),
    safePathSegment(evidenceId),
    `${safePathSegment(evidenceId)}.txt`,
  ].join("/");

  const { error } = await supabase.storage.from(storageBucket).upload(
    storagePath,
    Buffer.from(evidenceContent, "utf8"),
    {
      contentType: "text/plain",
      upsert: false,
    }
  );

  if (error) throw new Error(`Synthetic evidence object upload failed: ${error.message}`);
}

function evidenceMetadata(ownerUserId) {
  const now = new Date().toISOString();
  const size = Buffer.byteLength(evidenceContent);
  return {
    id: evidenceId,
    caseId,
    userId: ownerUserId,
    originalFileName: "synthetic-isolation-evidence.txt",
    storedFileName: `${evidenceId}.txt`,
    fileType: "text/plain",
    fileSize: size,
    storageBucket,
    storagePath,
    storageUploadedAt: now,
    storageSha256: createHash("sha256").update(evidenceContent).digest("hex"),
    uploadedAt: now,
    tags: [],
    includeInReports: false,
    malwareScanStatus: "clean",
    createdAt: now,
    updatedAt: now,
  };
}

async function evidenceDownload(cookies, metadata) {
  return fetch(`${appBaseUrl}/api/records/evidence/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
    },
    body: JSON.stringify({ evidence: metadata }),
  });
}

async function evidenceDelete(cookies, metadata) {
  return fetch(`${appBaseUrl}/api/records/evidence/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
    },
    body: JSON.stringify({ evidence: metadata }),
  });
}

async function cleanup() {
  if (storagePath) {
    await supabase.storage.from(storageBucket).remove([storagePath]).catch(() => undefined);
  }

  if (userAId || userBId) {
    await supabase
      .from("records_case_snapshots")
      .delete()
      .in("user_id", [userAId, userBId].filter(Boolean))
      .catch(() => undefined);
  }

  if (process.env.KEEP_ISOLATION_TEST_USERS !== "true") {
    if (userAId) await supabase.auth.admin.deleteUser(userAId).catch(() => undefined);
    if (userBId) await supabase.auth.admin.deleteUser(userBId).catch(() => undefined);
  }
}

try {
  userAId = await createTestUser(userAEmail);
  userBId = await createTestUser(userBEmail);
  const userALogin = await login(userAEmail);
  const userBLogin = await login(userBEmail);
  userACookies = userALogin.cookies;
  userBCookies = userBLogin.cookies;
  userAId = userAId || userALogin.userId;
  userBId = userBId || userBLogin.userId;

  await saveDataset(userACookies, userAId);
  const userADataset = await loadDataset(userACookies);
  const userBDataset = await loadDataset(userBCookies);

  assert(userADataset?.users?.[0]?.id === userAId, "User A could not read their own dataset.");
  assert(userBDataset === null, "User B unexpectedly loaded User A's dataset.");

  await createSyntheticEvidenceObject();
  const uploadedEvidence = evidenceMetadata(userAId);
  const userAEvidence = {
    ...evidenceMetadata(userAId),
    ...uploadedEvidence,
    id: evidenceId,
    caseId,
    userId: userAId,
    malwareScanStatus: "clean",
  };
  await saveDataset(userACookies, userAId, [userAEvidence]);
  const copiedEvidence = userAEvidence;

  const userBDownload = await evidenceDownload(userBCookies, copiedEvidence);
  assert(userBDownload.status === 403, `User B evidence download should be denied, got ${userBDownload.status}.`);

  const userBDelete = await evidenceDelete(userBCookies, copiedEvidence);
  assert(userBDelete.status === 403, `User B evidence delete should be denied, got ${userBDelete.status}.`);

  const userADownload = await evidenceDownload(userACookies, userAEvidence);
  assert(userADownload.ok, `User A evidence download failed with ${userADownload.status}.`);
  const downloaded = await userADownload.text();
  assert(downloaded === evidenceContent, "User A downloaded evidence content did not match.");

  const userADelete = await evidenceDelete(userACookies, userAEvidence);
  assert(userADelete.ok, `User A evidence delete failed with ${userADelete.status}.`);
  await saveDataset(userACookies, userAId);
  storagePath = "";

  console.log("Two-user isolation verification passed.");
  console.log(`TWO_USER_ISOLATION_TESTED_AT=${new Date().toISOString().slice(0, 10)}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await cleanup();
}
