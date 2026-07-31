import type { TransactionWithMeta } from "../types";
import {
  DEFAULT_COMPANY_TZ,
  companyDayKey,
  companyMonthKey,
} from "./company-time";

export interface MonthlyBucket {
  key: string; // YYYY-MM
  label: string; // "jan/25"
  income: number;
  expense: number;
  result: number;
}

export interface DailyBucket {
  key: string; // YYYY-MM-DD
  label: string; // "12/03"
  income: number;
  expense: number;
  balance: number;
}

const MONTH_LABELS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * Últimos N meses de receitas x despesas realizadas.
 *
 * Critério ÚNICO do dashboard: valores REALIZADOS filtram por `paid_at` no
 * fuso da empresa (mesmo tratamento de `receiptsToday` /
 * `overview.monthIncome`). Nunca usa `transaction_date`, que representa
 * competência/previsão.
 */
export function buildMonthlySeries(
  tx: TransactionWithMeta[],
  months = 6,
  companyTz: string = DEFAULT_COMPANY_TZ,
): MonthlyBucket[] {
  const nowKey = companyMonthKey(new Date(), companyTz);
  const [nowY, nowM] = nowKey.split("-").map(Number);

  const buckets: MonthlyBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    // Aritmética de meses independente do fuso local do navegador.
    const monthIndex0 = nowM - 1 - i;
    const y = nowY + Math.floor(monthIndex0 / 12);
    const mZero = ((monthIndex0 % 12) + 12) % 12;
    const key = `${y}-${String(mZero + 1).padStart(2, "0")}`;
    buckets.push({
      key,
      label: `${MONTH_LABELS[mZero]}/${String(y).slice(-2)}`,
      income: 0,
      expense: 0,
      result: 0,
    });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));

  for (const t of tx) {
    // Realizado exige paid_at — nunca transaction_date.
    if (t.status !== "paid") continue;
    if (!t.paid_at) continue;
    const key = companyMonthKey(t.paid_at, companyTz);
    const idx = index.get(key);
    if (idx === undefined) continue;
    const amount = Number(t.amount ?? 0);
    if (t.type === "income") buckets[idx].income += amount;
    else if (t.type === "expense") buckets[idx].expense += amount;
  }
  for (const b of buckets) b.result = b.income - b.expense;
  return buckets;
}

/**
 * Fluxo diário: faixa realizada (últimos N dias) + previsão (próximos N).
 *
 * - Faixa REALIZADA (`status='paid'`): filtra por `paid_at` no fuso da
 *   empresa — mesmo critério de `receiptsToday` / `monthIncome`.
 * - Faixa de PREVISÃO (não pagos): mantém `due_date` / `transaction_date`
 *   pois representam competência/vencimento.
 */
export function buildDailyCashFlow(
  tx: TransactionWithMeta[],
  openingBalance: number,
  daysBack = 7,
  daysAhead = 14,
  companyTz: string = DEFAULT_COMPANY_TZ,
): DailyBucket[] {
  const todayKey = companyDayKey(new Date(), companyTz);
  const [tY, tM, tD] = todayKey.split("-").map(Number);

  const buckets: DailyBucket[] = [];
  for (let i = -daysBack; i <= daysAhead; i++) {
    // Aritmética de dias em UTC "puro" a partir da data-empresa de hoje.
    const base = new Date(Date.UTC(tY, tM - 1, tD));
    base.setUTCDate(base.getUTCDate() + i);
    const key = base.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: `${key.slice(8, 10)}/${key.slice(5, 7)}`,
      income: 0,
      expense: 0,
      balance: 0,
    });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));

  for (const t of tx) {
    if (t.status === "cancelled") continue;
    if (t.type === "transfer") continue;

    let key: string | null = null;
    if (t.status === "paid") {
      // Realizado — sempre paid_at no fuso da empresa.
      if (!t.paid_at) continue;
      key = companyDayKey(t.paid_at, companyTz);
    } else {
      // Previsão — usa vencimento/competência (mantém comportamento).
      const ref = t.due_date ?? t.transaction_date;
      if (!ref) continue;
      key = ref.slice(0, 10);
    }

    const idx = index.get(key);
    if (idx === undefined) continue;
    const amount = Number(t.amount ?? 0);
    if (t.type === "income") buckets[idx].income += amount;
    else buckets[idx].expense += amount;
  }

  let running = openingBalance;
  for (const b of buckets) {
    running += b.income - b.expense;
    b.balance = running;
  }
  return buckets;
}
