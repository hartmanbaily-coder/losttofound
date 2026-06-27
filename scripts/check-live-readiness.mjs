function fail(message) {
  console.error(message);
  process.exit(1);
}

const baseUrl = String(process.env.RECORDS_APP_BASE_URL || "").replace(/\/$/, "");
if (!baseUrl || !baseUrl.startsWith("https://")) {
  fail("Set RECORDS_APP_BASE_URL to the deployed https:// records app URL.");
}

const response = await fetch(`${baseUrl}/api/records/readiness`, {
  headers: {
    Accept: "application/json",
  },
});

const body = await response.json().catch(() => ({}));
if (!response.ok || body.status !== "ready") {
  console.error(JSON.stringify(body, null, 2));
  fail(`Live readiness failed with HTTP ${response.status}.`);
}

console.log(`Live readiness passed for ${baseUrl} at ${new Date().toISOString()}.`);
