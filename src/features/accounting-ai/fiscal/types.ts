/**
 * Bella Contadora — Fiscal (Sprint 6.2): contratos da Bella dentro do Fiscal.
 *
 * Camada 100% de leitura/apresentação. NENHUMA regra fiscal é criada aqui:
 * documentos, status, artefatos, certificados e prontidão vêm do módulo
 * Fiscal v2 já existente; saúde, alertas e recomendações vêm de
 * `providers`, `insights` e `proactive`. Nenhum imposto é recalculado e
 * nenhum botão executa ação — apenas navegação.
 */
import type { AccountingInsight, InsightActionId } from "../insights";
import type { BellaNotification, NotificationActionId } from "../proactive";
import type { AccountingSummary, HealthLevel } from "../types";

/** Destinos de navegação permitidos no painel fiscal da Bella. */
export type BellaFiscalLinkId =
  | "abrir_fiscal"
  | "ver_notas"
  | "ver_rejeitadas"
  | "ver_pendentes"
  | "ver_canceladas"
  | "baixar_xml"
  | "baixar_danfe"
  | "ver_timeline"
  | "abrir_configuracao"
  | "abrir_certificado";

export interface BellaFiscalLink {
  id: BellaFiscalLinkId;
  label: string;
  /** Rota já existente do NexOS (somente navegação). */
  href: string;
}

/** Status de documento fiscal, exatamente como o Fiscal v2 os define. */
export type BellaFiscalStatus =
  | "draft"
  | "validating"
  | "signing"
  | "sending"
  | "authorized"
  | "rejected"
  | "cancelling"
  | "cancelled"
  | "error"
  | "discarded";

/** Documento fiscal lido do Fiscal v2 (subconjunto estrutural do DTO). */
export interface BellaFiscalDocLike {
  id: string;
  status: BellaFiscalStatus;
  /** 55 = NF-e · 65 = NFC-e. Ausente quando o Fiscal v2 não informa. */
  model?: "55" | "65" | null;
  number?: number | null;
  environment?: "homologation" | "production";
  xmlAuthorizedPath?: string | null;
  danfePath?: string | null;
  protocolAt?: string | null;
  cancelledAt?: string | null;
  discardedAt?: string | null;
  rejectionReason?: string | null;
  artifactsPending?: readonly string[];
  createdAt: string;
}

/** Certificado A1 lido do Fiscal v2 (subconjunto estrutural). */
export interface BellaFiscalCertLike {
  id: string;
  alias?: string;
  validTo?: string | null;
  isActive: boolean;
}

/** Prontidão fiscal já apurada pelo hook `useFiscalReadiness`. */
export interface BellaFiscalReadinessLike {
  percent: number;
  blockers: number;
  warnings: number;
  ready: boolean;
  environment: "homologation" | "production";
}

export type BellaFiscalMetricId =
  | "emitidas"
  | "nfe"
  | "nfce"
  | "pendentes"
  | "rejeitadas"
  | "canceladas"
  | "descartadas"
  | "xml_pendentes"
  | "danfe_pendentes"
  | "tempo_medio_autorizacao";

export interface BellaFiscalMetric {
  id: BellaFiscalMetricId;
  label: string;
  value: number | null;
  available: boolean;
  /** `count` = quantidade · `minutes` = tempo médio em minutos. */
  format: "count" | "minutes";
  hint?: string;
  link: BellaFiscalLink;
}

export type BellaFiscalDetailId =
  | "ultima_emissao"
  | "ultimo_cancelamento"
  | "ambiente"
  | "certificado"
  | "prontidao";

export interface BellaFiscalDetail {
  id: BellaFiscalDetailId;
  label: string;
  value: string | null;
  available: boolean;
  hint?: string;
  link: BellaFiscalLink;
}

export type BellaFiscalAlertId =
  | "certificado_vencendo"
  | "certificado_vencido"
  | "certificado_ausente"
  | "muitas_rejeicoes"
  | "xml_ausente"
  | "danfe_ausente"
  | "nfce_homologacao"
  | "aguardando_processamento"
  | "notas_descartadas"
  | "falhas_recentes"
  | "configuracao_incompleta";

export type BellaFiscalSeverity = "critical" | "warning" | "info";

export interface BellaFiscalAlert {
  id: string;
  severity: BellaFiscalSeverity;
  title: string;
  message: string;
  recommendation: string;
  /** `fiscal` = derivado do Fiscal v2 · `proactive` = notificação da Bella. */
  source: "fiscal" | "proactive";
  link: BellaFiscalLink;
}

export interface BellaFiscalRecommendation {
  id: string;
  title: string;
  description: string;
  recommendation: string;
  severity: AccountingInsight["severity"];
  category: AccountingInsight["category"];
  priority: number;
  link: BellaFiscalLink;
}

export interface BellaFiscalHealth {
  level: HealthLevel;
  score: number;
  label: string;
  reasons: string[];
}

export interface BellaFiscalView {
  available: boolean;
  generatedAt: string;
  metrics: BellaFiscalMetric[];
  details: BellaFiscalDetail[];
  health: BellaFiscalHealth | null;
  alerts: BellaFiscalAlert[];
  recommendations: BellaFiscalRecommendation[];
  missing: string[];
}

export interface BellaFiscalInput {
  documents?: readonly BellaFiscalDocLike[] | null;
  certificates?: readonly BellaFiscalCertLike[] | null;
  readiness?: BellaFiscalReadinessLike | null;
  summary?: AccountingSummary | null;
  insights?: readonly AccountingInsight[];
  notifications?: readonly BellaNotification[];
}

export interface BellaFiscalOptions {
  alertLimit?: number;
  recommendationLimit?: number;
  /** Referência temporal determinística (testes). */
  now?: string;
  /** Janela (dias) para alerta de certificado vencendo. Padrão 30. */
  certificateWarningDays?: number;
}

export type BellaFiscalActionId = NotificationActionId | InsightActionId;
