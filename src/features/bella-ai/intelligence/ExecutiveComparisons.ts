/**
 * Comparações período atual vs período anterior.
 * Regras puras — nenhum acesso a IO.
 */
import type {
  ComparisonKey,
  ComparisonResult,
  Direction,
  RawSaleRow,
} from "./types";
import { sumRevenueBetween } from "./ExecutiveMetrics";

const LABELS: Record<ComparisonKey, string> = {
  today_vs_yesterday: "Hoje vs Ontem",
  week_vs_previous: "Semana vs Semana anterior",
  month_vs_previous: "Mês vs Mês anterior",
  year_vs_previous: "Ano vs Ano anterior",
};

function toDirection(delta: number, previous: number): Direction {
  if (previous === 0 && delta === 0) return "flat";
  if (Math.abs(delta) < 0.01) return "flat";
  return delta > 0 ? "up" : "down";
}

function pctChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export interface ComparisonWindows {
  today: [Date, Date];
  yesterday: [Date, Date];
  week: [Date, Date];
  prevWeek: [Date, Date];
  month: [Date, Date];
  prevMonth: [Date, Date];
  year: [Date, Date];
  prevYear: [Date, Date];
}

export function buildComparisons(
  sales: readonly RawSaleRow[],
  w: ComparisonWindows,
): ComparisonResult[] {
  const pairs: Array<{ key: ComparisonKey; cur: [Date, Date]; prev: [Date, Date] }> = [
    { key: "today_vs_yesterday", cur: w.today, prev: w.yesterday },
    { key: "week_vs_previous", cur: w.week, prev: w.prevWeek },
    { key: "month_vs_previous", cur: w.month, prev: w.prevMonth },
    { key: "year_vs_previous", cur: w.year, prev: w.prevYear },
  ];

  return pairs.map(({ key, cur, prev }) => {
    const current = sumRevenueBetween(sales, cur[0], cur[1]);
    const previous = sumRevenueBetween(sales, prev[0], prev[1]);
    const delta = Math.round((current - previous) * 100) / 100;
    const pct = pctChange(current, previous);
    return {
      key,
      label: LABELS[key],
      current,
      previous,
      delta,
      pct,
      direction: toDirection(delta, previous),
    };
  });
}
