/**
 * Bella Contadora — helpers puros (sem IO, sem regra de negócio nova).
 */
import { currentMonthRange, lastNMonths } from "@/features/accounting";
import { monthRange } from "@/features/accounting/lib/periods";
import type {
  AccountingDataSource,
  AccountingPeriod,
  ProviderResult,
} from "../types";

export { currentMonthRange, lastNMonths, monthRange };

export function currentPeriod(reference = new Date()): AccountingPeriod {
  const r = currentMonthRange(reference);
  return { start: r.start, end: r.end, label: r.label };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Data local no formato ISO `YYYY-MM-DD`. */
export function todayISO(reference = new Date()): string {
  return `${reference.getFullYear()}-${pad(reference.getMonth() + 1)}-${pad(reference.getDate())}`;
}

/** Período de um único dia. */
export function dayPeriod(dateISO: string): AccountingPeriod {
  return { start: dateISO, end: dateISO, label: dateISO };
}

/** Dia anterior a uma data ISO (puro, sem fuso). */
export function previousDayISO(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const ref = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  ref.setUTCDate(ref.getUTCDate() - 1);
  return ref.toISOString().slice(0, 10);
}

/** Mês imediatamente anterior ao período informado. */
export function previousMonthPeriod(period: AccountingPeriod): AccountingPeriod {
  const [y, m] = period.start.split("-").map(Number);
  const year = m === 1 ? (y ?? 1970) - 1 : (y ?? 1970);
  const month = m === 1 ? 12 : (m ?? 1) - 1;
  const r = monthRange(year, month);
  return { start: r.start, end: r.end, label: r.label };
}

export function ok<T>(
  data: T,
  source: AccountingDataSource,
  note?: string,
): ProviderResult<T> {
  return { available: true, data, source, generatedAt: new Date().toISOString(), note };
}

export function unavailable<T>(
  source: AccountingDataSource,
  note = "Serviço sem dados para o período.",
): ProviderResult<T> {
  return { available: false, data: null, source, generatedAt: new Date().toISOString(), note };
}

/** Executa a leitura e degrada para `unavailable` em vez de quebrar a tela. */
export async function readSafely<T>(
  source: AccountingDataSource,
  fn: () => Promise<T>,
  note?: string,
): Promise<ProviderResult<T>> {
  try {
    return ok(await fn(), source, note);
  } catch {
    return unavailable<T>(source, "Não foi possível ler o serviço de origem.");
  }
}

export function safeDivide(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

export function ratio(part: number, total: number): number {
  return safeDivide(part, total) * 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
