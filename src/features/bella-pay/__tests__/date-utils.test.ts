import { describe, it, expect } from "vitest";
import { toTransactionDate } from "../lib/date-utils";

describe("date-utils (P1-04)", () => {
  it("YYYY-MM-DD passa direto", () => {
    expect(toTransactionDate("2026-07-14")).toBe("2026-07-14");
  });

  it("ISO completo é truncado sem conversão de timezone", () => {
    // Se caíssemos em new Date().toISOString(), 2026-07-14T02:00:00-03:00
    // viraria 2026-07-14T05:00:00Z (mesmo dia, ok), mas
    // 2026-07-14T22:00:00-03:00 viraria 2026-07-15T01:00:00Z (troca de dia).
    // Nossa função pega os 10 primeiros chars do ISO local.
    expect(toTransactionDate("2026-07-14T22:00:00-03:00")).toBe("2026-07-14");
    expect(toTransactionDate("2026-07-14T00:30:00Z")).toBe("2026-07-14");
  });

  it("valor inválido cai no fallback", () => {
    expect(toTransactionDate(null, "2026-01-02T00:00:00Z")).toBe("2026-01-02");
    expect(toTransactionDate("banana", "2026-01-02T00:00:00Z")).toBe(
      "2026-01-02",
    );
  });

  it("string vazia usa fallback", () => {
    expect(toTransactionDate("", "2026-03-04T00:00:00Z")).toBe("2026-03-04");
  });

  it("consistente entre UTC e GMT-3 (não troca dia)", () => {
    // Um pagamento realizado 2026-07-14 no Asaas deve virar 2026-07-14
    // sem depender do fuso do servidor.
    const brSameDay = toTransactionDate("2026-07-14T23:59:00-03:00");
    const utcSameDay = toTransactionDate("2026-07-14T20:00:00Z");
    expect(brSameDay).toBe("2026-07-14");
    expect(utcSameDay).toBe("2026-07-14");
  });
});
