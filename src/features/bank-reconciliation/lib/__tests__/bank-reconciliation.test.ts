import { describe, expect, it } from "vitest";
import { cleanCounterparty, parseNubankStatement } from "../nubank-statement";
import { hashEntries, matchStatement, type SystemMove } from "../match";

const rows: string[][] = [
  ["EMPRESA TESTE"],
  ["25 DE SETEMBRO DE 2026", "a", "09 DE OUTUBRO DE 2026", "VALORES EM R$"],
  ["Saldo inicial", "100,00"],
  ["Total de entradas", "+1.200,00"],
  ["Saldo final do período", "1.050,00"],
  ["Movimentações"],
  ["26 SET 2026", "Total de entradas", "+ 1.200,00"],
  ["Transferência recebida pelo Pix", "MARIA SILVA - •••.084.528-•• -", "1.200,00"],
  ["BCO BRADESCO S.A. (0237) Agência: 10 Conta:"],
  ["Total de saídas", "- 250,00"],
  ["Transferência enviada pelo Pix", "48.003.334 FORNECEDOR LTDA -", "200,00"],
  ["Extrato gerado dia 09 de outubro de 2026 às 17:15", "1 de 2"],
  ["Pagamento de fatura", "50,00"],
  ["Saldo do dia", "1.050,00"],
];

describe("leitura do extrato Nubank", () => {
  it("lê período, saldos e movimentos com direção e dia", () => {
    const s = parseNubankStatement(rows);
    expect(s.periodStart).toBe("2026-09-25");
    expect(s.periodEnd).toBe("2026-10-09");
    expect(s.openingBalance).toBe(100);
    expect(s.closingBalance).toBe(1050);
    expect(s.entries.map((e) => [e.date, e.direction, e.amount, e.counterparty])).toEqual([
      ["2026-09-26", "in", 1200, "MARIA SILVA"],
      ["2026-09-26", "out", 200, "FORNECEDOR LTDA"],
      ["2026-09-26", "out", 50, ""],
    ]);
  });

  it("limpa o nome de quem pagou", () => {
    expect(cleanCounterparty("FELIPE E SILVA 35658267897 - 38.063.005/0001-36")).toBe(
      "FELIPE E SILVA",
    );
  });
});

describe("conciliação", () => {
  const s = parseNubankStatement(rows);
  const move = (id: string, date: string, direction: "in" | "out", amount: number): SystemMove => ({
    id,
    kind: "transaction",
    date,
    direction,
    amount,
    description: id,
    source: "manual",
  });

  it("casa por valor, direção e data próxima; separa o que sobra dos dois lados", () => {
    const r = matchStatement(s.entries, [
      move("venda", "2026-09-27", "in", 1200),
      move("shopee-1", "2026-09-26", "out", 50),
      move("shopee-2", "2026-09-26", "out", 50),
      move("longe", "2026-10-09", "out", 200),
    ]);
    expect(r.matched.map((m) => m.move.id)).toEqual(["venda", "shopee-1"]);
    expect(r.bankOnly.map((b) => b.entry.amount)).toEqual([200]);
    expect(r.systemOnly.map((m) => m.id)).toEqual(["shopee-2", "longe"]);
  });

  it("dá identidade diferente para duas linhas iguais no mesmo dia", () => {
    const e = s.entries[2];
    const [a, b] = hashEntries([e, e]);
    expect(a).not.toBe(b);
  });
});

import { analyzeStatement } from "../analyze";

describe("análise completa", () => {
  const s = parseNubankStatement(rows);
  const mv = (id: string, date: string, direction: "in" | "out", amount: number): SystemMove => ({
    id,
    kind: "transaction",
    date,
    direction,
    amount,
    description: id,
    source: "manual",
  });

  it("respeita o 'a partir de', o que já foi conferido e calcula a diferença no fim do extrato", () => {
    const hashes = hashEntries(s.entries);
    const a = analyzeStatement({
      statement: s,
      fromDay: "2026-09-26",
      storedLines: [
        { line_hash: hashes[2], status: "ignored", transaction_id: null, transfer_id: null },
      ],
      moves: [mv("venda", "2026-09-26", "in", 1200), mv("depois", "2026-10-12", "out", 30)],
      currentBalance: 1020,
    });
    expect(a.statementReadOk).toBe(true);
    expect(a.done).toHaveLength(1);
    expect(a.matched.map((m) => m.move.id)).toEqual(["venda"]);
    expect(a.bankOnly.map((b) => b.entry.amount)).toEqual([200]);
    expect(a.systemOnly).toHaveLength(0); // "depois" está fora do período do extrato
    expect(a.systemBalanceAtEnd).toBe(1050); // 1020 hoje + 30 que saiu depois
    expect(a.difference).toBe(0);
  });
});

describe("borda do 'a partir de'", () => {
  it("casa lançamento feito com atraso com a linha do banco de antes do início, sem mostrar a linha como faltando", () => {
    const s = parseNubankStatement(rows);
    const a = analyzeStatement({
      statement: s,
      fromDay: "2026-09-27",
      storedLines: [],
      moves: [
        {
          id: "compra",
          kind: "transaction",
          date: "2026-09-28",
          direction: "out",
          amount: 200,
          description: "compra",
          source: "purchase",
        },
      ],
      currentBalance: null,
    });
    expect(a.systemOnly).toHaveLength(0);
    expect(a.bankOnly).toHaveLength(0);
    expect(a.matched.map((m) => m.move.id)).toEqual(["compra"]);
  });
});
