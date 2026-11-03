/** Falha depois do cabeçalho: a compra recém-criada é apagada. */
import { describe, it, expect, vi } from "vitest";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000001";
const COMPANY_ID = "00000000-0000-4000-8000-0000000000c1";
const deleted: string[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => ({
      insert: () =>
        t === "purchases"
          ? { select: () => ({ single: () => Promise.resolve({ data: { id: "new-1" }, error: null }) }) }
          : Promise.resolve({ error: null }),
      delete: () => ({
        eq: (_c: string, v: string) => {
          deleted.push(`${t}:${v}`);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));
vi.mock("@/services/supabase.service", () => ({
  updateRow: vi.fn(async () => {
    throw { message: "trigger falhou", code: "P0001" };
  }),
}));

import { purchasesService } from "../services/purchases.service";

describe("purchasesService.create · desfaz em caso de erro", () => {
  it("apaga a compra se marcar como recebida falhar", async () => {
    await expect(
      purchasesService.create({
        company_id: COMPANY_ID,
        number: "PC-1",
        supplier_id: "00000000-0000-4000-8000-0000000000a1",
        status: "received",
        items: [{ product_id: PRODUCT_ID, quantity: 1, unit_price: 10, description: "x", discount: 0 } as any],
      } as any),
    ).rejects.toMatchObject({ message: "trigger falhou" });
    expect(deleted).toEqual(["purchase_items:new-1", "purchases:new-1"]);
  });
});
