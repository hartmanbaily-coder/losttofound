# Production Launch Rehearsal

Rehearsal date: 2026-06-17 America/Anchorage

## Decision

Status: `NO-GO for real user records`

Reason: the records application and records-specific Supabase schema are in good MVP shape, and a clean records production Supabase project now exists. Live Auth hardening, provider controls, isolation verification, malware verification, backup restore evidence, and legal review are still incomplete.

## Supabase Project Split

Production candidate: `cieuilbpnwuvnrxrlczj`

Production URL: `https://cieuilbpnwuvnrxrlczj.supabase.co`

Production project name: `losttofound-records-production`

Production region: `us-west-1`

Staging/mixed-use project: `adhnoiicwfvppzenwcgv`

Staging URL: `https://adhnoiicwfvppzenwcgv.supabase.co`

Recommended role for `adhnoiicwfvppzenwcgv`: staging only.

## Production Supabase Posture

Evidence from 2026-06-17 production project setup:

- Project `cieuilbpnwuvnrxrlczj` is `ACTIVE_HEALTHY`.
- Schema migration applied: `20260617182822_create_records_production_schema`.
- 13 `public.records_*` tables exist.
- All `public.records_*` tables have RLS enabled.
- No direct `anon` or `authenticated` grants remain on `public.records_*`.
- `records-evidence` bucket exists and is private.
- `records-evidence` file limit is `10485760` bytes.
- `records-evidence` MIME allow-list is PDF, PNG, JPEG, HEIC/HEIF, plain text, and CSV.
- 4 storage policies reference `records-evidence`.
- Supabase security advisor returns no findings.
- Supabase performance advisor only reports unused-index INFO notices, expected before real workload traffic.

## Staging Supabase Posture

Evidence from 2026-06-17 inspection:

- Project `adhnoiicwfvppzenwcgv` is `ACTIVE_HEALTHY`.
- Database is Postgres 17 in `us-west-2`.
- Records migrations applied to staging:
  - `20260616005239_create_records_production_schema`
  - `20260616005410_harden_records_direct_table_access`
  - `20260616005828_tune_records_indexes_and_profile_policies`
- 13 `public.records_*` tables exist.
- All `public.records_*` tables have RLS enabled.
- No direct `anon` or `authenticated` grants remain on `public.records_*`.
- `records-evidence` bucket exists and is private.
- `records-evidence` file limit is `10485760` bytes.
- `records-evidence` MIME allow-list is PDF, PNG, JPEG, HEIC/HEIF, plain text, and CSV.
- 4 storage policies reference `records-evidence`.
- Recent Supabase API logs show activity against the old `pets` REST endpoint, not records endpoints.

Staging-only Supabase/project findings:

- Existing non-records objects still produce advisor findings: `finder_messages`, `pets`, `profiles`, `sightings`, `user_profiles`, and public bucket `pet-photos`.
- Records performance advisor notices are unused-index INFO findings, expected before real workload traffic.

## Launch Gates

Completed in repo/app:

- Server-managed Supabase Auth cookies for records routes.
- Records TOTP MFA enrollment/verification flow.
- Production AAL2 enforcement gate.
- Server-mediated records dataset API.
- Private evidence upload/download/delete routes.
- Malware-scanner readiness gate for evidence upload.
- App-level fallback rate limits.
- Sanitized security event logging.
- Production readiness API and CI gate.
- Secret-pattern scan.
- High-severity production dependency audit.
- Production dependency audit currently reports `0` vulnerabilities after the PostCSS nested dependency override.
- Two-user isolation verifier script.
- Malware scanner verifier script.
- Live readiness verifier script.
- Security event sink verifier script.
- Backup restore evidence verifier script.
- Production launch cockpit at `/launch-readiness`.
- Production environment template at `.env.production.example`.
- Legal review packet and edge security rule packet.
- Privacy, terms, retention/deletion, incident response, monitoring, and security docs drafted.
- Clean records-only production Supabase project created.
- Production records schema applied and verified.

Still blocked before real user data:

- Configure production Supabase Auth settings:
  - MFA required.
  - Leaked-password protection enabled.
  - Password minimum at least 12.
  - Current-password/reauth required for password changes.
  - Invite-only or self-registration policy decided.
- Configure production secrets in GitHub Actions and host.
- Configure provider-level WAF, bot controls, and rate limits for auth, dataset, evidence, exports, and writes.
- Configure security monitoring sink and alert routing.
- Run and document `npm run verify:isolation` against deployed Supabase mode using synthetic users only.
- Configure real malware scanner and run `npm run verify:malware`.
- Run and document a backup restore drill.
- Complete vendor/security review.
- Complete legal review of privacy, terms, retention/deletion, incident response, and court-report wording.
- Run `npm run check:live` against the deployed production URL after all env gates are set.

## Recommended Next Action

Configure production Supabase Auth hardening in project `cieuilbpnwuvnrxrlczj`, then wire deployment secrets to the new production project.

Use this sequence:

1. Configure Auth hardening in the Supabase dashboard.
2. Set production GitHub/host secrets using `https://cieuilbpnwuvnrxrlczj.supabase.co`.
3. Deploy app in Supabase mode using the new project secrets.
4. Run `npm run verify:isolation` against the deployed app using synthetic users only.
5. Configure the real malware scanner and run `npm run verify:malware`.
6. Run a backup restore drill and record the evidence date.
7. Run `npm run check:live`.
8. Complete legal and vendor review before real user data.

## Cutover Rule

Do not point real users or real custody records at production until:

- `/api/records/readiness` returns `ready` in production.
- `npm run check:live` passes.
- `TWO_USER_ISOLATION_TESTED_AT`, `MALWARE_SCANNER_TESTED_AT`, and `BACKUP_RESTORE_TESTED_AT` are set from real verification.
- `LEGAL_REVIEW_APPROVED=true` is backed by actual review, not just an environment flag.
