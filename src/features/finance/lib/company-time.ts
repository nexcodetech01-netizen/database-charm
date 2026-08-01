/**
 * Compatibilidade — a fonte única passou a ser `src/lib/time`.
 *
 * Este arquivo apenas reexporta a infraestrutura central. Não adicione
 * lógica aqui: importe de `@/lib/time` em código novo.
 */
export {
  DEFAULT_COMPANY_TZ,
  tzOffsetMs,
  companyDayStartUtc,
  addDaysStr,
  companyDayKey,
  companyMonthKey,
} from "@/lib/time";
