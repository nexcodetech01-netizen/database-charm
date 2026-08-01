/**
 * Recortes de dia/mês/ano no fuso da empresa.
 */
import {
  DEFAULT_COMPANY_TZ,
  toDate,
  tzOffsetMs,
  tzParts,
  type CompanyTimeZone,
  type Instant,
} from "./company-now";

/** Instante UTC (ms) da meia-noite de `YYYY-MM-DD` no fuso da empresa. */
export function companyDayStartUtc(
  dateStr: string,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): number {
  const naive = Date.parse(`${dateStr}T00:00:00Z`);
  const first = naive - tzOffsetMs(new Date(naive), timeZone);
  // Segunda passada cobre transições de horário de verão.
  return naive - tzOffsetMs(new Date(first), timeZone);
}

/** Soma dias ao string `YYYY-MM-DD` preservando o formato. */
export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` do instante avaliado no fuso da empresa. */
export function companyDayKey(
  instant: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): string {
  const p = tzParts(toDate(instant), timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** `YYYY-MM` do instante avaliado no fuso da empresa. */
export function companyMonthKey(
  instant: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): string {
  const p = tzParts(toDate(instant), timeZone);
  return `${p.year}-${p.month}`;
}

/** `YYYY` do instante avaliado no fuso da empresa. */
export function companyYearKey(
  instant: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): string {
  return tzParts(toDate(instant), timeZone).year as string;
}

/** Data (Date) de hoje no fuso da empresa — início do dia. */
export function companyToday(
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
  reference: Instant = new Date(),
): Date {
  return companyStartOfDay(reference, timeZone);
}

/** Instante do início do dia (00:00:00.000) da empresa. */
export function companyStartOfDay(
  instant: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): Date {
  const key =
    typeof instant === "string" && /^\d{4}-\d{2}-\d{2}$/.test(instant)
      ? instant
      : companyDayKey(instant, timeZone);
  return new Date(companyDayStartUtc(key, timeZone));
}

/** Instante do fim do dia (23:59:59.999) da empresa. */
export function companyEndOfDay(
  instant: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): Date {
  const key =
    typeof instant === "string" && /^\d{4}-\d{2}-\d{2}$/.test(instant)
      ? instant
      : companyDayKey(instant, timeZone);
  return new Date(companyDayStartUtc(addDaysStr(key, 1), timeZone) - 1);
}
