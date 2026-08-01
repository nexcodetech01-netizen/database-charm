/**
 * Bella Contadora — Tributário (Sprint 7.1): contratos de leitura.
 *
 * NENHUMA regra tributária nasce aqui. Faixas, alíquotas, DAS, RBT12 e
 * projeções vêm exclusivamente do motor oficial (`@/features/tax`) através
 * da `FiscalPort`. Esta camada só transporta, formata e narra.
 */
import type {
  SimplesAnnex,
  SimplesComputation,
  TaxAlert,
  TaxApportionment,
  TaxRegime,
  TaxScenario,
} from "@/features/tax";
import type { AccountingInsight } from "../insights";
import type { BellaNotification } from "../proactive";

/** Origem do valor de DAS exibido pela Bella. */
export type BellaDasSource = "apuracao" | "simulacao";

/** Destinos de navegação do bloco tributário (somente rotas existentes). */
export type BellaTaxLinkId =
  | "abrir_tributario"
  | "ver_apuracoes"
  | "ver_projecoes"
  | "abrir_perfil_tributario"
  | "abrir_fiscal";

export interface BellaTaxLink {
  id: BellaTaxLinkId;
  label: string;
  href: string;
}

/** Ponto do histórico de apurações (valores exatamente como apurados). */
export interface BellaTaxHistoryPoint {
  competence: string;
  taxAmount: number;
  revenue: number;
  effectiveRate: number;
  bracket: number | null;
  status: string;
}

/** Retrato tributário consolidado da competência corrente. */
export interface BellaTaxSnapshot {
  competence: string;
  regime: TaxRegime | null;
  annex: SimplesAnnex | null;
  /** Receita bruta dos últimos 12 meses (RPC oficial). */
  rbt12: number;
  /** Receita da competência. */
  monthRevenue: number;
  bracket: number | null;
  nominalRate: number;
  deduction: number;
  effectiveRate: number;
  /** DAS apurado (quando há apuração) ou previsto pelo motor do Simples. */
  dasAmount: number;
  dasSource: BellaDasSource;
  dasStatus: string | null;
  dueDate: string | null;
  dueDay: number | null;
  /** Percentual do teto anual do Simples já utilizado. */
  limitUsagePct: number;
  /** Teto de RBT12 da faixa atual (null na última faixa). */
  bracketCeiling: number | null;
  /** Quanto ainda cabe na faixa atual (diferença entre limites do motor). */
  distanceToNextBracket: number | null;
  /** Alertas oficiais (`buildTaxAlerts`). */
  alerts: TaxAlert[];
  history: BellaTaxHistoryPoint[];
  /** Média dos DAS apurados no histórico — estatística de leitura. */
  averageTax: number | null;
}

/** Entrada de simulação aceita pela Bella (chat ou UI). */
export interface BellaTaxSimulationInput {
  /** Crescimento percentual sobre a receita da competência. */
  growthPct?: number | null;
  /** Faturamento alvo em reais para a competência. */
  targetRevenue?: number | null;
}

/** Cenário simulado, sempre produzido pelo motor oficial. */
export interface BellaTaxSimulationScenario {
  label: string;
  growthPct: number | null;
  revenue: number;
  taxAmount: number;
  effectiveRate: number;
  bracket: number | null;
}

export interface BellaTaxSimulation {
  competence: string;
  annex: SimplesAnnex | null;
  baseRevenue: number;
  baseTaxAmount: number;
  rbt12: number;
  scenarios: BellaTaxSimulationScenario[];
  /** Cenário destacado quando o usuário pediu um valor específico. */
  highlighted: BellaTaxSimulationScenario | null;
  /** Diferença de DAS entre o cenário destacado e a base. */
  taxDelta: number | null;
  /** Indica se o cenário destacado muda a faixa do Simples. */
  changesBracket: boolean;
}

/** Métrica exibida no bloco tributário do dashboard. */
export interface BellaTaxMetric {
  id: string;
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}

/** View model do bloco tributário. */
export interface BellaTaxView {
  available: boolean;
  note?: string;
  snapshot: BellaTaxSnapshot | null;
  headline: string;
  metrics: BellaTaxMetric[];
  alerts: TaxAlert[];
  insights: AccountingInsight[];
  notifications: BellaNotification[];
  links: BellaTaxLink[];
}

export type { SimplesAnnex, SimplesComputation, TaxApportionment, TaxScenario };
