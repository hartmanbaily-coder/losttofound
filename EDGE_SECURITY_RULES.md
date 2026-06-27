# Edge Security Rules

Use these as the starting production rule set for the hosting/CDN/WAF provider. Apply them at `records.losttofound.org` before setting `EDGE_RATE_LIMITING_ENABLED=true` or `EDGE_WAF_ENABLED=true`.

## Route Groups

| Group | Routes | Risk |
| --- | --- | --- |
| Auth | `/api/records/auth/login`, `/api/records/auth/mfa/*`, `/api/records/auth/logout`, `/api/records/auth/session` | Credential abuse, MFA brute force |
| Dataset | `/api/records/dataset` | Private records read/write |
| Evidence | `/api/records/evidence/preflight`, `/api/records/evidence/upload`, `/api/records/evidence/download`, `/api/records/evidence/delete` | Private files, malware scanning, storage abuse |
| Readiness | `/api/records/readiness`, `/launch-readiness` | Operational status, should not expose secrets |
| App | `/`, `/records`, `/privacy`, `/terms` | Normal app access |

## Required Controls

- HTTPS only.
- Redirect HTTP to HTTPS.
- HSTS enabled after validating all required subdomains.
- Block known malicious IP reputation lists.
- Bot/challenge mode for abnormal auth and evidence request patterns.
- Request body size cap no higher than `EVIDENCE_MAX_FILE_BYTES` plus multipart overhead.
- No public cache for records API responses.
- Log request id, route, status, country/region, and WAF action without logging request bodies.

## Suggested Rate Limits

| Route group | Suggested rule | Action |
| --- | --- | --- |
| Auth login | 10 requests per IP per 10 minutes and 10 per email hash per 10 minutes when provider supports request attributes | Challenge or block |
| MFA verify | 8 requests per IP per 10 minutes | Challenge or block |
| Dataset write | 60 requests per authenticated user per 10 minutes | Throttle |
| Evidence preflight | 30 requests per authenticated user per 10 minutes | Throttle |
| Evidence upload | 10 uploads per authenticated user per 10 minutes | Throttle |
| Evidence download | 60 downloads per authenticated user per 10 minutes | Alert after threshold; throttle if anomalous |
| Evidence delete | 20 deletes per authenticated user per 10 minutes | Alert and throttle |
| Readiness | 60 requests per IP per 10 minutes | Throttle |

Keep the app-level fallback limiter enabled even after provider limits are configured.

## Cloudflare-Style Match Targets

Use equivalent expressions for your provider.

```text
http.host eq "records.losttofound.org"
and http.request.uri.path starts_with "/api/records/auth/"
```

```text
http.host eq "records.losttofound.org"
and http.request.uri.path starts_with "/api/records/evidence/"
```

```text
http.host eq "records.losttofound.org"
and http.request.uri.path eq "/api/records/dataset"
```

```text
http.host eq "records.losttofound.org"
and (
  http.request.uri.path eq "/api/records/readiness"
  or http.request.uri.path eq "/launch-readiness"
)
```

## Launch Evidence

Before setting edge readiness flags, record:

- provider name
- rule ids or dashboard links
- creation date
- thresholds
- action type for each route group
- reviewer
- test results showing legitimate login, dataset save, evidence upload, evidence download, and readiness calls still work

Then set:

```bash
EDGE_RATE_LIMITING_ENABLED=true
EDGE_RATE_LIMITING_PROVIDER=<provider>
EDGE_WAF_ENABLED=true
EDGE_WAF_PROVIDER=<provider>
```
