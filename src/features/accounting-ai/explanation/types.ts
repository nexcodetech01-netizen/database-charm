/**
 * Bella Contadora — Explicações (Sprint 7.3): contratos.
 *
 * Esta camada NÃO calcula indicador algum. Ela apenas compara números que
 * já foram apurados pelos motores oficiais (Accounting, Sales, Finance,
 * Inventory, Fiscal) e os organiza no formato:
 *
 *   Resumo → 3 principais causas → dados que comprovam → recomendação
 *
 * Sem heurística financeira nova, sem estimativa, sem escrita.
 */
import type { AuditSnapshot } from "../audit/types";
import type { BellaTaxSnapshot } from "../tax/types";
import type {
  AccountingPeriod,
  AccountingSummary,
  TrendComparison,
} from "../types";

/** Assuntos que a Bella sabe explicar. */
export type ExplanationTopic =
  | "lucro"
  | "receita"
  | "margem"
  | "cmv"
  | "caixa"
  | "fluxo_caixa"
  | "despesas"
  | "ticket"
  | "clientes"
  | "estoque"
  | "impostos"
  | "prolabore";

export const EXPLANATION_TOPICS: readonly ExplanationTopic[] = [
  "lucro",
  "receita",
  "margem",
  "cmv",
  "caixa",
  "fluxo_caixa",
  "despesas",
  "ticket",
  "clientes",
  "estoque",
  "impostos",
  "prolabore",
];

export const EXPLANATION_TOPIC_LABELS: Record<ExplanationTopic, string> = {
  lucro: "Lucro",
  receita: "Receita",
  margem: "Margem",
  cmv: "CMV",
  caixa: "Caixa",
  fluxo_caixa: "Fluxo de caixa",
  despesas: "Despesas",
  ticket: "Ticket médio",
  clientes: "Clientes",
  estoque: "Estoque",
  impostos: "Impostos",
  prolabore: "Pró-labore",
};

/** Direção do movimento de uma causa. */
export type ExplanationDirection = "up" | "down" | "flat";

/** Unidade do impacto — evita comparar reais com percentuais. */
export type ExplanationUnit = "currency" | "percent" | "count";

/** Uma causa medida: sempre com número de origem oficial. */
export interface ExplanationCause {
  id: string;
  topic: ExplanationTopic;
  label: string;
  /** Diferença entre período atual e anterior (ou valor absoluto medido). */
  impact: number;
  /** Peso usado para ranquear — sempre |impact| normalizado pela unidade. */
  weight: number;
  unit: ExplanationUnit;
  direction: ExplanationDirection;
  /** Efeito sobre o indicador explicado. */
  effect: "positivo" | "negativo" | "neutro";
  detail: string;
  current: number;
  previous: number | null;
}

/** Dado bruto citado como prova. */
export interface ExplanationEvidence {
  label: string;
  value: string;
  source: string;
}

export interface Explanation {
  topic: ExplanationTopic;
  /** false ⇒ a Bella responde que não há dados suficientes. */
  available: boolean;
  headline: string;
  summary: string;
  causes: ExplanationCause[];
  biggestImpact: ExplanationCause | null;
  evidence: ExplanationEvidence[];
  recommendation: string | null;
  trend: TrendComparison | null;
  note?: string;
}

/** Números oficiais de um período — nenhum campo é derivado aqui. */
export interface ExplanationPeriodFacts {
  period: AccountingPeriod;
  grossRevenue: number;
  deductions: number;
  netRevenue: number;
  cogs: number;
  operatingExpenses: number;
  financialExpenses: number;
  otherExpenses: number;
  grossProfit: number;
  operatingResult: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  cogsRatio: number;
  expenseRatio: number;
  averageTicket: number;
  salesCount: number;
  paidTotal: number;
  customersActive: number;
  customersNew: number;
  customersRecurring: number;
}

/** Tudo que o builder pode ler. Nada além disso. */
export interface ExplanationDataset {
  period: AccountingPeriod;
  previousPeriod: AccountingPeriod | null;
  current: ExplanationPeriodFacts | null;
  previous: ExplanationPeriodFacts | null;
  summary: AccountingSummary | null;
  tax: BellaTaxSnapshot | null;
  audit: AuditSnapshot | null;
}

export interface ExplanationSnapshot {
  generatedAt: string;
  period: AccountingPeriod;
  previousPeriod: AccountingPeriod | null;
  dataset: ExplanationDataset;
  explanations: Record<ExplanationTopic, Explanation>;
  /** Impactos monetários do período, ordenados do maior para o menor. */
  ranking: ExplanationCause[];
}

/** Frase única e obrigatória quando não há evidência. */
export const NO_EVIDENCE =
  "Não encontrei dados suficientes para explicar essa variação.";
