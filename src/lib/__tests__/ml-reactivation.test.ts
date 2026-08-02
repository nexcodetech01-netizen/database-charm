import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { requireServiceKey, serviceKeyConfigured } from "@/lib/job-admin.server";

describe("SPRINT ML-1 — guard de service key dos jobs", () => {
  it("bloqueia com 503 quando nenhuma chave de service role existe", async () => {
    const res = requireServiceKey("marketplace-sync", {});
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
    await expect(res!.json()).resolves.toMatchObject({ error: "service_key_missing" });
  });

  it("libera com MY_SUPABASE_SERVICE_KEY", () => {
    expect(serviceKeyConfigured({ MY_SUPABASE_SERVICE_KEY: "k" })).toBe(true);
    expect(requireServiceKey("dlq-reprocess", { MY_SUPABASE_SERVICE_KEY: "k" })).toBeNull();
  });

  it("aceita o fallback SUPABASE_SERVICE_ROLE_KEY", () => {
    expect(requireServiceKey("mercadolivre-refresh", { SUPABASE_SERVICE_ROLE_KEY: "k" })).toBeNull();
  });
});

describe("SPRINT ML-1 — cofre de criptografia", () => {
  const originalEnc = process.env.META_TOKEN_ENC_SECRET;
  const originalState = process.env.META_OAUTH_STATE_SECRET;

  beforeEach(() => {
    vi.resetModules();
    process.env.META_TOKEN_ENC_SECRET = "chave-de-teste-1";
    process.env.META_OAUTH_STATE_SECRET = "state-de-teste-1";
  });

  afterEach(() => {
    process.env.META_TOKEN_ENC_SECRET = originalEnc;
    process.env.META_OAUTH_STATE_SECRET = originalState;
  });

  it("faz round-trip de token e assina/valida o state", async () => {
    const m = await import("@/lib/meta-crypto.server");
    expect(m.metaSecretsConfigured()).toBe(true);
    expect(m.decryptToken(m.encryptToken("ACCESS-123"))).toBe("ACCESS-123");
    const state = m.signState({ companyId: "c1", userId: "u1" });
    expect(m.verifyState(state).companyId).toBe("c1");
  });

  it("lança TokenDecryptError quando a chave mudou (sem 500 genérico)", async () => {
    const m = await import("@/lib/meta-crypto.server");
    const cipher = m.encryptToken("ACCESS-123");
    process.env.META_TOKEN_ENC_SECRET = "outra-chave";
    vi.resetModules();
    const m2 = await import("@/lib/meta-crypto.server");
    expect(() => m2.decryptToken(cipher)).toThrowError(/Reconecte a integração/);
    expect(m2.tryDecryptToken(cipher)).toBeNull();
  });

  it("sinaliza segredo ausente com MetaSecretMissingError", async () => {
    delete process.env.META_TOKEN_ENC_SECRET;
    vi.resetModules();
    const m = await import("@/lib/meta-crypto.server");
    expect(m.metaSecretsConfigured()).toBe(false);
    expect(() => m.encryptToken("x")).toThrowError(/META_TOKEN_ENC_SECRET/);
  });

  it("tryDecryptToken devolve null para entrada vazia ou corrompida", async () => {
    const m = await import("@/lib/meta-crypto.server");
    expect(m.tryDecryptToken(null)).toBeNull();
    expect(m.tryDecryptToken("v1.aa.bb.cc")).toBeNull();
  });
});
