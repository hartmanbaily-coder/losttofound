import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAuthClient } from "@/lib/supabaseClient";
import {
  isRecordsSignupEnabled,
  isSupabaseRecordsMode,
  recordsAppBaseUrl,
} from "@/lib/records/authServer";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { recordSecurityEvent } from "@/lib/security/securityEvents";

export const dynamic = "force-dynamic";

const resendMessage =
  "If an unconfirmed account exists for that email, a new confirmation link will be sent.";

export async function POST(request: NextRequest) {
  if (!isSupabaseRecordsMode()) {
    return NextResponse.json({ error: "Records account access is not enabled." }, { status: 501 });
  }

  if (!isRecordsSignupEnabled()) {
    return NextResponse.json({ error: "Account creation is not enabled." }, { status: 403 });
  }

  const rateLimit = checkRateLimit(request, {
    id: "records-auth-signup-confirmation-resend",
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
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${recordsAppBaseUrl(request)}/records?auth=confirmed`,
    },
  });

  await recordSecurityEvent({
    type: error ? "auth_signup_confirmation_resend_failed" : "auth_signup_confirmation_resent",
    severity: error ? "warning" : "info",
    request,
    status: 200,
    detail: error ? "Signup confirmation resend failed." : undefined,
  });

  return NextResponse.json(
    { ok: true, message: resendMessage },
    { headers: { "Cache-Control": "no-store" } }
  );
}
