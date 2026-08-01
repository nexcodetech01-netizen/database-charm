/**
 * Infraestrutura única de datas e horários do NexOS.
 *
 * Todo módulo que precise de "hoje", recorte de período ou comparação de datas
 * DEVE importar daqui — nunca criar lógica de fuso paralela.
 */
export {
  DEFAULT_COMPANY_TZ,
  companyNow,
  companyTodayISO,
  toDate,
  tzOffsetMs,
  tzParts,
  type CompanyTimeZone,
  type Instant,
} from "./company-now";

export {
  addDaysStr,
  companyDayKey,
  companyDayStartUtc,
  companyEndOfDay,
  companyMonthKey,
  companyStartOfDay,
  companyToday,
  companyYearKey,
} from "./company-day";

export {
  companyDateRange,
  companyEndOfMonth,
  companyMonthRange,
  companyStartOfMonth,
  type CompanyRange,
} from "./company-range";

export {
  companyCompareDay,
  companyCompareMonth,
  companyCompareYear,
  companyIsSameDay,
  companyIsSameMonth,
} from "./company-compare";

export {
  companyFormatDate,
  companyFormatDateTime,
  companyFormatMonthKey,
  companyFormatTime,
} from "./company-format";
