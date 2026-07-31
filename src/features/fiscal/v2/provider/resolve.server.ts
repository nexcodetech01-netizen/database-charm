/**
 * Fiscal v2 — Resolução do provider real (Sprint 011). SERVER-ONLY.
 *
 * Único ponto de escolha entre Mock e provedores reais. A seleção é
 * dirigida por `fiscal_provider_config.provider_id` + credencial no
 * vault (`fiscal_secrets.kind = 'provider_api_key'`).
 */
import type { FiscalProvider } from "./fiscal-provider";
import { FiscalProviderMock } from "./fiscal-provider-mock";
import { FiscalProviderFocusNfe } from "./fiscal-provider-focus.server";

export interface ResolveProviderInput {
  providerId: string | null | undefined;
  environment: "homologation" | "production";
  apiUrl?: string | null;
  /** Token da EMPRESA (emissão de NF-e). */
  apiKey?: string | null;
  /**
   * Token PRINCIPAL da conta (endpoints administrativos `/v2/empresas`).
   * Ausente → o provider cai para o token de empresa (compatibilidade).
   */
  adminApiKey?: string | null;
}

export class FiscalProviderNotConfiguredError extends Error {}

export function resolveFiscalProviderFor(input: ResolveProviderInput): FiscalProvider {
  const id = (input.providerId ?? "mock").toLowerCase();

  // Diagnóstico: valores carregados da configuração antes de instanciar o
  // provider (nunca loga a credencial, apenas se ela existe).
  console.info("[fiscal] resolveFiscalProviderFor", {
    providerId: id,
    environment: input.environment,
    apiUrl: input.apiUrl ?? "(fallback do provider)",
    hasApiKey: Boolean(input.apiKey),
    hasAdminApiKey: Boolean(input.adminApiKey),
  });

  if (id === "mock" || id === "") return new FiscalProviderMock();


  if (id === "focusnfe" || id === "focus_nfe" || id === "focus") {
    if (!input.apiKey) {
      throw new FiscalProviderNotConfiguredError(
        "API key do provedor não configurada. Cadastre em Fiscal → Configuração → Provedor.",
      );
    }
    return new FiscalProviderFocusNfe({
      token: input.apiKey,
      adminToken: input.adminApiKey ?? null,
      environment: input.environment,
      baseUrl: input.apiUrl ?? null,
    });
  }

  throw new FiscalProviderNotConfiguredError(
    `Provedor "${id}" ainda não possui integração implementada. Use Focus NFe ou Mock.`,
  );
}
