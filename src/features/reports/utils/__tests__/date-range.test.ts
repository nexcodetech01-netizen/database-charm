/**
 * date-range · rangeToTimestamp — correção de fuso horário.
 *
 * Bug real (2026-08-13, auditoria de Relatórios): o limite de "hoje"
 * usava sufixo "Z" (UTC) em cima de uma data que representa o calendário
 * local (Brasil, UTC-3). Meia-noite UTC é 21h da noite anterior aqui —
 * vendas feitas depois das ~21h ficavam de fora do relatório de "hoje" e
 * só apareciam no dia seguinte; dados da noite anterior vazavam para
 * "hoje". Mesmo padrão de bug encontrado em bi/executive-panel.service.ts
 * e kpi-center/services/kpi-center.service.ts, corrigidos junto.
 */
import { describe, it, expect } from "vitest";
import { rangeToTimestamp } from "../date-range";

describe("rangeToTimestamp", () => {
  it("o limite final do dia cobre até 23:59:59 no horário do Brasil, não em UTC", () => {
    const { toTs } = rangeToTimestamp({ preset: "today", from: "2026-08-13", to: "2026-08-13" });
    // Uma venda às 22h (horário de Brasília) do dia 13 deve estar DENTRO do
    // intervalo de "hoje" — antes da correção, o limite parava às 20:59:59
    // (BRT), deixando essa venda de fora.
    const saleAt22hBRT = new Date("2026-08-14T01:00:00.000Z"); // 22h BRT (UTC-3) do dia 13
    expect(saleAt22hBRT.getTime()).toBeLessThanOrEqual(new Date(toTs).getTime());
  });

  it("o limite inicial do dia não inclui a noite do dia anterior (Brasil)", () => {
    const { fromTs } = rangeToTimestamp({ preset: "today", from: "2026-08-13", to: "2026-08-13" });
    // Uma venda às 22h (horário de Brasília) do dia 12 (véspera) NÃO deve
    // estar dentro do intervalo de "hoje" (13) — antes da correção, o
    // limite começava às 21:00:00 (BRT) do dia 12, incluindo-a incorretamente.
    const saleAt22hBRTDayBefore = new Date("2026-08-13T01:00:00.000Z"); // 22h BRT do dia 12
    expect(saleAt22hBRTDayBefore.getTime()).toBeLessThan(new Date(fromTs).getTime());
  });

  it("o intervalo de 'hoje' corresponde exatamente às 00:00–23:59:59.999 no horário do Brasil", () => {
    const { fromTs, toTs } = rangeToTimestamp({ preset: "today", from: "2026-08-13", to: "2026-08-13" });
    expect(fromTs).toBe(new Date("2026-08-13T03:00:00.000Z").toISOString());
    expect(toTs).toBe(new Date("2026-08-14T02:59:59.999Z").toISOString());
  });
});
