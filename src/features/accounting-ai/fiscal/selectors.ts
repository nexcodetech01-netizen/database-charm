/**
 * Bella Contadora — Fiscal: seletores puros.
 *
 * Somente transformam dados já apurados em um view model. NADA é
 * recalculado: os documentos, status, artefatos, certificados e prontidão
 * vêm do Fiscal v2; saúde vem do `AccountingSummary`; alertas proativos vêm
 * do `Proactive`; recomendações vêm dos `Insights`.
 */
import { buildAccountingInsights, sortInsights, type AccountingInsight } from "../insights";
import {
  buildBellaNotifications,
  sortNotifications,
  type BellaNotification,
  type NotificationCategory,
} from "../proactive";
import { healthLabel } from "../lib/health";
import type { AccountingSummary } from "../types";
import { fiscalLink, fiscalLinkForAction, fiscalTimelineLink } from "./links";
import type {
  BellaFiscalAlert,
  BellaFiscalCertLike,
  BellaFiscalDetail,
  BellaFiscalDocLike,
  BellaFiscalHealth,
  BellaFiscalInput,
  BellaFiscalMetric,
  BellaFiscalOptions,
  BellaFiscalReadinessLike,
  BellaFiscalRecommendation,
  BellaFiscalStatus,
  BellaFiscalView,
} from "./types";

/** Categorias consideradas fiscais nos filtros do painel. */
export const FISCAL_CATEGORIES: NotificationCategory[] = ["fiscal"];

const FISCAL_CATEGORY_SET = new Set<string>(FISCAL_CATEGORIES);

export function isFiscalCategory(category: string): boolean {
  return FISCAL_CATEGORY_SET.has(category);
}

export function filterFiscalNotifications(
  notifications: readonly BellaNotification[],
): BellaNotification[] {
  return sortNotifications(notifications.filter((n) => isFiscalCategory(n.category)));
}

export function filterFiscalInsights(
  insights: readonly AccountingInsight[],
): AccountingInsight[] {
  return sortInsights(insights.filter((i) => isFiscalCategory(i.category)));
}

/** Status que ainda aguardam desfecho da SEFAZ (definição do Fiscal v2). */
export const PENDING_FISCAL_STATUSES: BellaFiscalStatus[] = [
  "draft",
  "validating",
  "signing",
  "sending",
  "cancelling",
];

const PENDING_SET = new Set<string>(PENDING_FISCAL_STATUSES);

export interface FiscalCounts {
  total: number;
  authorized: number;
  nfe: number;
  nfce: number;
  modelKnown: boolean;
  pending: number;
  rejected: number;
  cancelled: number;
  discarded: number;
  error: number;
  xmlMissing: number;
  danfeMissing: number;
  artifactsPending: number;
}

/** Contagens simples sobre os documentos já persistidos pelo Fiscal v2. */
export function countFiscalDocuments(
  documents: readonly BellaFiscalDocLike[] | null | undefined,
): FiscalCounts {
  const docs = documents ?? [];
  const counts: FiscalCounts = {
    total: docs.length,
    authorized: 0,
    nfe: 0,
    nfce: 0,
    modelKnown: false,
    pending: 0,
    rejected: 0,
    cancelled: 0,
    discarded: 0,
    error: 0,
    xmlMissing: 0,
    danfeMissing: 0,
    artifactsPending: 0,
  };

  for (const doc of docs) {
    if (doc.model === "55" || doc.model === "65") counts.modelKnown = true;
    if (doc.status === "authorized") {
      counts.authorized += 1;
      if (doc.model === "65") counts.nfce += 1;
      else if (doc.model === "55") counts.nfe += 1;
      if (!doc.xmlAuthorizedPath) counts.xmlMissing += 1;
      if (!doc.danfePath) counts.danfeMissing += 1;
    }
    if (PENDING_SET.has(doc.status)) counts.pending += 1;
    if (doc.status === "rejected") counts.rejected += 1;
    if (doc.status === "cancelled") counts.cancelled += 1;
    if (doc.status === "discarded") counts.discarded += 1;
    if (doc.status === "error") counts.error += 1;
    if ((doc.artifactsPending?.length ?? 0) > 0) counts.artifactsPending += 1;
  }

  return counts;
}

/** Tempo médio (minutos) entre criação e protocolo de autorização. */
export function averageAuthorizationMinutes(
  documents: readonly BellaFiscalDocLike[] | null | undefined,
): number | null {
  const samples: number[] = [];
  for (const doc of documents ?? []) {
    if (!doc.protocolAt || !doc.createdAt) continue;
    const started = Date.parse(doc.createdAt);
    const done = Date.parse(doc.protocolAt);
    if (!Number.isFinite(started) || !Number.isFinite(done) || done < started) continue;
    samples.push((done - started) / 60_000);
  }
  if (samples.length === 0) return null;
  const total = samples.reduce((acc, value) => acc + value, 0);
  return Math.round((total / samples.length) * 10) / 10;
}

function latest(
  documents: readonly BellaFiscalDocLike[] | null | undefined,
  field: (doc: BellaFiscalDocLike) => string | null | undefined,
): BellaFiscalDocLike | null {
  let best: BellaFiscalDocLike | null = null;
  let bestAt = -Infinity;
  for (const doc of documents ?? []) {
    const raw = field(doc);
    if (!raw) continue;
    const at = Date.parse(raw);
    if (!Number.isFinite(at) || at <= bestAt) continue;
    best = doc;
    bestAt = at;
  }
  return best;
}

/** Última emissão autorizada (documento + data). */
export function lastIssued(documents: readonly BellaFiscalDocLike[] | null | undefined) {
  return latest(
    (documents ?? []).filter((d) => d.status === "authorized"),
    (d) => d.protocolAt ?? d.createdAt,
  );
}

/** Último cancelamento confirmado. */
export function lastCancelled(documents: readonly BellaFiscalDocLike[] | null | undefined) {
  return latest(documents, (d) => d.cancelledAt);
}

/** Certificado ativo (o Fiscal v2 mantém apenas um por empresa). */
export function activeCertificate(
  certificates: readonly BellaFiscalCertLike[] | null | undefined,
): BellaFiscalCertLike | null {
  return (certificates ?? []).find((c) => c.isActive) ?? null;
}

export function certificateDaysLeft(
  certificate: BellaFiscalCertLike | null,
  now: string,
): number | null {
  if (!certificate?.validTo) return null;
  const expires = Date.parse(certificate.validTo);
  const ref = Date.parse(now);
  if (!Number.isFinite(expires) || !Number.isFinite(ref)) return null;
  return Math.round((expires - ref) / 86_400_000);
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Indicadores fiscais — contagens do Fiscal v2, sem novo cálculo tributário. */
export function buildFiscalMetrics(
  documents: readonly BellaFiscalDocLike[] | null | undefined,
): BellaFiscalMetric[] {
  const has = Boolean(documents);
  const c = countFiscalDocuments(documents);
  const avg = averageAuthorizationMinutes(documents);

  return [
    {
      id: "emitidas",
      label: "Emitidas",
      value: has ? c.authorized : null,
      available: has,
      format: "count",
      hint: "Documentos autorizados",
      link: fiscalLink("ver_notas"),
    },
    {
      id: "nfe",
      label: "NF-e (55)",
      value: has && c.modelKnown ? c.nfe : null,
      available: has && c.modelKnown,
      format: "count",
      link: fiscalLink("ver_notas"),
    },
    {
      id: "nfce",
      label: "NFC-e (65)",
      value: has && c.modelKnown ? c.nfce : null,
      available: has && c.modelKnown,
      format: "count",
      link: fiscalLink("ver_notas"),
    },
    {
      id: "pendentes",
      label: "Pendentes",
      value: has ? c.pending : null,
      available: has,
      format: "count",
      hint: "Aguardando desfecho da SEFAZ",
      link: fiscalLink("ver_pendentes"),
    },
    {
      id: "rejeitadas",
      label: "Rejeitadas",
      value: has ? c.rejected : null,
      available: has,
      format: "count",
      link: fiscalLink("ver_rejeitadas"),
    },
    {
      id: "canceladas",
      label: "Canceladas",
      value: has ? c.cancelled : null,
      available: has,
      format: "count",
      link: fiscalLink("ver_canceladas"),
    },
    {
      id: "descartadas",
      label: "Descartadas",
      value: has ? c.discarded : null,
      available: has,
      format: "count",
      link: fiscalLink("ver_notas"),
    },
    {
      id: "xml_pendentes",
      label: "XML pendentes",
      value: has ? c.xmlMissing : null,
      available: has,
      hint: "Autorizadas sem XML disponível",
      format: "count",
      link: fiscalLink("baixar_xml"),
    },
    {
      id: "danfe_pendentes",
      label: "DANFE pendentes",
      value: has ? c.danfeMissing : null,
      available: has,
      hint: "Autorizadas sem DANFE disponível",
      format: "count",
      link: fiscalLink("baixar_danfe"),
    },
    {
      id: "tempo_medio_autorizacao",
      label: "Tempo médio de autorização",
      value: avg,
      available: avg !== null,
      format: "minutes",
      hint: "Da criação ao protocolo",
      link: fiscalLink("ver_timeline"),
    },
  ];
}

/** Detalhes fiscais (última emissão, cancelamento, ambiente, certificado). */
export function buildFiscalDetails(
  documents: readonly BellaFiscalDocLike[] | null | undefined,
  certificates: readonly BellaFiscalCertLike[] | null | undefined,
  readiness: BellaFiscalReadinessLike | null | undefined,
  now: string,
): BellaFiscalDetail[] {
  const issued = lastIssued(documents);
  const cancelled = lastCancelled(documents);
  const cert = activeCertificate(certificates);
  const days = certificateDaysLeft(cert, now);
  const issuedAt = formatDate(issued?.protocolAt ?? issued?.createdAt ?? null);
  const cancelledAt = formatDate(cancelled?.cancelledAt ?? null);

  return [
    {
      id: "ultima_emissao",
      label: "Última emissão",
      value: issuedAt,
      available: Boolean(issuedAt),
      hint: issued?.number ? `Nº ${issued.number}` : undefined,
      link: fiscalTimelineLink(issued?.id ?? null),
    },
    {
      id: "ultimo_cancelamento",
      label: "Último cancelamento",
      value: cancelledAt,
      available: Boolean(cancelledAt),
      hint: cancelled?.number ? `Nº ${cancelled.number}` : undefined,
      link: fiscalTimelineLink(cancelled?.id ?? null),
    },
    {
      id: "ambiente",
      label: "Ambiente",
      value: readiness
        ? readiness.environment === "production"
          ? "Produção"
          : "Homologação"
        : null,
      available: Boolean(readiness),
      link: fiscalLink("abrir_configuracao"),
    },
    {
      id: "certificado",
      label: "Certificado A1",
      value: cert ? (formatDate(cert.validTo) ?? "Sem validade informada") : null,
      available: Boolean(cert),
      hint: days !== null ? `${days} dia(s) restante(s)` : undefined,
      link: fiscalLink("abrir_certificado"),
    },
    {
      id: "prontidao",
      label: "Prontidão fiscal",
      value: readiness ? `${readiness.percent}%` : null,
      available: Boolean(readiness),
      hint: readiness
        ? `${readiness.blockers} bloqueio(s) · ${readiness.warnings} aviso(s)`
        : undefined,
      link: fiscalLink("abrir_configuracao"),
    },
  ];
}

/**
 * Alertas fiscais — derivados de estados que o Fiscal v2 já registrou,
 * somados às notificações proativas de categoria fiscal.
 */
export function buildFiscalAlerts(
  input: BellaFiscalInput,
  options: BellaFiscalOptions = {},
): BellaFiscalAlert[] {
  const now = options.now ?? new Date().toISOString();
  const warnDays = options.certificateWarningDays ?? 30;
  const alerts: BellaFiscalAlert[] = [];
  const docs = input.documents ?? null;
  const counts = countFiscalDocuments(docs);
  const cert = activeCertificate(input.certificates);
  const days = certificateDaysLeft(cert, now);

  if (input.certificates && !cert) {
    alerts.push({
      id: "certificado_ausente",
      severity: "critical",
      title: "Certificado digital ausente",
      message: "Nenhum certificado A1 ativo foi encontrado para a empresa.",
      recommendation: "Cadastre o certificado A1 na configuração fiscal.",
      source: "fiscal",
      link: fiscalLink("abrir_certificado"),
    });
  } else if (days !== null && days < 0) {
    alerts.push({
      id: "certificado_vencido",
      severity: "critical",
      title: "Certificado digital vencido",
      message: `O certificado A1 venceu há ${Math.abs(days)} dia(s).`,
      recommendation: "Renove o certificado para voltar a emitir.",
      source: "fiscal",
      link: fiscalLink("abrir_certificado"),
    });
  } else if (days !== null && days <= warnDays) {
    alerts.push({
      id: "certificado_vencendo",
      severity: "warning",
      title: "Certificado próximo do vencimento",
      message: `O certificado A1 vence em ${days} dia(s).`,
      recommendation: "Providencie a renovação antes do vencimento.",
      source: "fiscal",
      link: fiscalLink("abrir_certificado"),
    });
  }

  if (counts.rejected >= 3 && counts.total > 0 && counts.rejected / counts.total >= 0.2) {
    alerts.push({
      id: "muitas_rejeicoes",
      severity: "warning",
      title: "Muitas rejeições",
      message: `${counts.rejected} de ${counts.total} documentos foram rejeitados.`,
      recommendation: "Revise os motivos de rejeição e os dados fiscais dos produtos.",
      source: "fiscal",
      link: fiscalLink("ver_rejeitadas"),
    });
  }

  if (counts.xmlMissing > 0) {
    alerts.push({
      id: "xml_ausente",
      severity: "warning",
      title: "XML ausente",
      message: `${counts.xmlMissing} nota(s) autorizada(s) sem XML disponível.`,
      recommendation: "Abra a nota e verifique o download do XML.",
      source: "fiscal",
      link: fiscalLink("baixar_xml"),
    });
  }

  if (counts.danfeMissing > 0) {
    alerts.push({
      id: "danfe_ausente",
      severity: "warning",
      title: "DANFE ausente",
      message: `${counts.danfeMissing} nota(s) autorizada(s) sem DANFE disponível.`,
      recommendation: "Abra a nota e verifique o download do DANFE.",
      source: "fiscal",
      link: fiscalLink("baixar_danfe"),
    });
  }

  if (input.readiness?.environment === "homologation") {
    alerts.push({
      id: "nfce_homologacao",
      severity: "info",
      title: "NFC-e ainda não homologada",
      message: "O ambiente fiscal está em homologação: as notas não têm validade fiscal.",
      recommendation: "Conclua a homologação e mude para produção quando validado.",
      source: "fiscal",
      link: fiscalLink("abrir_configuracao"),
    });
  }

  if (counts.pending > 0) {
    alerts.push({
      id: "aguardando_processamento",
      severity: "info",
      title: "Notas aguardando processamento",
      message: `${counts.pending} documento(s) aguardando desfecho da SEFAZ.`,
      recommendation: "Acompanhe a linha do tempo até a autorização.",
      source: "fiscal",
      link: fiscalLink("ver_pendentes"),
    });
  }

  if (counts.discarded > 0) {
    alerts.push({
      id: "notas_descartadas",
      severity: "info",
      title: "Notas descartadas",
      message: `${counts.discarded} documento(s) descartado(s) no histórico.`,
      recommendation: "Confira se a venda correspondente foi reemitida.",
      source: "fiscal",
      link: fiscalLink("ver_notas"),
    });
  }

  if (counts.error > 0) {
    alerts.push({
      id: "falhas_recentes",
      severity: "critical",
      title: "Falhas recentes na emissão",
      message: `${counts.error} documento(s) em estado de erro.`,
      recommendation: "Revise o motivo da falha e reemita quando corrigido.",
      source: "fiscal",
      link: fiscalLink("ver_notas"),
    });
  }

  if (input.readiness && input.readiness.blockers > 0) {
    alerts.push({
      id: "configuracao_incompleta",
      severity: "critical",
      title: "Configuração fiscal incompleta",
      message: `${input.readiness.blockers} item(ns) bloqueando a emissão.`,
      recommendation: "Conclua a configuração fiscal para emitir com segurança.",
      source: "fiscal",
      link: fiscalLink("abrir_configuracao"),
    });
  }

  const proactive = filterFiscalNotifications(input.notifications ?? []).map<BellaFiscalAlert>(
    (n) => ({
      id: n.id,
      severity: n.severity === "critical" ? "critical" : n.severity === "warning" ? "warning" : "info",
      title: n.title,
      message: n.message,
      recommendation: n.recommendation,
      source: "proactive",
      link: fiscalLinkForAction(n.action.id),
    }),
  );

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return [...alerts, ...proactive]
    .sort((a, b) => order[a.severity] - order[b.severity])
    .slice(0, Math.max(0, options.alertLimit ?? 6));
}

export function buildFiscalRecommendations(
  insights: readonly AccountingInsight[],
  limit = 5,
): BellaFiscalRecommendation[] {
  return filterFiscalInsights(insights)
    .slice(0, Math.max(0, limit))
    .map((insight) => ({
      id: insight.id,
      title: insight.title,
      description: insight.description,
      recommendation: insight.recommendation,
      severity: insight.severity,
      category: insight.category,
      priority: insight.priority,
      link: fiscalLinkForAction(insight.action.id),
    }));
}

export function buildFiscalHealth(
  summary: AccountingSummary | null | undefined,
): BellaFiscalHealth | null {
  const health = summary?.health.available ? summary.health.data : null;
  if (!health) return null;
  return {
    level: health.level,
    score: health.score,
    label: healthLabel(health),
    reasons: health.warnings ?? [],
  };
}

/** View model completo do painel "Bella Fiscal". */
export function buildBellaFiscalView(
  input: BellaFiscalInput,
  options: BellaFiscalOptions = {},
): BellaFiscalView {
  const now = options.now ?? new Date().toISOString();
  const summary = input.summary ?? null;
  const generatedAt = options.now ?? summary?.generatedAt ?? now;
  const hasDocuments = Boolean(input.documents);

  const insights = input.insights ?? (summary ? buildAccountingInsights(summary) : []);
  const notifications =
    input.notifications ?? (summary ? buildBellaNotifications({ summary, insights }) : []);

  const missing: string[] = [];
  if (!hasDocuments) missing.push("documentos fiscais");
  if (!summary) missing.push("resumo contábil");
  if (!input.readiness) missing.push("configuração fiscal");

  return {
    available: hasDocuments || Boolean(summary) || Boolean(input.readiness),
    generatedAt,
    metrics: buildFiscalMetrics(input.documents),
    details: buildFiscalDetails(input.documents, input.certificates, input.readiness, now),
    health: buildFiscalHealth(summary),
    alerts: buildFiscalAlerts({ ...input, insights, notifications }, { ...options, now }),
    recommendations: buildFiscalRecommendations(insights, options.recommendationLimit ?? 5),
    missing,
  };
}
