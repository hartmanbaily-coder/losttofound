import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAuthClient } from "@/lib/supabaseClient";
import { isSupabaseRecordsMode, recordsAppBaseUrl } from "@/lib/records/authServer";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { recordSecurityEvent } from "@/lib/security/securityEvents";

export const dynamic = "force-dynamic";

const resetMessage = "If an account exists for that email, a password reset link will be sent.";

export async function POST(request: NextRequest) {
  if (!isSupabaseRecordsMode()) {
    return NextResponse.json({ error: "Supabase records auth is not enabled." }, { status: 501 });
  }

  const rateLimit = checkRateLimit(request, {
    id: "records-auth-password-reset",
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimit.limited) return rateLimitExceededResponse(rateLimit);

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = parsed as { email?: unknown; adultConfirmed?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const adultConfirmed = body.adultConfirmed === true;

  if (!adultConfirmed || !email.includes("@")) {
    return NextResponse.json({ error: "Enter your email and confirm adult use." }, { status: 400 });
  }

  const supabase = createServerSupabaseAuthClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${recordsAppBaseUrl(request)}/records?auth=recovery`,
  });

  await recordSecurityEvent({
    type: error ? "auth_password_reset_failed" : "auth_password_reset_requested",
    severity: error ? "warning" : "info",
    request,
    status: 200,
    detail: error ? "Supabase password reset request failed." : undefined,
  });

  return NextResponse.json(
    {
      ok: true,
      message: resetMessage,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
