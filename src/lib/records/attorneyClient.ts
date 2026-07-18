export async function getRecordsCsrfToken() {
  const response = await fetch("/api/records/auth/csrf", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const body = (await response.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!response.ok || !body.token) {
    throw new Error(body.error || "Unable to prepare a secure request.");
  }
  return body.token;
}

export async function attorneyMutation(
  endpoint: string,
  body: Record<string, unknown>
) {
  const csrf = await getRecordsCsrfToken();
  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-L2F-CSRF": csrf,
    },
    body: JSON.stringify(body),
  });
  const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
  };
  if (!response.ok) throw new Error(parsed.error || "Secure request failed.");
  return parsed;
}
