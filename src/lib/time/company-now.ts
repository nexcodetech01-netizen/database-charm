/**
 * Infraestrutura única de tempo do NexOS — primitivas de fuso.
 *
 * Toda leitura de "agora" e "hoje" da empresa DEVE passar por aqui.
 * Nenhuma regra de negócio vive neste módulo.
 */

/** Fuso padrão quando a empresa não define um. */
export const DEFAULT_COMPANY_TZ = "America/Sao_Paulo";

export type CompanyTimeZone = string;
export type Instant = Date | string | number;

export function toDate(instant: Instant): Date {
  return instant instanceof Date ? instant : new Date(instant);
}

export function tzParts(
  instant: Date,
  timeZone: CompanyTimeZone,
): Record<string, string> {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return Object.fromEntries(
    dtf.formatToParts(instant).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
}

/** Deslocamento (ms) do fuso em relação ao UTC no instante informado. */
export function tzOffsetMs(instant: Date, timeZone: CompanyTimeZone): number {
  const p = tzParts(instant, timeZone);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) === 24 ? 0 : Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - instant.getTime();
}

/** Instante atual (o mesmo instante universal, avaliado no fuso da empresa). */
export function companyNow(_timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ): Date {
  return new Date();
}

/** `YYYY-MM-DD` de hoje no fuso da empresa. */
export function companyTodayISO(
  timeZone: CompanyTimeZone = DEFAULT_COMPANY_TZ,
  reference: Instant = new Date(),
): string {
  const p = tzParts(toDate(reference), timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}
