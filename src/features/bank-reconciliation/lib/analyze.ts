import { hashEntries, matchStatement, type SystemMove } from "./match";
import type { ParsedStatement, StatementEntry } from "./nubank-statement";

export interface StoredLineLite {
  line_hash: string;
  status: "matched" | "created" | "ignored";
  transaction_id: string | null;
  transfer_id: string | null;
}

export interface ReviewItem {
  entry: StatementEntry;
  hash: string;
}

export interface Analysis {
  outOfScope: number;
  done: (ReviewItem & { status: StoredLineLite["status"] })[];
  matched: (ReviewItem & { move: SystemMove })[];
  bankOnly: ReviewItem[];
  systemOnly: SystemMove[];
  statementReadOk: boolean;
  systemBalanceAtEnd: number | null;
  difference: number | null;
}

function signed(direction: "in" | "out", amount: number) {
  return direction === "in" ? amount : -amount;
}

export function analyzeStatement(input: {
  statement: ParsedStatement;
  fromDay: string;
  storedLines: StoredLineLite[];
  moves: SystemMove[];
  currentBalance: number | null;
}): Analysis {
  const { statement, fromDay, storedLines, moves, currentBalance } = input;
  const end = statement.periodEnd ?? statement.entries.at(-1)?.date ?? fromDay;
  const hashes = hashEntries(statement.entries);
  const stored = new Map(storedLines.map((l) => [l.line_hash, l]));
  const linked = new Set(storedLines.flatMap((l) => [l.transaction_id, l.transfer_id]).filter(Boolean) as string[]);

  const dayMinus3 = shift(fromDay, -3);
  const done: Analysis["done"] = [];
  // linhas dos 3 dias antes do "a partir de" só servem para casar com
  // lançamentos feitos com atraso; nunca aparecem como "falta lançar".
  const open: (ReviewItem & { margin: boolean })[] = [];
  let outOfScope = 0;
  statement.entries.forEach((entry, i) => {
    const hash = hashes[i];
    const s = stored.get(hash);
    if (entry.date < fromDay) {
      outOfScope++;
      if (!s && entry.date >= dayMinus3) open.push({ entry, hash, margin: true });
      return;
    }
    if (s) done.push({ entry, hash, status: s.status });
    else open.push({ entry, hash, margin: false });
  });

  const dayPlus3 = shift(end, 3);
  const candidates = moves.filter((m) => !linked.has(m.id) && m.date >= dayMinus3 && m.date <= dayPlus3);
  const result = matchStatement(open.map((o) => o.entry), candidates);

  const matched = result.matched.map((m) => ({ entry: m.entry, hash: open[m.index].hash, move: m.move }));
  const bankOnly = result.bankOnly
    .filter((b) => !open[b.index].margin)
    .map((b) => ({ entry: b.entry, hash: open[b.index].hash }));
  const systemOnly = result.systemOnly.filter((m) => m.date >= fromDay && m.date <= end);

  const net = statement.entries.reduce((s, e) => s + signed(e.direction, e.amount), 0);
  const statementReadOk =
    statement.openingBalance !== null &&
    statement.closingBalance !== null &&
    Math.abs(statement.openingBalance + net - statement.closingBalance) < 0.01;

  let systemBalanceAtEnd: number | null = null;
  if (currentBalance !== null) {
    const after = moves.filter((m) => m.date > end).reduce((s, m) => s + signed(m.direction, m.amount), 0);
    systemBalanceAtEnd = round2(currentBalance - after);
  }
  const difference =
    systemBalanceAtEnd !== null && statement.closingBalance !== null
      ? round2(systemBalanceAtEnd - statement.closingBalance)
      : null;

  return { outOfScope, done, matched, bankOnly, systemOnly, statementReadOk, systemBalanceAtEnd, difference };
}

function shift(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
