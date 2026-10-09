import type { Direction, StatementEntry } from "./nubank-statement";

export interface SystemMove {
  id: string;
  kind: "transaction" | "transfer";
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

export function matchStatement(entries: StatementEntry[], moves: SystemMove[], toleranceDays = 3): MatchResult {
  const used = new Set<string>();
  const matched: MatchResult["matched"] = [];
  const bankOnly: MatchResult["bankOnly"] = [];

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

export function entryHash(entry: StatementEntry, occurrence: number): string {
  const desc = entry.description.toLowerCase().replace(/\s+/g, " ").trim();
  return `${entry.date}|${entry.direction}|${entry.amount.toFixed(2)}|${desc}|${occurrence}`;
}

export function hashEntries(entries: StatementEntry[]): string[] {
  const seen = new Map<string, number>();
  return entries.map((e) => {
    const base = entryHash(e, 0);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return entryHash(e, n);
  });
}
