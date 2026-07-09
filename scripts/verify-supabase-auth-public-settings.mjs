function fail(message) {
  console.error(message);
  process.exit(1);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isEnabled(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const publicKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const recordsSignupsEnabled = isEnabled(process.env.RECORDS_SIGNUPS_ENABLED);
const publicRecordsSignupsEnabled = isEnabled(process.env.NEXT_PUBLIC_RECORDS_SIGNUPS_ENABLED);

if (!isHttpsUrl(supabaseUrl)) {
  fail("Set NEXT_PUBLIC_SUPABASE_URL to the production https:// Supabase project URL.");
}

if (!publicKey || publicKey.includes("service_role")) {
  fail("Set NEXT_PUBLIC_SUPABASE_ANON_KEY to the production publishable/anon key, not a service role key.");
}

if (recordsSignupsEnabled !== publicRecordsSignupsEnabled) {
  fail("RECORDS_SIGNUPS_ENABLED and NEXT_PUBLIC_RECORDS_SIGNUPS_ENABLED must match before auth verification.");
}

const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
  headers: {
    Accept: "application/json",
    apikey: publicKey,
  },
});

if (!response.ok) {
  fail(`Supabase Auth settings returned HTTP ${response.status}.`);
}

const settings = await response.json();
const external = settings?.external || {};

if (external.email !== true) {
  fail("Supabase Auth email provider is not enabled.");
}

if (external.anonymous_users === true) {
  fail("Supabase anonymous sign-ins are enabled; keep them disabled for records production.");
}

if (external.phone === true) {
  fail("Supabase phone auth is enabled; records production currently expects email/password auth only.");
}

if (settings.mailer_autoconfirm === true) {
  fail("Supabase mailer_autoconfirm is enabled; production records should require email confirmation.");
}

if (!recordsSignupsEnabled && settings.disable_signup !== true) {
  fail(
    "App signups are disabled, but direct Supabase Auth signup is still enabled. Disable signup in Supabase Auth or deliberately enable the app signup gate."
  );
}

if (recordsSignupsEnabled && settings.disable_signup === true) {
  fail("App signups are enabled, but Supabase Auth signup is disabled.");
}

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      supabaseUrl,
      emailProviderEnabled: external.email === true,
      anonymousUsersEnabled: external.anonymous_users === true,
      phoneAuthEnabled: external.phone === true,
      directSignupDisabled: settings.disable_signup === true,
      mailerAutoconfirmEnabled: settings.mailer_autoconfirm === true,
      recordsSignupsEnabled,
    },
    null,
    2
  )
);
console.log(`SUPABASE_AUTH_PUBLIC_SETTINGS_CHECKED_AT=${new Date().toISOString().slice(0, 10)}`);
