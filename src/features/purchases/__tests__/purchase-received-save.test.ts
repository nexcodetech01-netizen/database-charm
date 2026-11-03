/**
 * Compra recebida + Salvar com os mesmos itens: não pode apagar/inserir
 * itens (o RLS bloqueia e duplicaria as peças). Só o cabeçalho é salvo.
 */
import { describe, it, expect, vi } from "vitest";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000001";
const calls = { del: 0, ins: 0 };

vi.mock("@/integrations/supabase/client", () => {
  function purchasesQuery() {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: () =>
        Promise.resolve({ data: { status: "received", company_id: "c1" }, error: null }),
    };
    return q;
  }
  function purchaseItemsQuery() {
    return {
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [{ product_id: PRODUCT_ID, quantity: 23, unit_price: 23.9, discount: 0 }],
            error: null,
          }),
      }),
      delete: () => {
        calls.del++;
        return { eq: () => Promise.resolve({ error: null }) };
      },
      insert: () => {
        calls.ins++;
        return Promise.resolve({ error: { message: "new row violates row-level security policy" } });
      },
    };
  }
  return {
    supabase: {
      from: (t: string) => (t === "purchases" ? purchasesQuery() : purchaseItemsQuery()),
    },
  };
});

const updateRow = vi.fn(async (_t: string, id: string, patch: Record<string, unknown>) => ({
  id,
  status: "received",
  ...patch,
}));
vi.mock("@/services/supabase.service", () => ({
  updateRow: (...a: unknown[]) => updateRow(...(a as [string, string, Record<string, unknown>])),
}));

import { purchasesService } from "../services/purchases.service";
import { describeSaveError } from "../components/purchase-form";

describe("salvar compra recebida", () => {
  it("salva o cabeçalho sem regravar os itens", async () => {
    await purchasesService.update("p1", {
      status: "received",
      shipping: 32.72,
      items: [
        { product_id: PRODUCT_ID, quantity: 23, unit_price: 23.9, description: "x", discount: 0 } as any,
      ],
    } as any);
    expect(calls.del).toBe(0);
    expect(calls.ins).toBe(0);
    expect(updateRow).toHaveBeenCalledTimes(1);
  });

  it("mostra o motivo real de erros do Supabase", () => {
    expect(describeSaveError({ message: "boom", code: "P0001" })).toBe("boom (código P0001)");
    expect(describeSaveError({ message: "new row violates row-level security policy" })).toMatch(
      /não permitiu/,
    );
    expect(describeSaveError(null)).toMatch(/desconhecido/);
  });
});

describe("número de compra repetido", () => {
  it("explica o erro em português", () => {
    expect(
      describeSaveError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "purchases_company_id_number_key"',
      }),
    ).toMatch(/Já existe uma compra com este número/);
  });
});
