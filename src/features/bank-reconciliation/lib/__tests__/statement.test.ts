import { describe, expect, it } from "vitest";
import { parseNubankStatement, type StatementEntry } from "../nubank-statement";
import { hashEntries, matchStatement, type SystemMove } from "../match";
import { analyzeStatement } from "../analyze";

const entry: StatementEntry = {
  date: "2026-10-07", direction: "in", amount: 100,
  kind: "Pix recebido", counterparty: "Cliente", description: "Pix recebido · Cliente",
};
const move: SystemMove = {
  id: "tx-1", kind: "transaction", date: "2026-10-10", direction: "in",
  amount: 100, description: "Recebimento", source: null,
};

describe("statement utilities", () => {
  it("retains date and direction across page headers", () => {
    const result = parseNubankStatement([
      ["Movimentações"], ["07 OUT 2026", "Total de entradas", "200,00"],
      ["Pix recebido", "Cliente A", "100,00"],
      ["Página 2"], ["Pix recebido", "Cliente B", "100,00"],
    ]);
    expect(result.entries.map(({ date, direction, amount }) => ({ date, direction, amount })))
      .toEqual([{ date: "2026-10-07", direction: "in", amount: 100 }, { date: "2026-10-07", direction: "in", amount: 100 }]);
  });

  it("matches within three days but not four days", () => {
    expect(matchStatement([entry], [move]).matched).toHaveLength(1);
    expect(matchStatement([entry], [{ ...move, date: "2026-10-11" }]).bankOnly).toHaveLength(1);
  });

  it("uses each system movement only once", () => {
    const result = matchStatement([entry, entry], [move]);
    expect(result.matched).toHaveLength(1);
    expect(result.bankOnly).toHaveLength(1);
  });

  it("distinguishes repeated entries by occurrence", () => {
    expect(hashEntries([entry, entry])).toEqual([
      "2026-10-07|in|100.00|pix recebido · cliente|0",
      "2026-10-07|in|100.00|pix recebido · cliente|1",
    ]);
  });

  it("never marks the three-day pre-period margin as missing", () => {
    const result = analyzeStatement({
      statement: { bank: "nubank", periodStart: "2026-10-01", periodEnd: "2026-10-10", openingBalance: 0, closingBalance: 100, entries: [entry] },
      fromDay: "2026-10-10", storedLines: [], moves: [], currentBalance: 100,
    });
    expect(result.outOfScope).toBe(1);
    expect(result.bankOnly).toEqual([]);
    expect(result.statementReadOk).toBe(true);
    expect(result.difference).toBe(0);
  });
});