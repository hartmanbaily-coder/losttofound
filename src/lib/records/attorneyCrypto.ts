import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

type ProtectedEmail = {
  ciphertext: string;
  nonce: string;
  tag: string;
  hash: string;
};

export type AttorneyOpaqueHandle = {
  kind: "invitation" | "grant" | "evidence";
  id: string;
  subject: string;
  grantId?: string;
  expiresAt: number;
};

function secret(env: Record<string, string | undefined> = process.env) {
  const value = env.ATTORNEY_PORTAL_SECRET || "";
  if (value.length < 32) {
    throw new Error("Attorney portal cryptographic secret is not configured.");
  }
  return value;
}

function keyFor(purpose: string, env?: Record<string, string | undefined>) {
  return createHash("sha256").update(`${purpose}:${secret(env)}`).digest();
}

export function isAttorneyPortalCryptoReady(
  env: Record<string, string | undefined> = process.env
) {
  return (env.ATTORNEY_PORTAL_SECRET || "").length >= 32;
}

export function normalizeAttorneyEmail(value: string) {
  return value.trim().normalize("NFKC").toLowerCase();
}

export function attorneyEmailHash(
  value: string,
  env: Record<string, string | undefined> = process.env
) {
  return createHmac("sha256", keyFor("attorney-email-hmac", env))
    .update(normalizeAttorneyEmail(value))
    .digest("hex");
}

export function protectAttorneyEmail(
  value: string,
  env: Record<string, string | undefined> = process.env
): ProtectedEmail {
  const normalized = normalizeAttorneyEmail(value);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor("attorney-email-aead", env), nonce);
  cipher.setAAD(Buffer.from("losttofound-attorney-email-v1"));
  const ciphertext = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    nonce: nonce.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    hash: attorneyEmailHash(normalized, env),
  };
}

export function revealAttorneyEmail(
  input: Pick<ProtectedEmail, "ciphertext" | "nonce" | "tag">,
  env: Record<string, string | undefined> = process.env
) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFor("attorney-email-aead", env),
    Buffer.from(input.nonce, "base64url")
  );
  decipher.setAAD(Buffer.from("losttofound-attorney-email-v1"));
  decipher.setAuthTag(Buffer.from(input.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function createAttorneyInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAttorneyInvitationToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function isAttorneyInvitationToken(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function sealAttorneyHandle(
  payload: AttorneyOpaqueHandle,
  env: Record<string, string | undefined> = process.env
) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor("attorney-handle-aead", env), nonce);
  cipher.setAAD(Buffer.from("losttofound-attorney-handle-v1"));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    nonce.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

export function openAttorneyHandle(
  value: string,
  expected: Pick<AttorneyOpaqueHandle, "kind" | "subject">,
  env: Record<string, string | undefined> = process.env
) {
  try {
    const [version, nonce, ciphertext, tag, extra] = value.split(".");
    if (version !== "v1" || !nonce || !ciphertext || !tag || extra) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFor("attorney-handle-aead", env),
      Buffer.from(nonce, "base64url")
    );
    decipher.setAAD(Buffer.from("losttofound-attorney-handle-v1"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const parsed = JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8")
    ) as Partial<AttorneyOpaqueHandle>;
    if (
      parsed.kind !== expected.kind ||
      parsed.subject !== expected.subject ||
      typeof parsed.id !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now()
    ) {
      return null;
    }
    return parsed as AttorneyOpaqueHandle;
  } catch {
    return null;
  }
}

export function constantTimeEqualStrings(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
