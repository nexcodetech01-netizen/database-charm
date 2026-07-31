/**
 * Sprint 008.1 — Motor puro de cálculo de saúde fiscal.
 * Sem I/O: recebe faturamento e regras, devolve status/projeção/insights.
 */
import { getRegimeStrategy, type TaxRegime, type TaxRegimeStrategy } from "../strategies/tax-regime-strategy";

export type HealthStatus = "green" | "yellow" | "orange" | "red" | "unknown";

export interface FiscalHealthInput {
  regime: TaxRegime;
  /** Limite anual efetivo (override do usuário ou default da estratégia). */
  annualLimit: number | null;
  /** Faturamento acumulado no exercício. */
  ytdRevenue: number;
  /** Meses já decorridos no exercício (1..12). */
  monthsElapsed: number;
  /** Faturamento mensal em ordem cronológica (primeiro mês do exercício -> atual). */
  monthlySeries: Array<{ month: string; revenue: number }>;
  /** Percentuais de alerta configurados (ordenados asc). */
  alertThresholds: number[];
  /** Nome do mês final do exercício (para mensagens humanas), ex.: "dezembro". */
  fiscalYearEndLabel?: string;
}

export interface FiscalHealthResult {
  regime: TaxRegime;
  regimeLabel: string;
  hasAnnualLimit: boolean;
  annualLimit: number | null;
  ytdRevenue: number;
  remaining: number | null;
  percentUsed: number | null;
  monthsElapsed: number;
  monthlyAverage: number;
  projectionYearEnd: number;
  status: HealthStatus;
  advisorMessages: string[];
  /** Mês humano em que o limite seria atingido no ritmo atual, se aplicável. */
  projectedBreachMonthLabel: string | null;
}

const MONTH_LABELS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function statusFor(percentUsed: number | null, thresholds: number[]): HealthStatus {
  if (percentUsed == null || !Number.isFinite(percentUsed)) return "unknown";
  const sorted = [...thresholds].sort((a, b) => a - b);
  const p = percentUsed;
  // Escala fixa: verde < menor_threshold, amarelo, laranja, vermelho >= último threshold antes de 100.
  // Simplificação: mapear 4 níveis a partir da lista.
  if (p >= 100) return "red";
  if (sorted.length >= 3) {
    const [t1, t2, t3] = [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted[sorted.length - 1]];
    if (p >= t3) return "red";
    if (p >= t2) return "orange";
    if (p >= t1) return "yellow";
    return "green";
  }
  if (sorted.length === 2) {
    if (p >= sorted[1]) return "orange";
    if (p >= sorted[0]) return "yellow";
    return "green";
  }
  if (sorted.length === 1) {
    return p >= sorted[0] ? "yellow" : "green";
  }
  return "green";
}

/**
 * FiscalProjectionEngine — projeção linear pela média mensal.
 * Se houver série mensal, usa a média dela; senão, extrapola do YTD.
 */
export function projectYearEnd(input: {
  ytdRevenue: number;
  monthsElapsed: number;
  monthlySeries: Array<{ revenue: number }>;
}): { projectionYearEnd: number; monthlyAverage: number } {
  const months = Math.max(1, input.monthsElapsed);
  const seriesAvg = input.monthlySeries.length > 0
    ? input.monthlySeries.reduce((s, r) => s + r.revenue, 0) / input.monthlySeries.length
    : input.ytdRevenue / months;
  const monthlyAverage = seriesAvg > 0 ? seriesAvg : input.ytdRevenue / months;
  const projectionYearEnd = input.ytdRevenue + monthlyAverage * (12 - months);
  return { projectionYearEnd, monthlyAverage };
}

/** Retorna nome do mês (pt-BR) em que a projeção linear atinge o limite. */
export function projectBreachMonth(
  ytdRevenue: number,
  monthlyAverage: number,
  monthsElapsed: number,
  annualLimit: number | null,
  fiscalYearStartMonth: number = 1,
): string | null {
  if (!annualLimit || monthlyAverage <= 0) return null;
  const remaining = annualLimit - ytdRevenue;
  if (remaining <= 0) return null;
  const monthsToBreach = Math.ceil(remaining / monthlyAverage);
  const targetIndex = monthsElapsed + monthsToBreach - 1; // 0-based offset dentro do exercício
  if (targetIndex >= 12) return null;
  const calendarMonth = ((fiscalYearStartMonth - 1) + targetIndex) % 12;
  return MONTH_LABELS_PT[calendarMonth];
}

/**
 * FiscalHealthService — orquestra strategy + projection + status + advisor.
 */
export function computeFiscalHealth(input: FiscalHealthInput): FiscalHealthResult {
  const strategy: TaxRegimeStrategy = getRegimeStrategy(input.regime);
  const annualLimit = input.annualLimit ?? strategy.defaultAnnualLimit;
  const percentUsed = annualLimit && annualLimit > 0
    ? (input.ytdRevenue / annualLimit) * 100
    : null;
  const remaining = annualLimit != null ? Math.max(0, annualLimit - input.ytdRevenue) : null;
  const { projectionYearEnd, monthlyAverage } = projectYearEnd({
    ytdRevenue: input.ytdRevenue,
    monthsElapsed: input.monthsElapsed,
    monthlySeries: input.monthlySeries,
  });
  const projectedBreachMonthLabel = projectBreachMonth(
    input.ytdRevenue,
    monthlyAverage,
    input.monthsElapsed,
    annualLimit,
  );

  const status = statusFor(percentUsed, input.alertThresholds);
  const advisorMessages: string[] = [];
  if (percentUsed != null) {
    const msg = strategy.buildAdvisorMessage(percentUsed, remaining ?? 0, projectedBreachMonthLabel);
    if (msg) advisorMessages.push(msg);
    if (annualLimit && input.ytdRevenue > 0) {
      advisorMessages.push(
        `Faturamento acumulado: R$ ${input.ytdRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${percentUsed.toFixed(1)}% do limite).`,
      );
      if (remaining != null && remaining > 0) {
        advisorMessages.push(
          `Restam R$ ${remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} para o teto anual.`,
        );
      }
    }
  } else if (input.ytdRevenue > 0) {
    advisorMessages.push(
      `Faturamento acumulado no exercício: R$ ${input.ytdRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Sem teto configurado para o regime.`,
    );
  }
  if (monthlyAverage > 0) {
    advisorMessages.push(
      `Média mensal: R$ ${monthlyAverage.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Projeção anual: R$ ${projectionYearEnd.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
    );
  }

  return {
    regime: input.regime,
    regimeLabel: strategy.label,
    hasAnnualLimit: strategy.hasAnnualLimit,
    annualLimit,
    ytdRevenue: input.ytdRevenue,
    remaining,
    percentUsed,
    monthsElapsed: input.monthsElapsed,
    monthlyAverage,
    projectionYearEnd,
    status,
    advisorMessages,
    projectedBreachMonthLabel,
  };
}
