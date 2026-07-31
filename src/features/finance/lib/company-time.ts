/**
 * Fonte única de tratamento temporal do Financeiro.
 *
 * Todos os indicadores de "realizado" (paid_at) e "hoje da empresa" DEVEM
 * usar exclusivamente estes utilitários. Não crie lógica paralela de datas
 * em outros módulos do Financeiro — importe daqui.
 */

/** Fuso padrão quando a empresa não define um. */
export const DEFAULT_COMPANY_TZ = "America/Sao_Paulo";

function tzParts(instant: Date, timeZone: string): Record<string, string> {
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
export function tzOffsetMs(instant: Date, timeZone: string): number {
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

/** Instante UTC (ms) da meia-noite de `YYYY-MM-DD` no fuso da empresa. */
export function companyDayStartUtc(dateStr: string, timeZone: string): number {
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
  instant: Date | string | number,
  timeZone: string,
): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  const p = tzParts(d, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** `YYYY-MM` do instante avaliado no fuso da empresa. */
export function companyMonthKey(
  instant: Date | string | number,
  timeZone: string,
): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  const p = tzParts(d, timeZone);
  return `${p.year}-${p.month}`;
}
