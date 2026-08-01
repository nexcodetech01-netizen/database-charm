/**
 * Formatação de datas no fuso da empresa (apresentação apenas).
 */
import {
  DEFAULT_COMPANY_TZ,
  toDate,
  type CompanyTimeZone,
  type Instant,
} from "./company-now";

export function companyFormatDate(
  instant: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
  locale = "pt-BR",
): string {
  return toDate(instant).toLocaleDateString(locale, { timeZone });
}

export function companyFormatTime(
  instant: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
  locale = "pt-BR",
): string {
  return toDate(instant).toLocaleTimeString(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function companyFormatDateTime(
  instant: Instant,
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
  locale = "pt-BR",
): string {
  return `${companyFormatDate(instant, timeZone, locale)} ${companyFormatTime(instant, timeZone, locale)}`;
}

/** `YYYY-MM` → `MM/YYYY`. */
export function companyFormatMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${m}/${y}`;
}
