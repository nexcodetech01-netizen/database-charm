/**
 * Server-only crypto utilities for the Meta integration.
 *
 * - HMAC-SHA256 signed state param for OAuth CSRF protection.
 * - AES-256-GCM at-rest encryption for access tokens stored in Supabase.
 *
 * NEVER import this file from a browser bundle.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, createHash } from "node:crypto";

/** Falha de configuração: segredo do cofre ausente no ambiente. */
export class MetaSecretMissingError extends Error {
  constructor(public readonly secretName: string) {
    super(
      `${secretName} não está configurado. Configure o segredo para reativar a integração.`,
    );
    this.name = "MetaSecretMissingError";
  }
}

/**
 * Falha de decriptação: o dado foi cifrado com outra chave (ou está corrompido).
 * Sinaliza "reconectar", nunca um erro 500 genérico.
 */
export class TokenDecryptError extends Error {
  constructor(cause?: unknown) {
    super(
      "Não foi possível decifrar o token armazenado (chave de criptografia diferente). Reconecte a integração.",
    );
    this.name = "TokenDecryptError";
    if (cause instanceof Error) this.cause = cause;
  }
}

/** true quando os dois segredos do cofre estão presentes no ambiente. */
export function metaSecretsConfigured(): boolean {
  return Boolean(process.env.META_OAUTH_STATE_SECRET && process.env.META_TOKEN_ENC_SECRET);
}

function stateSecret(): string {
  const s = process.env.META_OAUTH_STATE_SECRET;
  if (!s) throw new MetaSecretMissingError("META_OAUTH_STATE_SECRET");
  return s;
}

function encKey(): Buffer {
  const s = process.env.META_TOKEN_ENC_SECRET;
  if (!s) throw new MetaSecretMissingError("META_TOKEN_ENC_SECRET");
  return createHash("sha256").update(s).digest();
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export interface OAuthStatePayload {
  companyId: string;
  userId: string;
  nonce: string;
  iat: number;
}

export function signState(payload: Omit<OAuthStatePayload, "nonce" | "iat">): string {
  const full: OAuthStatePayload = {
    ...payload,
    nonce: randomBytes(12).toString("hex"),
    iat: Math.floor(Date.now() / 1000),
  };
  const body = b64url(Buffer.from(JSON.stringify(full), "utf8"));
  const sig = b64url(createHmac("sha256", stateSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyState(token: string, maxAgeSeconds = 600): OAuthStatePayload {
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new Error("Invalid state");
  const expected = b64url(createHmac("sha256", stateSecret()).update(body).digest());
  if (expected.length !== sig.length) throw new Error("Invalid state signature");
  // timing-safe compare
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) throw new Error("Invalid state signature");
  const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as OAuthStatePayload;
  if (Math.floor(Date.now() / 1000) - payload.iat > maxAgeSeconds) {
    throw new Error("State expired");
  }
  return payload;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${b64url(iv)}.${b64url(tag)}.${b64url(ct)}`;
}

export function decryptToken(stored: string): string {
  const key = encKey(); // MetaSecretMissingError quando o cofre não está configurado
  try {
    const [version, ivB, tagB, ctB] = stored.split(".");
    if (version !== "v1") throw new Error("Unknown token version");
    const decipher = createDecipheriv("aes-256-gcm", key, b64urlDecode(ivB));
    decipher.setAuthTag(b64urlDecode(tagB));
    const pt = Buffer.concat([decipher.update(b64urlDecode(ctB)), decipher.final()]);
    return pt.toString("utf8");
  } catch (err) {
    throw new TokenDecryptError(err);
  }
}

/** Decriptação tolerante: devolve `null` em vez de lançar. */
export function tryDecryptToken(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    return decryptToken(stored);
  } catch {
    return null;
  }
}
