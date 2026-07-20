export type RecordsAuthFragment =
  | { kind: "none" }
  | { kind: "confirmation" }
  | {
      kind: "recovery";
      accessToken: string;
      refreshToken: string;
      expiresIn: string | null;
    }
  | { kind: "error" };

const confirmationTypes = new Set(["email", "signup"]);

export function parseRecordsAuthFragment(
  rawHash: string,
  authState: string | null
): RecordsAuthFragment {
  const hash = new URLSearchParams(rawHash.replace(/^#/, ""));
  if (hash.has("error") || hash.has("error_description")) return { kind: "error" };

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (!accessToken && !refreshToken) return { kind: "none" };
  if (!accessToken || !refreshToken) return { kind: "error" };

  const type = hash.get("type")?.toLowerCase() || "";
  if (type === "recovery" || (!type && authState === "recovery")) {
    return {
      kind: "recovery",
      accessToken,
      refreshToken,
      expiresIn: hash.get("expires_in"),
    };
  }

  if (confirmationTypes.has(type) || (!type && authState === "confirmed")) {
    return { kind: "confirmation" };
  }

  return { kind: "error" };
}
