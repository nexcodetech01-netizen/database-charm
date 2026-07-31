/**
 * Bella Contadora — helpers puros (sem IO, sem regra de negócio nova).
 */
import { currentMonthRange, lastNMonths, monthRange } from "@/features/accounting";
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
