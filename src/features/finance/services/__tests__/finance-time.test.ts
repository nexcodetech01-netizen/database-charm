import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { financeService } from "../finance.service";

/**
 * TESTE PERMANENTE DE INTEGRIDADE TEMPORAL (finance.service.ts)
 * 
 * Este teste garante que a conversão de datas enviadas pela UI (YYYY-MM-DD)
 * para o timestamp universal (paid_at) respeite o fuso da empresa,
 * especialmente em horários críticos (noite no Brasil = início do dia seguinte UTC).
 * 
 * Local: America/Sao_Paulo (UTC-3)
 */
describe("financeService · integridade temporal (paid_at)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const testCases = [
    {
      description: "Venda às 21:00 BRT (00:00 UTC do dia seguinte)",
      localTime: "2026-08-03T21:00:00",
      localDateInput: "2026-08-03",
      expectedUtc: "2026-08-04T00:00:00.000Z"
    },
    {
      description: "Venda às 22:30 BRT (01:30 UTC do dia seguinte)",
      localTime: "2026-08-03T22:30:00",
      localDateInput: "2026-08-03",
      expectedUtc: "2026-08-04T01:30:00.000Z"
    },
    {
      description: "Venda às 23:59 BRT (02:59 UTC do dia seguinte)",
      localTime: "2026-08-03T23:59:55",
      localDateInput: "2026-08-03",
      expectedUtc: "2026-08-04T02:59:55.000Z"
    },
    {
      description: "Venda às 00:01 BRT (03:01 UTC)",
      localTime: "2026-08-04T00:01:10",
      localDateInput: "2026-08-04",
      expectedUtc: "2026-08-04T03:01:10.000Z"
    }
  ];

  testCases.forEach(({ description, localTime, localDateInput, expectedUtc }) => {
    it(description, async () => {
      // Configuramos o "agora" do sistema para o horário local do teste.
      // Como o servidor pode rodar em UTC, simulamos o Date para refletir o instante universal correspondente.
      // America/Sao_Paulo é UTC-3.
      const now = new Date(localTime + "-03:00");
      vi.setSystemTime(now);

      const { _test_toSettlementTimestamp } = await import("../finance.service");
      const result = _test_toSettlementTimestamp(localDateInput);

      expect(result).toBe(expectedUtc);
    });

  });
});
