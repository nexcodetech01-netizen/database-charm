import { describe, it, expect } from "vitest";
import { sanitizeForAudit, isSensitiveKey } from "../infrastructure/sanitizer";

describe("sanitizeForAudit", () => {
  it("redige chaves sensíveis", () => {
    const out = sanitizeForAudit({
      name: "Maria",
      authorization: "Bearer abc.def.ghi",
      apiKey: "sk_live_1234567890abcdef",
      nested: { password: "s3cret", token: "xyz" },
    }) as Record<string, unknown>;
    expect(out.name).toBe("Maria");
    expect(out.authorization).toBe("[REDACTED]");
    expect(out.apiKey).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).password).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).token).toBe("[REDACTED]");
  });

  it("redige strings que parecem JWT/bearer/opaque keys", () => {
    const out = sanitizeForAudit({
      a: "eyJabcdefghij.eyJklmnopqrs.tuvwxyz0123",
      b: "sb_secret_abcdefghij0123456789",
      c: "Bearer 12345",
      ok: "conteudo normal",
    }) as Record<string, string>;
    expect(out.a).toBe("[REDACTED]");
    expect(out.b).toBe("[REDACTED]");
    expect(out.c).toBe("[REDACTED]");
    expect(out.ok).toBe("conteudo normal");
  });

  it("isSensitiveKey identifica variantes comuns", () => {
    expect(isSensitiveKey("Authorization")).toBe(true);
    expect(isSensitiveKey("api_key")).toBe(true);
    expect(isSensitiveKey("service_role_key")).toBe(true);
    expect(isSensitiveKey("cpf")).toBe(true);
    expect(isSensitiveKey("name")).toBe(false);
  });

  it("trunca strings muito longas", () => {
    const long = "a".repeat(3000);
    const out = sanitizeForAudit({ v: long }) as { v: string };
    expect(out.v.endsWith("[truncated]")).toBe(true);
  });
});
