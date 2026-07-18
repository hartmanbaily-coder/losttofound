import { NextRequest, NextResponse } from "next/server";
import type { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  getRecordsAuthContext,
  isSupabaseRecordsMode,
  type RecordsAuthContext,
} from "./authServer";
import type { RecordsDataset } from "./types";

const secureCookies = process.env.NODE_ENV === "production";
export const attorneyAcceptanceCookieName = secureCookies
  ? "__Secure-l2f-attorney-invite"
  : "l2f-attorney-invite";

export function setAttorneyAcceptanceCookie(response: NextResponse, token: string) {
  response.cookies.set(attorneyAcceptanceCookieName, token, {
    httpOnly: true,
    maxAge: 15 * 60,
    path: "/api/records/attorney/accept",
    sameSite: "strict",
    secure: secureCookies,
  });
  return response;
}

export function clearAttorneyAcceptanceCookie(response: NextResponse) {
  response.cookies.set(attorneyAcceptanceCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/api/records/attorney/accept",
    sameSite: "strict",
    secure: secureCookies,
  });
  return response;
}

export function attorneyDisabledResponse() {
  return NextResponse.json(
    { error: "Attorney access is not enabled." },
    { status: 501, headers: { "Cache-Control": "no-store" } }
  );
}

export async function getAttorneyAuthContext(
  request: NextRequest
): Promise<RecordsAuthContext | { error: NextResponse }> {
  if (!isSupabaseRecordsMode()) return { error: attorneyDisabledResponse() } as const;
  const context = await getRecordsAuthContext(request);
  if ("error" in context) return context;
  if (context.assuranceLevel !== "aal2") {
    return {
      error: NextResponse.json(
        { error: "Authenticator verification is required.", mfaRequired: true },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    } as const;
  }
  if (!context.email || !context.emailConfirmedAt) {
    return {
      error: NextResponse.json(
        { error: "Confirm the account email before using attorney access." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      ),
    } as const;
  }
  return context;
}

export async function ownerCaseExists(input: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  ownerUserId: string;
  caseKey: string;
  caseId: string;
}) {
  const { data, error } = await input.supabase
    .from("records_case_snapshots")
    .select("dataset")
    .eq("user_id", input.ownerUserId)
    .eq("case_key", input.caseKey)
    .maybeSingle();
  if (error || !data?.dataset) return false;
  const dataset = data.dataset as unknown as Partial<RecordsDataset>;
  return Boolean(
    dataset.matters?.some(
      (matter) => matter.userId === input.ownerUserId && matter.id === input.caseId
    )
  );
}

export function isAttorneyDevelopmentDeliveryEnabled(
  env: Record<string, string | undefined> = process.env
) {
  return env.NODE_ENV !== "production" && env.ATTORNEY_INVITE_DEV_DELIVERY === "true";
}
