/**
 * Motor Contábil — utilitários de período (puros).
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function monthRange(year: number, month: number): { start: string; end: string; label: string } {
  const start = `${year}-${pad(month)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
    label: `${pad(month)}/${year}`,
  };
}

export function currentMonthRange(reference = new Date()): { start: string; end: string; label: string } {
  return monthRange(reference.getFullYear(), reference.getMonth() + 1);
}

/** Últimos N meses (mais antigo primeiro), incluindo o mês de referência. */
export function lastNMonths(
  count: number,
  reference = new Date(),
): { start: string; end: string; label: string }[] {
  const out: { start: string; end: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    out.push(monthRange(d.getFullYear(), d.getMonth() + 1));
  }
  return out;
}
