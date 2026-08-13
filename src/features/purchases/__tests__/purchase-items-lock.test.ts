/**
 * purchases.service · trava de itens após "recebida".
 *
 * Bug real (2026-08-13, auditoria de Compras): o gatilho que dá entrada no
 * estoque (apply_purchase_to_inventory) só roda UMA VEZ, na transição do
 * status para 'received' (guardado por stock_applied). Editar os itens
 * depois disso não tinha nenhum bloqueio — a compra mostrava números
 * novos, mas o estoque real continuava refletindo os itens antigos,
 * dessincronizando silenciosamente. Corrigido bloqueando a edição de itens
 * em compras já recebidas, tanto na tela quanto (aqui testado) no serviço.
 */
import { describe, it, expect, vi } from "vitest";

const statusByPurchaseId: Record<string, string> = {
  "p-received": "received",
  "p-pending": "pending",
};

vi.mock("@/integrations/supabase/client", () => {
  function purchasesQuery() {
    const q = {
      select() {
        return q;
      },
      eq(_col: string, id: string) {
        (q as any)._id = id;
        return q;
      },
      maybeSingle() {
        const id = (q as any)._id as string;
        return Promise.resolve({
          data: { status: statusByPurchaseId[id] ?? "draft" },
          error: null,
        });
      },
    };
    return q;
  }
  function purchaseItemsQuery() {
    return {
      delete() {
        return { eq: () => Promise.resolve({ error: null }) };
      },
      insert() {
        return Promise.resolve({ error: null });
      },
    };
  }
  return {
    supabase: {
      from(table: string) {
        if (table === "purchases") return purchasesQuery();
        if (table === "purchase_items") return purchaseItemsQuery();
        throw new Error(`unexpected table ${table} in this test`);
      },
    },
  };
});

vi.mock("@/services/supabase.service", () => ({
  updateRow: vi.fn(),
}));

import { purchasesService } from "../services/purchases.service";

describe("purchasesService.update · trava de itens após recebida", () => {
  it("rejeita editar itens de uma compra já recebida", async () => {
    await expect(
      purchasesService.update("p-received", {
        items: [{ product_id: "prod-1", quantity: 5, unit_price: 10, description: "x", discount: 0 } as any],
      }),
    ).rejects.toThrow(/já foi recebida/i);
  });

  it("permite editar itens de uma compra ainda pendente", async () => {
    await expect(
      purchasesService.update("p-pending", {
        items: [{ product_id: "prod-1", quantity: 5, unit_price: 10, description: "x", discount: 0 } as any],
      }),
    ).resolves.not.toThrow();
  });

  it("permite editar campos do cabeçalho de uma compra recebida, sem tocar em itens", async () => {
    await expect(
      purchasesService.update("p-received", { notes: "corrigindo observação" } as any),
    ).resolves.not.toThrow();
  });
});
