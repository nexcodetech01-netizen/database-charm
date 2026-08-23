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

  // Bug real (2026-08-18): a estrutura REAL de erro da Superfrete pra
  // "nenhuma opção válida encontrada" (geralmente dimensão abaixo do
  // mínimo) é um 400 com um objeto `errors` aninhado, chave por tipo
  // de erro — não um item individual com campo `error` como eu tinha
  // suposto antes. A versão anterior mostrava só a mensagem genérica
  // da raiz ("Ocorreu um ou mais erros."), escondendo o motivo real.
  it("extrai as mensagens específicas de dentro do objeto 'errors' aninhado (formato real da Superfrete)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          errors: {
            "freight.calculator.no_result": ["Nenhum frete válido encontrado para esse serviço."],
          },
          message: "Ocorreu um ou mais erros.",
        }),
    } as any);

    const result = await calculateSuperfreteShipping(baseInput);
    expect(result.options).toEqual([]);
    expect(result.errors).toEqual(["Nenhum frete válido encontrado para esse serviço."]);
  });

  it("junta mensagens de múltiplas chaves do objeto 'errors' aninhado", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          errors: {
            "freight.calculator.no_result": ["Largura mínima 11 cm."],
            "freight.calculator.weight": ["Peso mínimo 0.3kg."],
          },
          message: "Ocorreu um ou mais erros.",
        }),
    } as any);

    const result = await calculateSuperfreteShipping(baseInput);
    expect(result.errors).toEqual(["Largura mínima 11 cm.", "Peso mínimo 0.3kg."]);
  });

  it("continua lançando exceção pra erros que não têm o objeto 'errors' aninhado (ex.: token inválido)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: "Token inválido." }),
    } as any);

    await expect(calculateSuperfreteShipping(baseInput)).rejects.toThrow("Token inválido.");
  });

  // ATUALIZADO (2026-08-23): a API do Superfrete passou a EXIGIR o
  // campo `services` (erro "(services) é obrigatório" quando
  // omitido) — diferente de quando esse teste foi escrito, quando
  // omitir funcionava. A correção certa agora é usar uma lista AMPLA
  // de transportadoras (não a antiga travada em só 3: "1,2,17"), não
  // omitir o campo inteiro.
  it("usa uma lista ampla de transportadoras, não mais a antiga travada em só 3 (\"1,2,17\")", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([]),
    } as any);
    global.fetch = fetchMock;

    await calculateSuperfreteShipping(baseInput);

    const [, options] = fetchMock.mock.calls[0];
    const sentPayload = JSON.parse(options.body);
    expect(sentPayload.services).not.toBe("1,2,17");
    expect(sentPayload.services.split(",").length).toBeGreaterThan(3);
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
