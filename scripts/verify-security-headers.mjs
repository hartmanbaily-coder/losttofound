const baseUrl = String(process.env.RECORDS_APP_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const allowInsecure = ["true", "1", "yes"].includes(
  String(process.env.ALLOW_INSECURE_HEADER_CHECK || "").toLowerCase()
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isLocalhostUrl(value) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function requireHeader(headers, name, predicate, reason) {
  const value = headers.get(name);
  if (!value || !predicate(value)) {
    return `${name}: ${reason}${value ? ` (received "${value}")` : " (missing)"}`;
  }
  return "";
}

function cspDirective(value, name) {
  return value
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive === name || directive.startsWith(`${name} `)) || "";
}

let url;
try {
  url = new URL(baseUrl);
} catch {
  fail("RECORDS_APP_BASE_URL must be a valid URL.");
}

if (url.protocol !== "https:" && !isLocalhostUrl(baseUrl) && !allowInsecure) {
  fail("Security header checks against non-local production URLs require https://.");
}

let response;
try {
  response = await fetch(baseUrl, { method: "HEAD", redirect: "manual" });
  if (response.status === 405) {
    response = await fetch(baseUrl, { method: "GET", redirect: "manual" });
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(`Security header check could not reach ${baseUrl}: ${message}`);
}

if (response.status >= 400) {
  fail(`Security header check failed with HTTP ${response.status}.`);
}

const headerFindings = [
  requireHeader(
    response.headers,
    "content-security-policy",
    (value) =>
      [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "connect-src 'self'",
      ].every((directive) => value.includes(directive)),
    "must include the required application CSP directives"
  ),
  requireHeader(
    response.headers,
    "content-security-policy",
    (value) => {
      const scriptSrc = cspDirective(value, "script-src");
      return scriptSrc.includes("'self'") && /'nonce-[A-Za-z0-9+/_-]+={0,2}'/.test(scriptSrc);
    },
    "script-src must include self and a request nonce"
  ),
  requireHeader(
    response.headers,
    "content-security-policy",
    (value) => {
      const scriptSrc = cspDirective(value, "script-src");
      return !scriptSrc.includes("'unsafe-inline'") && !scriptSrc.includes("'unsafe-eval'");
    },
    "script-src must not allow unsafe-inline or unsafe-eval"
  ),
  requireHeader(
    response.headers,
    "strict-transport-security",
    (value) =>
      value.includes("max-age=31536000") &&
      value.toLowerCase().includes("includesubdomains") &&
      value.toLowerCase().includes("preload"),
    "must enforce one-year HSTS with includeSubDomains and preload"
  ),
  requireHeader(
    response.headers,
    "x-content-type-options",
    (value) => value.toLowerCase() === "nosniff",
    "must be nosniff"
  ),
  requireHeader(
    response.headers,
    "referrer-policy",
    (value) => value.toLowerCase() === "strict-origin-when-cross-origin",
    "must be strict-origin-when-cross-origin"
  ),
  requireHeader(
    response.headers,
    "permissions-policy",
    (value) =>
      ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()", "browsing-topics=()"].every(
        (directive) => value.includes(directive)
      ),
    "must disable sensitive browser capabilities"
  ),
  requireHeader(
    response.headers,
    "x-frame-options",
    (value) => value.toUpperCase() === "DENY",
    "must be DENY"
  ),
].filter(Boolean);

if (headerFindings.length > 0) {
  fail(`Security header verification failed for ${baseUrl}:\n- ${headerFindings.join("\n- ")}`);
}

console.log(`Security headers verified for ${baseUrl}.`);
