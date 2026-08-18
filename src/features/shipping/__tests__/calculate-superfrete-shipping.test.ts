import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateSuperfreteShipping } from "../lib/calculate-superfrete-shipping";
import type { ShippingCalculatorInput } from "../types";

const baseInput: ShippingCalculatorInput = {
  cep_origem: "17607100",
  cep_destino: "17607100",
  peso_kg: 0.1,
  altura_cm: 1,
  largura_cm: 5,
  comprimento_cm: 5,
  format: "3",
  valor_declarado: 0,
};

describe("calculateSuperfreteShipping", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, SUPERFRETE_TOKEN: "fake-token", SUPERFRETE_ENV: "sandbox" };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // Bug real (2026-08-18): opções recusadas pelo Superfrete (ex.:
  // dimensão abaixo do mínimo aceito) eram descartadas em silêncio —
  // o usuário via só as opções que "deram certo", sem saber que
  // outras foram recusadas nem o motivo (ex.: "Largura mínima 11 cm").
  it("coleta erros de opções recusadas em vez de descartar em silêncio", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          { id: 1, name: "PAC", price: "18.91", delivery_time: 5 },
          { error: true, error_message: "Largura mínima 11 cm." },
        ]),
    } as any);

    const result = await calculateSuperfreteShipping(baseInput);
    expect(result.options).toHaveLength(1);
    expect(result.options[0].servico).toBe("PAC");
    expect(result.errors).toEqual(["Largura mínima 11 cm."]);
  });

  it("não trava a lista de transportadoras (não envia 'services' fixo)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([]),
    } as any);
    global.fetch = fetchMock;

    await calculateSuperfreteShipping(baseInput);

    const [, options] = fetchMock.mock.calls[0];
    const sentPayload = JSON.parse(options.body);
    expect(sentPayload.services).toBeUndefined();
  });

  it("lança erro claro quando SUPERFRETE_TOKEN não está configurado", async () => {
    delete process.env.SUPERFRETE_TOKEN;
    await expect(calculateSuperfreteShipping(baseInput)).rejects.toThrow(
      "SUPERFRETE_TOKEN not configured",
    );
  });

  it("retorna todas as opções sem erro quando tudo funciona", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          { id: 1, name: "PAC", price: "18.91", delivery_time: 5 },
          { id: 2, name: "SEDEX", price: "12.16", delivery_time: 1 },
        ]),
    } as any);

    const result = await calculateSuperfreteShipping(baseInput);
    expect(result.options).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });
});
