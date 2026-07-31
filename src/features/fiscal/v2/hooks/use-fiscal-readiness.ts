/**
 * Fiscal v2 — Hook de prontidão para emitir NF-e (Sprint 007.3).
 *
 * Agrega sinais de company profile, certificado, provider config e
 * settings em uma única pontuação ponderada. Consumido por
 * `FiscalReadinessCard` (dashboard) e reutilizável pelo diagnóstico.
 */
import { useMemo } from "react";

import {
  useCompanyFiscalProfile,
  useFiscalCertificates,
  useFiscalProviderConfig,
  useFiscalSettings,
} from "./use-fiscal";

export type ReadinessStatus = "ok" | "warn" | "error";

export interface ReadinessCheck {
  id: string;
  label: string;
  detail: string;
  status: ReadinessStatus;
  weight: number;
  step?: "empresa" | "certificado" | "provedor" | "regras" | "testes";
}

export interface ReadinessSummary {
  percent: number;
  status: ReadinessStatus;
  blockers: number;
  warnings: number;
  ok: number;
  total: number;
  checks: ReadinessCheck[];
  isLoading: boolean;
  ready: boolean;
  environment: "homologation" | "production";
  /** true quando o ambiente veio das settings persistidas (não do fallback). */
  environmentResolved: boolean;
}

const WEIGHTS = {
  company: 15,
  certificate: 25,
  certificateExpiring: 10,
  provider: 15,
  apiKey: 10,
  environment: 5,
  series: 5,
  defaults: 10,
  taxRegime: 5,
  csosn: 5,
  cnae: 5,
  health: 15,
};

export function useFiscalReadiness(): ReadinessSummary {
  const company = useCompanyFiscalProfile();
  const settings = useFiscalSettings();
  const certs = useFiscalCertificates();
  const provider = useFiscalProviderConfig();

  // Semântica anti-loop: só bloqueia enquanto NENHUM dado chegou ainda.
  // Se uma query remontar em estado pending após já ter respondido antes,
  // o hook degrada para renderização parcial em vez de spinner infinito.
  const anyData =
    company.data !== undefined ||
    settings.data !== undefined ||
    certs.data !== undefined ||
    provider.data !== undefined;
  const allPending =
    company.isPending && settings.isPending && certs.isPending && provider.isPending;
  const isLoading = !anyData && allPending;

  return useMemo<ReadinessSummary>(() => {
    const c = company.data;
    const s = settings.data;
    const p = provider.data;
    const activeCert = certs.data?.find((cert) => cert.isActive) ?? null;
    const certExpiresAt = activeCert?.validTo ? new Date(activeCert.validTo) : null;
    const daysLeft = certExpiresAt
      ? Math.round((certExpiresAt.getTime() - Date.now()) / 86_400_000)
      : null;
    const providerId = p?.providerId ?? "mock";
    const environment = (s?.defaultEnvironment ?? p?.environment ?? "homologation") as
      | "homologation"
      | "production";

    const checks: ReadinessCheck[] = [
      {
        id: "company",
        label: "Dados da empresa",
        step: "empresa",
        weight: WEIGHTS.company,
        detail:
          c?.cnpj && c.ie && c.address && c.city && c.state && c.zipcode
            ? `${c.legalName ?? "—"} · CNPJ ${c.cnpj}`
            : "CNPJ, IE ou endereço fiscal ausentes.",
        status: c?.cnpj && c.ie && c.address && c.city && c.state && c.zipcode ? "ok" : "error",
      },
      {
        id: "cert",
        label: "Certificado A1",
        step: "certificado",
        weight: WEIGHTS.certificate,
        detail: activeCert
          ? certExpiresAt
            ? `${activeCert.alias} · vence em ${daysLeft}d`
            : activeCert.alias
          : "Nenhum certificado A1 ativo.",
        status: !activeCert ? "error" : daysLeft != null && daysLeft < 0 ? "error" : "ok",
      },
      {
        id: "cert-expiring",
        label: "Validade do certificado",
        step: "certificado",
        weight: WEIGHTS.certificateExpiring,
        detail:
          daysLeft == null
            ? "Certificado sem data de validade."
            : daysLeft < 0
              ? "Certificado vencido."
              : daysLeft < 30
                ? `Vence em ${daysLeft} dia(s). Renove o quanto antes.`
                : `Válido por mais ${daysLeft} dia(s).`,
        status: daysLeft == null || daysLeft < 0 ? "error" : daysLeft < 30 ? "warn" : "ok",
      },
      {
        id: "provider",
        label: "Provedor fiscal",
        step: "provedor",
        weight: WEIGHTS.provider,
        detail:
          providerId === "mock"
            ? "Provedor em Mock — troque para TecnoSpeed/Focus/PlugNotas."
            : `${providerId} configurado`,
        status: providerId === "mock" ? "warn" : "ok",
      },
      {
        id: "api-key",
        label: "API key do provedor",
        step: "provedor",
        weight: WEIGHTS.apiKey,
        detail:
          providerId === "mock"
            ? "Não requerido para Mock."
            : p?.hasApiKey
              ? "API key armazenada com segurança."
              : "API key não configurada.",
        status: providerId === "mock" ? "warn" : p?.hasApiKey ? "ok" : "error",
      },
      {
        id: "environment",
        label: "Ambiente atual",
        step: "regras",
        weight: WEIGHTS.environment,
        detail:
          environment === "production"
            ? "Produção — NF-es com validade fiscal."
            : "Homologação — NF-es apenas para testes.",
        status: "ok",
      },
      {
        id: "series",
        label: "Série e numeração",
        step: "regras",
        weight: WEIGHTS.series,
        detail: s
          ? `Série ${s.nfeSeries} · próxima nº ${s.nfeNextNumber}`
          : "Série/numeração não configurada.",
        status: s && s.nfeSeries >= 1 && s.nfeNextNumber >= 1 ? "ok" : "error",
      },
      {
        id: "defaults",
        label: "CFOP e natureza da operação",
        step: "regras",
        weight: WEIGHTS.defaults,
        detail: s
          ? `CFOP ${s.defaultCfop}${s.operationNature ? ` · ${s.operationNature}` : ""}`
          : "Defaults fiscais não configurados.",
        status: s && s.defaultCfop && s.operationNature ? "ok" : "error",
      },
      {
        id: "tax-regime",
        label: "Regime tributário (CRT)",
        step: "regras",
        weight: WEIGHTS.taxRegime,
        detail: s?.taxRegime
          ? `${labelTaxRegime(s.taxRegime)}${s.crt ? ` · CRT ${s.crt}` : ""}`
          : "Regime tributário não definido.",
        status: s?.taxRegime && s?.crt ? "ok" : s?.taxRegime ? "warn" : "error",
      },
      {
        id: "csosn",
        label: "CSOSN/CST padrão",
        step: "regras",
        weight: WEIGHTS.csosn,
        detail:
          s?.taxRegime === "simples"
            ? s.defaultCsosn
              ? `CSOSN ${s.defaultCsosn}`
              : "Simples Nacional exige CSOSN default."
            : s?.defaultCsosn
              ? `CST ${s.defaultCsosn}`
              : "CST default recomendado.",
        status:
          s?.taxRegime === "simples"
            ? s.defaultCsosn
              ? "ok"
              : "error"
            : s?.defaultCsosn
              ? "ok"
              : "warn",
      },
      {
        id: "cnae",
        label: "CNAE principal",
        step: "empresa",
        weight: WEIGHTS.cnae,
        detail: s?.cnaePrincipal
          ? `CNAE ${s.cnaePrincipal}`
          : "CNAE principal não informado (obrigatório em algumas UFs).",
        status: s?.cnaePrincipal ? "ok" : "warn",
      },
      {
        id: "health",
        label: "Health check do provedor",
        step: "testes",
        weight: WEIGHTS.health,
        detail:
          p?.lastHealthMessage ??
          (providerId === "mock" ? "Não requerido para Mock." : "Nenhum teste executado ainda."),
        status:
          providerId === "mock"
            ? "warn"
            : p?.lastHealthStatus === "ok"
              ? "ok"
              : p?.lastHealthStatus === "warning"
                ? "warn"
                : p?.lastHealthStatus === "error"
                  ? "error"
                  : "warn",
      },
    ];

    const totalWeight = checks.reduce((acc, c) => acc + c.weight, 0);
    const scored = checks.reduce((acc, c) => {
      const factor = c.status === "ok" ? 1 : c.status === "warn" ? 0.5 : 0;
      return acc + c.weight * factor;
    }, 0);
    const percent = totalWeight === 0 ? 0 : Math.round((scored / totalWeight) * 100);
    const blockers = checks.filter((c) => c.status === "error").length;
    const warnings = checks.filter((c) => c.status === "warn").length;
    const ok = checks.filter((c) => c.status === "ok").length;
    const status: ReadinessStatus = blockers > 0 ? "error" : warnings > 0 ? "warn" : "ok";

    return {
      percent,
      status,
      blockers,
      warnings,
      ok,
      total: checks.length,
      checks,
      isLoading,
      ready: blockers === 0 && percent >= 90,
      environment,
      environmentResolved: s !== undefined || p !== undefined,
    };
  }, [company.data, settings.data, certs.data, provider.data, isLoading]);
}

function labelTaxRegime(r: string): string {
  switch (r) {
    case "simples":
      return "Simples Nacional";
    case "presumido":
      return "Lucro Presumido";
    case "real":
      return "Lucro Real";
    case "mei":
      return "MEI";
    default:
      return r;
  }
}
