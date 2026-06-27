import { NextRequest, NextResponse } from "next/server";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  createServerSupabaseAuthClient,
  createServerSupabaseSessionClient,
} from "@/lib/supabaseClient";
import { demoCaseId } from "./seed";

const secureCookies = process.env.NODE_ENV === "production";

export const recordsAccessCookieName = secureCookies
  ? "__Host-l2f-records-access"
  : "l2f-records-access";
export const recordsRefreshCookieName = secureCookies
  ? "__Host-l2f-records-refresh"
  : "l2f-records-refresh";
export const recordsCaseCookieName = secureCookies ? "__Host-l2f-records-case" : "l2f-records-case";

const refreshCookieMaxAge = 60 * 60 * 24 * 30;

export interface RecordsAuthContext {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  email: string;
  caseId: string;
  refreshedSession?: Session;
}

export function isSupabaseRecordsMode() {
  return (
    process.env.RECORDS_STORAGE_MODE === "supabase" ||
    process.env.NEXT_PUBLIC_RECORDS_STORAGE_MODE === "supabase"
  );
}

export function isRecordsMfaRequired(env: Record<string, string | undefined> = process.env) {
  return (
    env.RECORDS_ENFORCE_MFA === "true" ||
    (env.NODE_ENV === "production" && env.SUPABASE_MFA_POLICY === "required")
  );
}

export function getAccessTokenAal(accessToken: string | undefined) {
  if (!accessToken) return null;
  const [, payload] = accessToken.split(".");
  if (!payload) return null;

  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as { aal?: unknown };
    return parsed.aal === "aal2" || parsed.aal === "aal1" ? parsed.aal : null;
  } catch {
    return null;
  }
}

export function mfaRequiredResponse() {
  return NextResponse.json(
    {
      error: "Multi-factor verification required.",
      mfaRequired: true,
    },
    { status: 403 }
  );
}

export function getRecordsCaseKey(request: NextRequest) {
  return request.nextUrl.searchParams.get("caseId")?.slice(0, 120) || "default";
}

export function getRecordsSessionCaseId(request: NextRequest) {
  return request.cookies.get(recordsCaseCookieName)?.value || demoCaseId;
}

function baseCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: secureCookies,
  };
}

export function setRecordsSessionCookies(
  response: NextResponse,
  session: Pick<Session, "access_token" | "expires_in" | "refresh_token">,
  caseId = demoCaseId
) {
  response.cookies.set(
    recordsAccessCookieName,
    session.access_token,
    baseCookieOptions(Math.max(60, Math.min(session.expires_in || 3600, 3600)))
  );
  response.cookies.set(
    recordsRefreshCookieName,
    session.refresh_token,
    baseCookieOptions(refreshCookieMaxAge)
  );
  response.cookies.set(recordsCaseCookieName, caseId, baseCookieOptions(refreshCookieMaxAge));
}

export function clearRecordsSessionCookies(response: NextResponse) {
  response.cookies.set(recordsAccessCookieName, "", baseCookieOptions(0));
  response.cookies.set(recordsRefreshCookieName, "", baseCookieOptions(0));
  response.cookies.set(recordsCaseCookieName, "", baseCookieOptions(0));
}

function getAllowedBearerToken(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.RECORDS_ALLOW_BEARER_AUTH !== "true") {
    return "";
  }

  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token || "" : "";
}

export function authError(message = "Authentication required.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

function mfaSatisfied(accessToken: string | undefined) {
  return !isRecordsMfaRequired() || getAccessTokenAal(accessToken) === "aal2";
}

export async function getRecordsSessionAuthClient(request: NextRequest) {
  const accessToken = request.cookies.get(recordsAccessCookieName)?.value;
  const refreshToken = request.cookies.get(recordsRefreshCookieName)?.value;

  if (!accessToken || !refreshToken) {
    throw new Error("Records session cookies are missing.");
  }

  return createServerSupabaseSessionClient({ accessToken, refreshToken });
}

export function attachRefreshedRecordsSession(
  request: NextRequest,
  response: NextResponse,
  context: RecordsAuthContext
) {
  if (context.refreshedSession) {
    setRecordsSessionCookies(response, context.refreshedSession, getRecordsSessionCaseId(request));
  }
  return response;
}

export async function getRecordsAuthContext(request: NextRequest) {
  const accessToken =
    request.cookies.get(recordsAccessCookieName)?.value || getAllowedBearerToken(request);
  const refreshToken = request.cookies.get(recordsRefreshCookieName)?.value;

  if (!accessToken && !refreshToken) {
    return { error: authError("Sign in before accessing records.") };
  }

  const supabase = createSupabaseAdminClient();
  const caseId = getRecordsSessionCaseId(request);

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error && data.user?.id) {
      if (!mfaSatisfied(accessToken)) return { error: mfaRequiredResponse() };

      return {
        supabase,
        userId: data.user.id,
        email: data.user.email || "",
        caseId,
      };
    }
  }

  if (refreshToken) {
    const authClient = createServerSupabaseAuthClient();
    const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });
    const refreshed = data.session;
    const user = data.user || refreshed?.user;

    if (!error && refreshed?.access_token && user?.id) {
      if (!mfaSatisfied(refreshed.access_token)) return { error: mfaRequiredResponse() };

      return {
        supabase,
        userId: user.id,
        email: user.email || "",
        caseId,
        refreshedSession: refreshed,
      };
    }
  }

  return { error: authError("Session expired. Sign in again.") };
}
