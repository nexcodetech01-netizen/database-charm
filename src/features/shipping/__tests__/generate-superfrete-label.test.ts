import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateSuperfreteLabel } from "../lib/generate-superfrete-label";
import type { GenerateLabelInput } from "../types";

const baseInput: GenerateLabelInput = {
  service_code: "1",
  sender: {
    name: "Loja Teste",
    document: "12345678900",
    postal_code: "17600000",
    address: "Rua A",
    number: "1",
    district: "Centro",
    city: "Tupã",
    state: "SP",
    phone: "14999999999",
  },
  recipient: {
    name: "Cliente Teste",
    document: "98765432100",
    postal_code: "01310000",
    address: "Rua B",
    number: "2",
    district: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    phone: "11988888888",
  },
  package_details: {
    cep_origem: "17600000",
    cep_destino: "01310000",
    peso_kg: 0.5,
    altura_cm: 10,
    largura_cm: 10,
    comprimento_cm: 10,
    format: "3",
    valor_declarado: 50,
  },
} as any;

describe("generateSuperfreteLabel", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, SUPERFRETE_TOKEN: "fake-token", SUPERFRETE_ENV: "sandbox" };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // Bug real (2026-08-18): a versão anterior fazia essa chamada via um
  // fetch HTTP da própria aplicação pra ela mesma (auto-chamada) numa
  // server function — o que sempre resolvia a URL errado (pensada pro
  // navegador, não pro servidor), e qualquer falha nessa auto-chamada
  // virava "Internal Server Error" genérico, escondendo a mensagem
  // real do Superfrete. Chamando essa função direto, o erro real do
  // Superfrete chega até o usuário.
  it("lança o erro real do Superfrete quando o carrinho falha (não um erro genérico)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({ message: "CEP de destino inválido" }),
    } as any);

    await expect(generateSuperfreteLabel(baseInput)).rejects.toThrow("CEP de destino inválido");
  });

  it("lança erro claro quando SUPERFRETE_TOKEN não está configurado", async () => {
    delete process.env.SUPERFRETE_TOKEN;
    await expect(generateSuperfreteLabel(baseInput)).rejects.toThrow("SUPERFRETE_TOKEN not configured");
  });

  it("retorna sucesso com a etiqueta quando tudo funciona", async () => {
    global.fetch = vi
      .fn()
      // 1. cart
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: "cart-123" }),
      } as any)
      // 2. checkout
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ order_id: "order-456", tracking_code: "BR123456789" }),
      } as any)
      // 3. tag/print
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ url: "https://superfrete.example/label.pdf" }),
      } as any);

    const result = await generateSuperfreteLabel(baseInput);
    expect(result.success).toBe(true);
    expect(result.order_id).toBe("order-456");
    expect(result.tracking_code).toBe("BR123456789");
    expect(result.label_url).toBe("https://superfrete.example/label.pdf");
  });

  it("não faz nenhuma chamada de rede pra própria aplicação (sem auto-fetch)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "{}",
    } as any);
    global.fetch = fetchMock;

    await generateSuperfreteLabel(baseInput).catch(() => {});

    for (const call of fetchMock.mock.calls) {
      const url = String(call[0]);
      expect(url).not.toContain("/api/public/shipping/labels");
    }
  });
});
