/**
 * Server-only crypto utilities for the Meta integration.
 *
 * - HMAC-SHA256 signed state param for OAuth CSRF protection.
 * - AES-256-GCM at-rest encryption for access tokens stored in Supabase.
 *
 * NEVER import this file from a browser bundle.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, createHash } from "node:crypto";

function stateSecret(): string {
  const s = process.env.META_OAUTH_STATE_SECRET;
  if (!s) throw new Error("META_OAUTH_STATE_SECRET is not set");
  return s;
}

function encKey(): Buffer {
  const s = process.env.META_TOKEN_ENC_SECRET;
  if (!s) throw new Error("META_TOKEN_ENC_SECRET is not set");
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
  const [version, ivB, tagB, ctB] = stored.split(".");
  if (version !== "v1") throw new Error("Unknown token version");
  const decipher = createDecipheriv("aes-256-gcm", encKey(), b64urlDecode(ivB));
  decipher.setAuthTag(b64urlDecode(tagB));
  const pt = Buffer.concat([decipher.update(b64urlDecode(ctB)), decipher.final()]);
  return pt.toString("utf8");
}
