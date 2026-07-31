import { describe, expect, it } from "vitest";
import { validateAsaasWebhookAccessToken } from "./webhook-auth";

describe("validateAsaasWebhookAccessToken", () => {
  it("aceita o valor enviado no header canônico", () => {
    const result = validateAsaasWebhookAccessToken(
      new Headers({ "asaas-access-token": "production-token" }),
      "production-token",
    );

    expect(result).toEqual({
      secretFound: true,
      headerMasked: "*** (16 bytes)",
      secretLength: 16,
      headerLength: 16,
      equalsAfterTrim: true,
      result: "valid",
      allowed: true,
    });
  });

  it("lê o nome do header sem diferenciar maiúsculas/minúsculas", () => {
    const result = validateAsaasWebhookAccessToken(
      new Headers({ "Asaas-Access-Token": "production-token" }),
      "production-token",
    );

    expect(result.allowed).toBe(true);
  });

  it("tolera somente whitespace externo de transporte", () => {
    const result = validateAsaasWebhookAccessToken(
      new Headers({ "asaas-access-token": " production-token " }),
      "production-token\n",
    );

    expect(result.allowed).toBe(true);
    expect(result.result).toBe("valid");
    expect(result.secretLength).toBe(17);
    expect(result.headerLength).toBe(16);
    expect(result.equalsAfterTrim).toBe(true);
  });

  it("rejeita valores diferentes sem expor o header", () => {
    const result = validateAsaasWebhookAccessToken(
      new Headers({ "asaas-access-token": "wrong-token" }),
      "production-token",
    );

    expect(result.allowed).toBe(false);
    expect(result.result).toBe("invalid");
    expect(result.equalsAfterTrim).toBe(false);
    expect(result.headerMasked).not.toContain("wrong-token");
  });

  it("rejeita header ausente quando a Secret está configurada", () => {
    const result = validateAsaasWebhookAccessToken(new Headers(), "production-token");

    expect(result).toEqual({
      secretFound: true,
      headerMasked: "absent",
      secretLength: 16,
      headerLength: 0,
      equalsAfterTrim: false,
      result: "missing_header",
      allowed: false,
    });
  });

  it("é fail-closed quando a Secret não está configurada", () => {
    const result = validateAsaasWebhookAccessToken(new Headers(), undefined);

    expect(result.secretFound).toBe(false);
    expect(result.result).toBe("secret_not_configured");
    expect(result.allowed).toBe(false);
  });
});
