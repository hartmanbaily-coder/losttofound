# Supabase Auth Launch Checklist

Production project: `cieuilbpnwuvnrxrlczj` (`losttofound-records-production`)

This checklist covers dashboard-controlled Supabase Auth settings that cannot be changed through the app repository. Do not mark the matching readiness variables complete until the setting is live and the verification step passes.

## Current Policy

Keep Lost to Found invite-only until launch review is complete:

- `NEXT_PUBLIC_RECORDS_SIGNUPS_ENABLED=false`
- `RECORDS_SIGNUPS_ENABLED=false`
- Supabase Auth direct signup disabled

If public self-registration is later approved, enable it deliberately in both the app env and Supabase Auth, then review signup abuse controls, custom SMTP limits, App Store review account handling, and support coverage.

## Dashboard Settings

Open Supabase Dashboard for project `cieuilbpnwuvnrxrlczj`.

1. Auth signups
   - Go to Authentication settings for email/password auth.
   - Disable direct signup while app signups are disabled.
   - Keep email confirmations required.
   - Keep anonymous sign-ins disabled.
   - Keep phone auth disabled unless a separate phone-auth review is completed.
   - Verify with:
     ```bash
     NEXT_PUBLIC_SUPABASE_URL=https://cieuilbpnwuvnrxrlczj.supabase.co \
     NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_RKkpBRXSYI9XIGHjd39nvQ_fMvePdti \
     RECORDS_SIGNUPS_ENABLED=false \
     NEXT_PUBLIC_RECORDS_SIGNUPS_ENABLED=false \
     npm run verify:supabase-auth
     ```

2. Custom SMTP
   - Go to Authentication > Emails > SMTP Settings.
   - Configure a production sender on the `losttofound.org` domain or an approved transactional email domain.
   - Disable provider link tracking for auth links if the provider offers it.
   - Send and receive a test confirmation/reset email using a synthetic account.
   - After verification, set Listhaus repo variable `LOSTTOFOUND_SUPABASE_CUSTOM_SMTP_ENABLED=true`.

3. Redirect URLs
   - Go to Authentication > URL Configuration.
   - Set Site URL to `https://losttofound.org`.
   - Allow exact production redirects used by the app:
     - `https://losttofound.org/auth/confirm`
     - `https://losttofound.org/records`
     - `https://losttofound.org/records?auth=confirmed`
     - `https://losttofound.org/records?auth=recovery`
   - Avoid broad production wildcards.
   - Verify signup confirmation and password reset with synthetic accounts.
   - After verification, set Listhaus repo variable `LOSTTOFOUND_SUPABASE_AUTH_REDIRECTS_VERIFIED_AT=YYYY-MM-DD`.

4. Password security
   - Go to Authentication > Providers > Email.
   - Set minimum password length to at least `12`.
   - Enable Supabase leaked-password protection on Pro, or keep `PWNED_PASSWORD_CHECK_ENABLED=true` so signup and password changes use the free Have I Been Pwned k-anonymity range API as the compensating control on Free.
   - Require reauthentication/current password for sensitive password changes where available.
   - After verification, set:
     - `LOSTTOFOUND_SUPABASE_LEAKED_PASSWORD_PROTECTION_ENABLED=true` when the native Pro control is enabled; otherwise keep it false and require `PWNED_PASSWORD_CHECK_ENABLED=true`.
     - `LOSTTOFOUND_SUPABASE_AUTH_HARDENING_VERIFIED_AT=YYYY-MM-DD`

5. Advisors
   - Run/review Supabase Security Advisor.
   - Confirm no production-blocking records findings remain.
   - Do not treat unused-index INFO notices as launch blockers until real workload traffic exists.

## Required Before Marking Auth Ready

- `npm run verify:supabase-auth` passes.
- Synthetic signup or invite flow confirms through `/auth/confirm`.
- Synthetic password reset lands on `/records?auth=recovery` and password update works.
- Supabase leaked-password protection is enabled, or the tested app-level HIBP range check is enabled as the Free-plan compensating control.
- `SUPABASE_AUTH_HARDENING_VERIFIED_AT` is set only after dashboard settings and advisors are checked.

## Sources

Supabase production checklist recommends custom SMTP for auth email and dashboard advisor review before production. Supabase Auth redirect docs require production Site URL and allow-listed redirect URLs. Supabase password security docs cover minimum length, leaked-password protection, and password-change reauthentication.
