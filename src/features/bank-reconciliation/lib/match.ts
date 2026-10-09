import type { Direction, StatementEntry } from "./nubank-statement";

/** Movimento já registrado no sistema para a conta (lançamento pago ou transferência). */
export interface SystemMove {
  /** id do lançamento ou da transferência */
  id: string;
  kind: "transaction" | "transfer";
  /** yyyy-mm-dd (dia do pagamento / da transferência) */
  date: string;
  direction: Direction;
  amount: number;
  description: string;
  source: string | null;
}

export interface MatchResult {
  matched: { entry: StatementEntry; move: SystemMove; index: number }[];
  bankOnly: { entry: StatementEntry; index: number }[];
  systemOnly: SystemMove[];
}

function dayDiff(a: string, b: string): number {
  const ms = Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`);
  return Math.round(Math.abs(ms) / 86_400_000);
}

/**
 * Casa cada linha do extrato com um movimento do sistema de mesmo valor e
 * mesma direção, com data até `toleranceDays` de distância (a mais próxima
 * ganha). Cada movimento só é usado uma vez.
 */
export function matchStatement(
  entries: StatementEntry[],
  moves: SystemMove[],
  toleranceDays = 3,
): MatchResult {
  const used = new Set<string>();
  const matched: MatchResult["matched"] = [];
  const bankOnly: MatchResult["bankOnly"] = [];

  // Primeiro os casamentos mais "certos" (mesmo dia), depois os de data próxima.
  const order = entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.date.localeCompare(b.entry.date));
  const pending: typeof order = [];

  for (const pass of [0, toleranceDays]) {
    const list = pass === 0 ? order : pending.splice(0);
    for (const item of list) {
      const candidates = moves
        .filter(
          (m) =>
            !used.has(m.id) &&
            m.direction === item.entry.direction &&
            Math.abs(m.amount - item.entry.amount) < 0.005 &&
            dayDiff(m.date, item.entry.date) <= pass,
        )
        .sort((a, b) => dayDiff(a.date, item.entry.date) - dayDiff(b.date, item.entry.date));
      const best = candidates[0];
      if (best) {
        used.add(best.id);
        matched.push({ entry: item.entry, move: best, index: item.index });
      } else if (pass === 0) {
        pending.push(item);
      } else {
        bankOnly.push(item);
      }
    }
  }

  return {
    matched: matched.sort((a, b) => a.index - b.index),
    bankOnly: bankOnly.sort((a, b) => a.index - b.index),
    systemOnly: moves.filter((m) => !used.has(m.id)).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** Identidade estável de uma linha do extrato (para lembrar o que já foi conferido). */
export function entryHash(entry: StatementEntry, occurrence: number): string {
  const desc = entry.description.toLowerCase().replace(/\s+/g, " ").trim();
  return `${entry.date}|${entry.direction}|${entry.amount.toFixed(2)}|${desc}|${occurrence}`;
}

/** Hash de todas as linhas, numerando repetições idênticas no mesmo dia. */
export function hashEntries(entries: StatementEntry[]): string[] {
  const seen = new Map<string, number>();
  return entries.map((e) => {
    const base = entryHash(e, 0);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return entryHash(e, n);
  });
}
