import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isSupabaseRecordsMode } from "@/lib/records/authServer";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";
import { recordSecurityEvent } from "@/lib/security/securityEvents";

export const dynamic = "force-dynamic";

function disabledResponse() {
  return NextResponse.json(
    {
      error: "Testing account creation is not enabled.",
      detail: "Set RECORDS_TEST_ACCOUNT_CREATION=true and RECORDS_TEST_INVITE_CODE.",
    },
    { status: 501 }
  );
}

function testingAccountCreationEnabled() {
  return (
    process.env.RECORDS_TEST_ACCOUNT_CREATION === "true" &&
    Boolean(process.env.RECORDS_TEST_INVITE_CODE)
  );
}

function inviteCodeMatches(candidate: string) {
  const expected = process.env.RECORDS_TEST_INVITE_CODE || "";
  const candidateBuffer = Buffer.from(candidate.trim());
  const expectedBuffer = Buffer.from(expected.trim());

  if (candidateBuffer.length === 0 || candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

export async function POST(request: NextRequest) {
  if (!isSupabaseRecordsMode() || !testingAccountCreationEnabled()) {
    return disabledResponse();
  }

  const rateLimit = checkRateLimit(request, {
    id: "records-auth-register",
    limit: 6,
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
    email?: unknown;
    password?: unknown;
    adultConfirmed?: unknown;
    inviteCode?: unknown;
  };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const adultConfirmed = body.adultConfirmed === true;
  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode : "";

  if (!adultConfirmed || !email.includes("@") || password.length < 12) {
    return NextResponse.json(
      { error: "Enter an email, a password with at least 12 characters, and confirm adult use." },
      { status: 400 }
    );
  }

  if (!inviteCodeMatches(inviteCode)) {
    await recordSecurityEvent({
      type: "auth_test_registration_denied",
      severity: "warning",
      request,
      status: 403,
      detail: "Invalid testing invite code.",
    });
    return NextResponse.json({ error: "Testing invite code was not accepted." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      recordsTestingAccount: true,
    },
  });

  if (error || !data.user?.id) {
    const alreadyExists = /already|exist|registered/i.test(error?.message || "");
    await recordSecurityEvent({
      type: alreadyExists ? "auth_test_registration_existing_account" : "auth_test_registration_failed",
      severity: alreadyExists ? "info" : "warning",
      request,
      status: alreadyExists ? 409 : 500,
      detail: alreadyExists ? "Testing account already exists." : "Unable to create testing account.",
    });
    return NextResponse.json(
      {
        error: alreadyExists
          ? "That account already exists. Sign in instead."
          : "Unable to create testing account.",
      },
      { status: alreadyExists ? 409 : 500 }
    );
  }

  await recordSecurityEvent({
    type: "auth_test_registration_created",
    severity: "info",
    request,
    userId: data.user.id,
    status: 201,
  });

  return NextResponse.json(
    { ok: true },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
