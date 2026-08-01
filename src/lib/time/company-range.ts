/**
 * Intervalos (mês, período) no fuso da empresa.
 */
import { DEFAULT_COMPANY_TZ, type CompanyTimeZone, type Instant } from "./company-now";
import {
  addDaysStr,
  companyDayKey,
  companyEndOfDay,
  companyStartOfDay,
} from "./company-day";

export interface CompanyRange {
  /** `YYYY-MM-DD` inicial (inclusivo). */
  startISO: string;
  /** `YYYY-MM-DD` final (inclusivo). */
  endISO: string;
  /** Instante do início do primeiro dia. */
  start: Date;
  /** Instante do fim do último dia. */
  end: Date;
  /** Dias do intervalo em `YYYY-MM-DD`. */
  days: string[];
}

function dayKeyOf(instant: Instant, tz: CompanyTimeZone): string {
  return typeof instant === "string" && /^\d{4}-\d{2}-\d{2}$/.test(instant)
    ? instant
    : companyDayKey(instant, tz);
}

/** Intervalo entre duas datas (inclusivo nas duas pontas). */
export function companyDateRange(
  from: Instant,
  to: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): CompanyRange {
  let startISO = dayKeyOf(from, timeZone);
  let endISO = dayKeyOf(to, timeZone);
  if (startISO > endISO) [startISO, endISO] = [endISO, startISO];

  const days: string[] = [];
  for (let d = startISO; d <= endISO; d = addDaysStr(d, 1)) days.push(d);

  return {
    startISO,
    endISO,
    start: companyStartOfDay(startISO, timeZone),
    end: companyEndOfDay(endISO, timeZone),
    days,
  };
}

/** Instante do início do mês da empresa. */
export function companyStartOfMonth(
  instant: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): Date {
  const key = dayKeyOf(instant, timeZone);
  return companyStartOfDay(`${key.slice(0, 7)}-01`, timeZone);
}

/** Instante do fim do mês da empresa. */
export function companyEndOfMonth(
  instant: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): Date {
  const key = dayKeyOf(instant, timeZone);
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const iso = `${key.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
  return companyEndOfDay(iso, timeZone);
}

/** Intervalo do mês corrente (ou do mês do instante informado). */
export function companyMonthRange(
  instant: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
): CompanyRange {
  const start = companyStartOfMonth(instant, timeZone);
  const end = companyEndOfMonth(instant, timeZone);
  return companyDateRange(
    companyDayKey(start, timeZone),
    companyDayKey(end, timeZone),
    timeZone,
  );
}
