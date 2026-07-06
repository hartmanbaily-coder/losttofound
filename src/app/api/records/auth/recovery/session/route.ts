import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseSessionClient } from "@/lib/supabaseClient";
import {
  isSupabaseRecordsMode,
  setRecordsSessionCookies,
} from "@/lib/records/authServer";
import { demoCaseId } from "@/lib/records/seed";
import { upsertRecordsProfile } from "@/lib/records/profileServer";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { recordSecurityEvent } from "@/lib/security/securityEvents";

export const dynamic = "force-dynamic";

function tokenValue(value: unknown) {
  return typeof value === "string" && value.length > 20 && value.length < 8_000 ? value : "";
}

export async function POST(request: NextRequest) {
  if (!isSupabaseRecordsMode()) {
    return NextResponse.json({ error: "Supabase records auth is not enabled." }, { status: 501 });
  }

  const rateLimit = checkRateLimit(request, {
    id: "records-auth-recovery-session",
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimit.limited) return rateLimitExceededResponse(rateLimit);

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = parsed as {
    accessToken?: unknown;
    refreshToken?: unknown;
    expiresIn?: unknown;
  };
  const accessToken = tokenValue(body.accessToken);
  const refreshToken = tokenValue(body.refreshToken);
  const expiresIn = Number(body.expiresIn || 3600);

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "Recovery link session tokens are missing." }, { status: 400 });
  }

  try {
    const authClient = await createServerSupabaseSessionClient({
      accessToken,
      refreshToken,
    });
    const { data, error } = await authClient.auth.getUser();
    if (error || !data.user?.id) throw error || new Error("Recovery session user missing.");

    await upsertRecordsProfile({ userId: data.user.id, email: data.user.email || "" });
    await recordSecurityEvent({
      type: "auth_recovery_session_accepted",
      severity: "info",
      request,
      userId: data.user.id,
      status: 200,
    });

    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
    setRecordsSessionCookies(
      response,
      {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: Number.isFinite(expiresIn) ? expiresIn : 3600,
      },
      demoCaseId
    );
    return response;
  } catch {
    await recordSecurityEvent({
      type: "auth_recovery_session_failed",
      severity: "warning",
      request,
      status: 401,
    });
    return NextResponse.json({ error: "Recovery link is invalid or expired." }, { status: 401 });
  }
}
