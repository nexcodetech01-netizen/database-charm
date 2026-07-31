import { describe, expect, it } from "vitest";

import {
  buildProviderHealthItems,
  summarizeProviderHealth,
  type ProviderHealthFacts,
} from "../provider-health";

const base: ProviderHealthFacts = {
  providerId: "focus_nfe",
  environment: "production",
  apiUrl: "https://api.focusnfe.com.br",
  hasCompanyToken: true,
  hasAdminToken: true,
  hasActiveCertificate: true,
  provisionedAt: "2026-01-10T12:00:00.000Z",
  companyProbe: { httpStatus: 404, durationMs: 120 },
  adminProbe: { httpStatus: 200, durationMs: 130 },
};

const byId = (facts: ProviderHealthFacts) =>
  Object.fromEntries(buildProviderHealthItems(facts).map((i) => [i.id, i]));

describe("provider-health", () => {
  it("aceita 404 no probe de emissão como credencial válida", () => {
    expect(byId(base).company_token.status).toBe("ok");
  });

  it("404 sozinho não gera veredito global OK quando outro item falha", () => {
    const items = buildProviderHealthItems({ ...base, hasActiveCertificate: false });
    const summary = summarizeProviderHealth(items);
    expect(summary.status).toBe("error");
    expect(summary.message).toContain("Certificado A1");
  });

  it("todos os itens ok → veredito global ok", () => {
    expect(summarizeProviderHealth(buildProviderHealthItems(base)).status).toBe("ok");
  });

  it("401 no token de empresa é erro de credencial de emissão", () => {
    const items = byId({ ...base, companyProbe: { httpStatus: 401, durationMs: 90 } });
    expect(items.company_token.status).toBe("error");
    expect(items.admin_token.status).toBe("ok");
  });

  it("401 no token admin não contamina o token de empresa", () => {
    const items = byId({ ...base, adminProbe: { httpStatus: 401, durationMs: 90 } });
    expect(items.admin_token.status).toBe("error");
    expect(items.company_token.status).toBe("ok");
  });

  it("404 no endpoint administrativo NÃO é aceito como autenticação válida", () => {
    expect(byId({ ...base, adminProbe: { httpStatus: 404, durationMs: 90 } }).admin_token.status).toBe(
      "warning",
    );
  });

  it("compatibilidade: sem token admin mas já provisionada → apenas aviso", () => {
    const items = byId({ ...base, hasAdminToken: false, adminProbe: null });
    expect(items.admin_token.status).toBe("warning");
    expect(summarizeProviderHealth(buildProviderHealthItems({
      ...base,
      hasAdminToken: false,
      adminProbe: null,
    })).status).toBe("warning");
  });

  it("sem token admin e sem provisionamento → erro", () => {
    const items = byId({
      ...base,
      hasAdminToken: false,
      adminProbe: null,
      provisionedAt: null,
    });
    expect(items.admin_token.status).toBe("error");
    expect(items.provisioning.status).toBe("error");
  });

  it("token de empresa ausente é sempre erro", () => {
    expect(
      byId({ ...base, hasCompanyToken: false, companyProbe: null }).company_token.status,
    ).toBe("error");
  });

  it("URL ausente marca o item de API como erro", () => {
    expect(byId({ ...base, apiUrl: null, companyProbe: null, adminProbe: null }).api.status).toBe(
      "error",
    );
  });

  it("falha de rede marca API como erro", () => {
    const items = byId({
      ...base,
      companyProbe: { httpStatus: 0, durationMs: 30, networkError: "ECONNRESET" },
    });
    expect(items.api.status).toBe("error");
    expect(items.company_token.status).toBe("error");
  });

  it("HTTP 5xx é indisponibilidade, não credencial inválida", () => {
    const items = byId({ ...base, companyProbe: { httpStatus: 503, durationMs: 200 } });
    expect(items.company_token.status).toBe("warning");
    expect(items.api.status).toBe("warning");
  });

  it("provedor mock não exige credenciais nem provisionamento", () => {
    const items = byId({ ...base, providerId: "mock" });
    expect(items.admin_token.status).toBe("skipped");
    expect(items.company_token.status).toBe("skipped");
    expect(items.provisioning.status).toBe("skipped");
    expect(items.api.status).toBe("warning");
  });
});
