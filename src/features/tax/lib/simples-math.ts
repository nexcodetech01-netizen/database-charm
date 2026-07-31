/**
 * Motor Tributário — matemática pura do Simples Nacional.
 *
 * Espelha exatamente as regras aplicadas no banco (`simples_compute`),
 * permitindo simulação/validação no cliente sem I/O. As faixas são a
 * tabela oficial da LC 123/2006 (Anexos I a V), a mesma carregada em
 * `public.simples_brackets`.
 */

import type {
  ApportionmentStatus,
  SimplesAnnex,
  SimplesBracket,
  SimplesComputation,
  TaxAlert,
  TaxApportionment,
} from "../types";

export const SIMPLES_LIMIT = 4_800_000;

export function round2(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

export function round4(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 10_000) / 10_000;
}

const b = (
  annex: SimplesAnnex,
  bracket: number,
  rbt12From: number,
  rbt12To: number | null,
  nominalRate: number,
  deduction: number,
): SimplesBracket => ({ annex, bracket, rbt12From, rbt12To, nominalRate, deduction });

/** Tabela oficial — idêntica à seed de `public.simples_brackets`. */
export const SIMPLES_BRACKETS: SimplesBracket[] = [
  b("I", 1, 0, 180_000, 4.0, 0),
  b("I", 2, 180_000.01, 360_000, 7.3, 5_940),
  b("I", 3, 360_000.01, 720_000, 9.5, 13_860),
  b("I", 4, 720_000.01, 1_800_000, 10.7, 22_500),
  b("I", 5, 1_800_000.01, 3_600_000, 14.3, 87_300),
  b("I", 6, 3_600_000.01, 4_800_000, 19.0, 378_000),

  b("II", 1, 0, 180_000, 4.5, 0),
  b("II", 2, 180_000.01, 360_000, 7.8, 5_940),
  b("II", 3, 360_000.01, 720_000, 10.0, 13_860),
  b("II", 4, 720_000.01, 1_800_000, 11.2, 22_500),
  b("II", 5, 1_800_000.01, 3_600_000, 14.7, 85_500),
  b("II", 6, 3_600_000.01, 4_800_000, 30.0, 720_000),

  b("III", 1, 0, 180_000, 6.0, 0),
  b("III", 2, 180_000.01, 360_000, 11.2, 9_360),
  b("III", 3, 360_000.01, 720_000, 13.5, 17_640),
  b("III", 4, 720_000.01, 1_800_000, 16.0, 35_640),
  b("III", 5, 1_800_000.01, 3_600_000, 21.0, 125_640),
  b("III", 6, 3_600_000.01, 4_800_000, 33.0, 648_000),

  b("IV", 1, 0, 180_000, 4.5, 0),
  b("IV", 2, 180_000.01, 360_000, 9.0, 8_100),
  b("IV", 3, 360_000.01, 720_000, 10.2, 12_420),
  b("IV", 4, 720_000.01, 1_800_000, 14.0, 39_780),
  b("IV", 5, 1_800_000.01, 3_600_000, 22.0, 183_780),
  b("IV", 6, 3_600_000.01, 4_800_000, 33.0, 828_000),

  b("V", 1, 0, 180_000, 15.5, 0),
  b("V", 2, 180_000.01, 360_000, 18.0, 4_500),
  b("V", 3, 360_000.01, 720_000, 19.5, 9_900),
  b("V", 4, 720_000.01, 1_800_000, 20.5, 17_100),
  b("V", 5, 1_800_000.01, 3_600_000, 23.0, 62_100),
  b("V", 6, 3_600_000.01, 4_800_000, 30.5, 540_000),
];

export const SIMPLES_ANNEXES: SimplesAnnex[] = ["I", "II", "III", "IV", "V"];

/** Faixa aplicável ao RBT12. Acima do teto usa a 6ª faixa (sublimite estourado). */
export function findBracket(annex: SimplesAnnex, rbt12: number): SimplesBracket {
  const base = Math.max(rbt12 || 0, 0);
  const rows = SIMPLES_BRACKETS.filter((r) => r.annex === annex).sort(
    (x, y) => x.bracket - y.bracket,
  );
  if (!rows.length) throw new Error(`Anexo do Simples inválido: ${annex}`);
  const found = rows.find((r) => base >= r.rbt12From && (r.rbt12To == null || base <= r.rbt12To));
  return found ?? rows[rows.length - 1];
}

/** Alíquota efetiva = (RBT12 × nominal − parcela a deduzir) ÷ RBT12. */
export function effectiveRate(bracket: SimplesBracket, rbt12: number): number {
  const base = Math.max(rbt12 || 0, 0);
  if (base <= 0) return round4(bracket.nominalRate);
  const rate = ((base * (bracket.nominalRate / 100) - bracket.deduction) / base) * 100;
  return Math.max(round4(rate), 0);
}

/** Cálculo completo do DAS do mês. */
export function computeSimples(
  annex: SimplesAnnex,
  rbt12: number,
  revenue: number,
): SimplesComputation {
  const bracket = findBracket(annex, rbt12);
  const base = Math.max(rbt12 || 0, 0);
  const rev = Math.max(revenue || 0, 0);
  const rate = effectiveRate(bracket, base);
  return {
    annex,
    bracket: bracket.bracket,
    rbt12: round2(base),
    revenue: round2(rev),
    nominalRate: round4(bracket.nominalRate),
    deduction: round2(bracket.deduction),
    effectiveRate: rate,
    taxAmount: round2((rev * rate) / 100),
    limitUsagePct: round2((base / SIMPLES_LIMIT) * 100),
  };
}

/** Reserva recomendada de caixa para tributos do mês. */
export function taxReserve(revenue: number, effRate: number): number {
  return round2((Math.max(revenue || 0, 0) * Math.max(effRate || 0, 0)) / 100);
}

/** Carga tributária sobre a receita bruta (%). */
export function taxBurden(taxAmount: number, revenue: number): number {
  if (!revenue || revenue <= 0) return 0;
  return round2((taxAmount / revenue) * 100);
}

/* ------------------------------------------------------------------ */
/* PARTE 7 — projeções                                                 */
/* ------------------------------------------------------------------ */

export interface ScenarioInput {
  annex: SimplesAnnex;
  rbt12: number;
  revenue: number;
  cogsRatio: number;
  operatingExpenses: number;
}

export function projectScenario(input: ScenarioInput, growthPct: number) {
  const factor = 1 + growthPct / 100;
  const revenue = round2(input.revenue * factor);
  const calc = computeSimples(input.annex, round2(input.rbt12 * factor), revenue);
  const cogs = round2(revenue * Math.max(input.cogsRatio, 0));
  const opex = round2(Math.max(input.operatingExpenses, 0));
  const netProfit = round2(revenue - cogs - opex - calc.taxAmount);
  return {
    growthPct,
    revenue,
    taxAmount: calc.taxAmount,
    effectiveRate: calc.effectiveRate,
    bracket: calc.bracket,
    cogs,
    operatingExpenses: opex,
    netProfit,
    netMargin: revenue > 0 ? round2((netProfit / revenue) * 100) : 0,
  };
}

export function projectScenarios(input: ScenarioInput, growths = [0, 10, 20, 30]) {
  return growths.map((g) => projectScenario(input, g));
}

/**
 * Quanto pode ser distribuído aos sócios sem comprometer o caixa:
 * lucro líquido do período menos os tributos ainda em aberto.
 */
export function distributableProfit(netProfit: number, pendingTaxes: number): number {
  return round2(Math.max(netProfit - Math.max(pendingTaxes, 0), 0));
}

/* ------------------------------------------------------------------ */
/* PARTE 8 — alertas                                                   */
/* ------------------------------------------------------------------ */

export interface AlertInput {
  annex: SimplesAnnex | null;
  rbt12: number;
  current: TaxApportionment | null;
  previous: TaxApportionment | null;
  today?: Date;
}

const OPEN_STATUSES: ApportionmentStatus[] = ["open", "closed"];

export function buildTaxAlerts(input: AlertInput): TaxAlert[] {
  const alerts: TaxAlert[] = [];
  const { annex, rbt12, current, previous } = input;
  const today = input.today ?? new Date();

  if (annex) {
    const bracket = findBracket(annex, rbt12);
    const usage = (rbt12 / SIMPLES_LIMIT) * 100;

    if (usage >= 100) {
      alerts.push({
        id: "tax.limit_exceeded",
        level: "critical",
        title: "Limite do Simples ultrapassado",
        description: `RBT12 de ${round2(rbt12)} excede o teto de ${SIMPLES_LIMIT}. Desenquadramento iminente.`,
      });
    } else if (usage >= 80) {
      alerts.push({
        id: "tax.limit_near",
        level: "warning",
        title: "Receita próxima do limite do Simples",
        description: `Você já usou ${round2(usage)}% do teto anual de faturamento.`,
      });
    }

    if (bracket.rbt12To != null) {
      const remaining = bracket.rbt12To - rbt12;
      if (remaining >= 0 && remaining <= bracket.rbt12To * 0.05) {
        alerts.push({
          id: "tax.bracket_change_near",
          level: "warning",
          title: "Mudança de faixa próxima",
          description: `Faltam ${round2(remaining)} de faturamento para subir da faixa ${bracket.bracket}.`,
        });
      }
    }
  }

  if (current && previous) {
    if (
      current.bracket != null &&
      previous.bracket != null &&
      current.bracket !== previous.bracket
    ) {
      alerts.push({
        id: "tax.bracket_changed",
        level: "warning",
        title: "Faixa do Simples mudou",
        description: `A empresa passou da faixa ${previous.bracket} para a faixa ${current.bracket}.`,
      });
    }
    if (
      current.simplesAnnex &&
      previous.simplesAnnex &&
      current.simplesAnnex !== previous.simplesAnnex
    ) {
      alerts.push({
        id: "tax.annex_changed",
        level: "warning",
        title: "Anexo do Simples mudou",
        description: `Anexo alterado de ${previous.simplesAnnex} para ${current.simplesAnnex}.`,
      });
    }
    if (current.effectiveRate > previous.effectiveRate) {
      alerts.push({
        id: "tax.rate_increasing",
        level: "info",
        title: "Alíquota efetiva crescente",
        description: `A alíquota subiu de ${previous.effectiveRate}% para ${current.effectiveRate}%.`,
      });
    }
  }

  if (current && current.dueDate && OPEN_STATUSES.includes(current.status)) {
    const due = new Date(`${current.dueDate}T00:00:00`);
    const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
    if (days < 0) {
      alerts.push({
        id: "tax.das_overdue",
        level: "critical",
        title: "DAS vencido",
        description: `O DAS de ${current.competence} venceu em ${current.dueDate} e continua em aberto.`,
      });
    } else if (days <= 5) {
      alerts.push({
        id: "tax.das_due_soon",
        level: "warning",
        title: "DAS vencendo",
        description: `O DAS de ${current.competence} vence em ${days} dia(s) (${current.dueDate}).`,
      });
    }
  }

  return alerts;
}
