import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAuthClient } from "@/lib/supabaseClient";
import {
  isRecordsSignupEnabled,
  isStrongRecordsPassword,
  isSupabaseRecordsMode,
  recordsAppBaseUrl,
  recordsPasswordMinimumLength,
} from "@/lib/records/authServer";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { recordSecurityEvent } from "@/lib/security/securityEvents";

export const dynamic = "force-dynamic";

function disabledResponse() {
  return NextResponse.json(
    {
      error: "Account creation is not enabled.",
      detail: "Ask the site owner to enable RECORDS_SIGNUPS_ENABLED when public account creation is ready.",
    },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  if (!isSupabaseRecordsMode()) {
    return NextResponse.json({ error: "Supabase records auth is not enabled." }, { status: 501 });
  }

  if (!isRecordsSignupEnabled()) return disabledResponse();

  const rateLimit = checkRateLimit(request, {
    id: "records-auth-signup",
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimit.limited) return rateLimitExceededResponse(rateLimit);

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = parsed as { email?: unknown; password?: unknown; adultConfirmed?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const adultConfirmed = body.adultConfirmed === true;
  const minimumPasswordLength = recordsPasswordMinimumLength();

  if (!adultConfirmed || !email.includes("@") || !isStrongRecordsPassword(password)) {
    return NextResponse.json(
      {
        error: `Enter a valid email, confirm adult use, and use a password between ${minimumPasswordLength} and 128 characters.`,
      },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseAuthClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${recordsAppBaseUrl(request)}/records?auth=confirmed`,
    },
  });

  if (error) {
    await recordSecurityEvent({
      type: "auth_signup_failed",
      severity: "warning",
      request,
      status: 400,
      detail: "Supabase signup failed.",
    });
    return NextResponse.json({ error: "Unable to create that account." }, { status: 400 });
  }

  await recordSecurityEvent({
    type: "auth_signup_requested",
    severity: "info",
    request,
    status: 200,
  });

  return NextResponse.json(
    {
      ok: true,
      message: "Check your email to confirm the account before signing in.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
