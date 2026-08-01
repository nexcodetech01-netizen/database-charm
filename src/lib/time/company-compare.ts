/**
 * Comparações de data no fuso da empresa (puras).
 */
import { DEFAULT_COMPANY_TZ, type CompanyTimeZone, type Instant } from "./company-now";
import { companyDayKey, companyMonthKey, companyYearKey } from "./company-day";

function cmp(a: string, b: string): -1 | 0 | 1 {
  return a === b ? 0 : a < b ? -1 : 1;
}

/** -1, 0 ou 1 comparando o dia da empresa. */
export function companyCompareDay(
  a: Instant,
  b: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): -1 | 0 | 1 {
  return cmp(companyDayKey(a, timeZone), companyDayKey(b, timeZone));
}

/** -1, 0 ou 1 comparando o mês da empresa. */
export function companyCompareMonth(
  a: Instant,
  b: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): -1 | 0 | 1 {
  return cmp(companyMonthKey(a, timeZone), companyMonthKey(b, timeZone));
}

/** -1, 0 ou 1 comparando o ano da empresa. */
export function companyCompareYear(
  a: Instant,
  b: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): -1 | 0 | 1 {
  return cmp(companyYearKey(a, timeZone), companyYearKey(b, timeZone));
}

export function companyIsSameDay(
  a: Instant,
  b: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): boolean {
  return companyCompareDay(a, b, timeZone) === 0;
}

export function companyIsSameMonth(
  a: Instant,
  b: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): boolean {
  return companyCompareMonth(a, b, timeZone) === 0;
}
