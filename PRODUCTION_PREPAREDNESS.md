# Production Preparedness

Lost to Found Records can run against either the local demo store or the Supabase-backed dataset snapshot API. This document tracks the remaining work required before accepting real custody, parenting-time, support, and evidence records.

## Current Production-Prep Additions

- `src/lib/production/readiness.ts` evaluates production blockers without exposing secrets.
- `src/app/api/records/readiness/route.ts` returns readiness status and uses HTTP 503 in production when blockers remain.
- `scripts/check-production-readiness.mjs` blocks CI/deploy when required production environment variables are missing, rejects the old staging Supabase project, and prints vendor/audit review warnings.
- `npm run check:pre-supabase` runs the same readiness guard while intentionally deferring the final Supabase Auth, storage, restore, and isolation gates.
- `scripts/verify-production-env-template.mjs` verifies `.env.production.example` stays complete, points at the intended production records host/project, and does not contain real secrets.
- `scripts/verify-security-headers.mjs` verifies CSP, HSTS, frame blocking, referrer policy, content-type sniffing protection, and browser permissions policy.
- `.github/workflows/deploy.yml` now runs lint, typecheck, unit tests, build, and production readiness before SSH deploy.
- `database/supabase/production_schema.sql` defines the first Supabase/Postgres schema with RLS, server-mediated table access, FK indexes, and private evidence bucket policies.
- Supabase client helpers now fail when called without production config, not at module import time.
- `src/app/api/records/auth/login/route.ts`, `session/route.ts`, and `logout/route.ts` add Supabase Auth through server-managed HttpOnly cookies.
- `src/app/api/records/auth/mfa/verify/route.ts` and `src/app/api/records/auth/mfa/enroll/verify/route.ts` add Supabase TOTP MFA verification and enrollment completion while keeping tokens in HttpOnly cookies.
- `src/app/api/records/dataset/route.ts` adds a Supabase-backed dataset snapshot API authenticated by server-managed records cookies.
- `src/app/api/records/evidence/preflight/route.ts` gates Supabase-mode evidence metadata behind authenticated server preflight and malware-provider readiness.
- `src/app/api/records/evidence/upload/route.ts`, `download/route.ts`, and `delete/route.ts` provide server-mediated private evidence file handling with scan-before-store behavior.
- `src/lib/security/rateLimit.ts` adds an app-level fallback limiter for records auth, dataset, and evidence routes.
- `src/lib/security/securityEvents.ts` emits sanitized security events for login/MFA/evidence alerts, with optional HTTPS webhook delivery.
- `PRIVACY_SECURITY_READINESS.md` defines the privacy/security launch gates, runbooks, and two-user isolation test.
- `MONITORING_ALERTING_RUNBOOK.md` defines production security monitoring sources, alert thresholds, log privacy rules, and escalation paths.
- `INCIDENT_RESPONSE_RUNBOOK.md` defines incident severity, containment, investigation, notification review, recovery, and post-incident review steps.
- `DATA_RETENTION_DELETION_RUNBOOK.md` defines the production retention, export, deletion, backup-aging, and legal-hold model to finalize before launch.
- `scripts/verify-two-user-isolation.mjs` runs an executable synthetic two-user isolation check against a deployed Supabase-mode app.
- `scripts/verify-malware-scanner.mjs` verifies the production malware scanner with clean and EICAR test payloads.
- `scripts/verify-security-event-sink.mjs` emits or delivers a synthetic sanitized security event for monitoring-sink verification.
- `scripts/verify-backup-restore-evidence.mjs` validates restore-drill evidence before `BACKUP_RESTORE_TESTED_AT` is trusted.
- `scripts/check-live-readiness.mjs` verifies the deployed `/api/records/readiness` endpoint before traffic cutover.
- `scripts/check-secrets.mjs` scans tracked source files for common committed secret patterns before deploy.
- `npm run security:audit` runs a high-severity production dependency audit before deploy.
- `package.json` pins the PostCSS floor at `^8.5.15` and uses an npm override so nested consumers, including Next, resolve to the patched PostCSS line.
- `.env.production.example` defines the production host/Supabase target and required secret placeholders.
- `EDGE_SECURITY_RULES.md` defines provider-ready WAF/rate-limit targets for records routes.
- `LEGAL_REVIEW_PACKET.md` packages the documents and decisions needed for legal review.
- `/launch-readiness` renders a production launch cockpit from the same readiness engine as `/api/records/readiness`.
- `/launch-wizard` separates pre-Supabase work from the final Supabase live-data step.
- `SUPABASE_LIVE_VERIFICATION.md` records the current live Supabase project verification state and open advisor findings.
- `PRODUCTION_LAUNCH_REHEARSAL.md` records the latest go/no-go rehearsal, current Supabase evidence, and remaining live launch gates.
- `/privacy` and `/terms` now contain records-specific public drafts that must be reviewed before launch.
- `src/lib/records/clientStore.ts` can run in `local` mode or `supabase` mode using `NEXT_PUBLIC_RECORDS_STORAGE_MODE`.
- The Records Timeline view now merges custody calendar days, scheduled exchanges, logged exchanges, notes, evidence, support, and expenses into expandable court-packet-oriented rows with CSV export.

## Supabase Project State

Production project: `cieuilbpnwuvnrxrlczj`

Production project URL: `https://cieuilbpnwuvnrxrlczj.supabase.co`

Production project name: `losttofound-records-production`

Production project region: `us-west-1`

Staging/mixed-use project: `adhnoiicwfvppzenwcgv`

Staging/mixed-use project URL: `https://adhnoiicwfvppzenwcgv.supabase.co`

Applied production migrations:

- `20260617182822_create_records_production_schema`

Verified:

- 13 `public.records_*` tables exist with RLS enabled.
- No direct `anon` or `authenticated` table privileges remain on `public.records_*`.
- Private Storage bucket `records-evidence` exists with a 10 MB file limit and restricted MIME types.
- Supabase security advisor reports no production project findings.
- Supabase performance advisor reports expected unused-index INFO notices until real query traffic exists.
- The old staging/mixed-use project still has lost-pet public table/bucket findings and disabled leaked-password protection. Keep it out of production records traffic.

## Required Before Real User Data

1. Run `npm run verify:env-template`, `npm run security:secrets`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, and `npm run build`.
2. Configure edge/WAF rate limits and bot protections for auth, dataset, evidence, exports, and write-heavy routes, then set provider names.
3. Configure monitoring/alerting for failed logins, MFA failures, evidence access, storage errors, server errors, and readiness failures, then run `npm run verify:security-events`.
4. Configure and verify the real malware scanning service with `npm run verify:malware`.
5. Approve retention/deletion, backup aging, incident response, monitoring/alerting, legal review, and vendor review runbooks.
6. Run `npm run check:pre-supabase` to confirm all non-Supabase launch gates are clear.
7. Configure production secrets in GitHub Actions and the host using project `cieuilbpnwuvnrxrlczj`.
8. Set `EXPECTED_SUPABASE_PROJECT_REF=cieuilbpnwuvnrxrlczj` so production readiness fails if secrets point at the old staging project.
9. Decide whether production is invite-only or self-registration, then configure Supabase Auth accordingly.
10. Configure MFA policy, leaked-password protection, reset-token settings, password-change reauthentication, and session/device revocation in Supabase Auth.
11. Set `RECORDS_ENFORCE_MFA=true` after the Supabase TOTP flow is verified in staging.
12. Manually verify RLS/storage behavior with at least two authenticated test users, including cross-user evidence download/delete denial.
13. Run a restore drill, save `ops/backup-restore-evidence.json`, and run `npm run verify:backup-restore`.
14. Seed staging with synthetic data only and run end-to-end tests against staging.
15. Point `losttofound.org` only after readiness API returns `ready` in production and `npm run check:live` passes.

## Verification Commands

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run security:secrets
npm run security:audit
npm run build
npm run test:e2e
npm run verify:env-template
npm run verify:headers
npm run check:pre-supabase
npm run check:production
npm run verify:malware
npm run check:live
npm run verify:isolation
npm run verify:security-events
npm run verify:backup-restore
```

`npm run check:pre-supabase` is the right guard while Supabase is intentionally saved for last. `npm run check:production` is expected to fail locally until real production environment variables are present. `npm run verify:isolation` requires a deployed Supabase-mode app URL and service-role credentials; run it only with synthetic data. `npm run verify:backup-restore` expects ignored real evidence at `ops/backup-restore-evidence.json`; keep the committed example free of real data.

## Known Remaining Gap

The user-facing records app now has Supabase Auth cookie routes, TOTP MFA enrollment/verification endpoints, production AAL2 enforcement, a Supabase snapshot persistence adapter, server-mediated private evidence upload/download/delete routes, app-level rate-limit fallback, sanitized security event logging, CI secret/dependency scanning, production template/header verifiers, a court-oriented Records Timeline, a launch wizard, and the records schema applied in Supabase. Production launch still requires the remaining non-Supabase owner/provider approvals plus live Supabase Auth dashboard hardening, backup restore verification, two-user RLS/storage verification, production secrets, and final deployed readiness before any real custody, child, payment, court, or evidence content is entered.
