/** Editar compra: se gravar os itens novos falhar, os antigos voltam. */
import { describe, it, expect, vi } from "vitest";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000001";
const OLD = [{ purchase_id: "p1", product_id: PRODUCT_ID, description: "velho", quantity: 2, unit_price: 5, discount: 0, total: 10, position: 0 }];
const inserts: unknown[][] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => {
      if (t === "purchases") {
        const q = { select: () => q, eq: () => q, maybeSingle: () => Promise.resolve({ data: { status: "pending", company_id: "c" }, error: null }) };
        return q;
      }
      return {
        select: () => ({ eq: () => Promise.resolve({ data: OLD, error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        insert: (rows: unknown[]) => {
          inserts.push(rows);
          return Promise.resolve({ error: inserts.length === 1 ? { message: "falhou" } : null });
        },
      };
    },
  },
}));
vi.mock("@/services/supabase.service", () => ({ updateRow: vi.fn() }));

import { purchasesService } from "../services/purchases.service";

describe("purchasesService.update · itens", () => {
  it("devolve os itens antigos se a gravação dos novos falhar", async () => {
    await expect(
      purchasesService.update("p1", {
        items: [{ product_id: PRODUCT_ID, quantity: 3, unit_price: 5, description: "novo", discount: 0 } as any],
      } as any),
    ).rejects.toMatchObject({ message: "falhou" });
    expect(inserts.length).toBe(2);
    expect(inserts[1]).toEqual(OLD);
  });
});
