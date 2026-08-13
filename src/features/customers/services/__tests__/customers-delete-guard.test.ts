/**
 * customersService.remove · trava contra excluir cliente com vendas.
 *
 * Bug real (2026-08-13, auditoria de Clientes): sales.customer_id,
 * credit_accounts.customer_id e financial_transactions.customer_id usam
 * ON DELETE SET NULL — sem esta checagem, excluir um cliente com
 * histórico de vendas não dava erro nenhum, só apagava silenciosamente
 * o cliente desses registros financeiros (mesma classe de bug corrigida
 * em Fornecedores).
 */
import { describe, it, expect, vi } from "vitest";

const salesCountByCustomer: Record<string, number> = {
  "c-with-sales": 3,
  "c-no-sales": 0,
};

vi.mock("@/integrations/supabase/client", () => {
  function salesQuery() {
    const q = {
      select() {
        return q;
      },
      eq(_col: string, id: string) {
        const count = salesCountByCustomer[id] ?? 0;
        return Promise.resolve({ count, error: null });
      },
    };
    return q;
  }
  function customersQuery() {
    return {
      delete() {
        return { eq: () => Promise.resolve({ error: null }) };
      },
    };
  }
  return {
    supabase: {
      from(table: string) {
        if (table === "sales") return salesQuery();
        if (table === "customers") return customersQuery();
        throw new Error(`unexpected table ${table} in this test`);
      },
    },
  };
});

vi.mock("@/services/supabase.service", () => ({ updateRow: vi.fn() }));

import { customersService } from "../customers.service";

describe("customersService.remove", () => {
  it("rejeita excluir cliente com vendas no histórico", async () => {
    await expect(customersService.remove("c-with-sales")).rejects.toThrow(/3 venda/);
  });

  it("permite excluir cliente sem nenhuma venda", async () => {
    await expect(customersService.remove("c-no-sales")).resolves.not.toThrow();
  });
});
