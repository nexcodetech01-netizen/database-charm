/**
 * Auditoria 4.1 (parte 3) — criação atômica de venda via RPC
 * `create_sale_with_items`, com fallback para o fluxo antigo quando a função
 * ainda não existe no banco.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc, from },
}));

import { salesService } from "../services/sales.service";

const COMPANY = "11111111-1111-4111-8111-111111111111";

function input() {
  return {
    company_id: COMPANY,
    number: "PDV-20261022-101010",
    status: "draft",
    customer_id: null,
    client_request_id: "aaaaaaaa-0000-4000-8000-000000000001",
    items: [
      { product_id: null, description: "Bolsa", quantity: 1, unit_price: 89.9, discount: 0 },
      { product_id: null, description: "Bolsa", quantity: 1, unit_price: 89.9, discount: 0 },
    ],
  } as never;
}

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

describe("salesService.create — RPC atômica", () => {
  it("grava venda + itens numa chamada só e devolve o número do banco", async () => {
    rpc.mockResolvedValue({ data: { id: "s1", number: "VD-20261022-0001" }, error: null });

    const sale = await salesService.create(input(), { origin: "pdv" });

    expect(sale).toMatchObject({ id: "s1", number: "VD-20261022-0001" });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("create_sale_with_items");
    expect(args._header).toMatchObject({
      company_id: COMPANY,
      client_request_id: "aaaaaaaa-0000-4000-8000-000000000001",
      customer_id: null,
    });
    expect(args._items).toHaveLength(2);
    // sale_id é definido pelo banco, nunca pelo navegador.
    expect(args._items[0]).not.toHaveProperty("sale_id");
    expect(args._items.map((r: { position: number }) => r.position)).toEqual([0, 1]);
    // Nenhum INSERT direto em tabelas.
    expect(from).not.toHaveBeenCalled();
  });

  it("número manual repetido vira mensagem clara", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "sales_company_id_number_key"',
      },
    });
    await expect(salesService.create(input(), { origin: "pdv" })).rejects.toThrow(
      /Já existe uma venda com o número/,
    );
    expect(from).not.toHaveBeenCalled();
  });

  it("erro do banco (ex.: estoque) é repassado sem cair no fluxo antigo", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Estoque insuficiente" },
    });
    await expect(salesService.create(input(), { origin: "pdv" })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });

  it("sem a função no banco (migration pendente) usa o fluxo antigo", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.create_sale_with_items",
      },
    });
    const single = vi
      .fn()
      .mockResolvedValue({ data: { id: "s9", number: "VD-20261022-0009" }, error: null });
    const insertSales = vi.fn(() => ({ select: () => ({ single }) }));
    const insertItems = vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [{ id: "i1" }, { id: "i2" }], error: null }),
    }));
    const check = vi.fn().mockResolvedValue({
      data: { id: "s9", number: "VD-20261022-0009", sale_items: [{ id: "i1" }, { id: "i2" }] },
      error: null,
    });
    from.mockImplementation((table: string) => {
      if (table === "sale_items") return { insert: insertItems };
      return {
        insert: insertSales,
        select: () => ({ eq: () => ({ maybeSingle: check }) }),
      };
    });

    const sale = await salesService.create(input(), { origin: "pdv" });
    expect(sale).toMatchObject({ id: "s9" });
    expect(insertSales).toHaveBeenCalledTimes(1);
    expect(insertItems).toHaveBeenCalledTimes(1);
  });
});
