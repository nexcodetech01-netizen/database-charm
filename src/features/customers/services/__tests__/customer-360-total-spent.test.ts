/**
 * customer360Service.get · consistência de "total gasto" com vendas
 * parcialmente pagas.
 *
 * Bug real (2026-08-13, auditoria de Clientes): totalSpent/paidCount/
 * averageTicket só contavam vendas com status exatamente "paid",
 * enquanto purchaseCount/lastPurchaseAt já contavam "partially_paid"
 * como atividade real do cliente. Um cliente fiel que sempre compra no
 * crediário aparecia com "total gasto" bem menor do que realmente
 * gastou, podendo até deixar de ser classificado como VIP por isso.
 */
import { describe, it, expect, vi } from "vitest";

const NOW_ISO = "2026-08-13T12:00:00Z";

function sale(over: Partial<{ id: string; status: string; grand_total: number; sale_date: string; paid_at: string | null; created_at: string }>) {
  return {
    id: "s1",
    number: "V-1",
    status: "paid",
    payment_method: "pix",
    grand_total: 100,
    sale_date: "2026-08-01",
    paid_at: "2026-08-01T10:00:00Z",
    created_at: "2026-08-01T10:00:00Z",
    ...over,
  };
}

vi.mock("@/integrations/supabase/client", () => {
  const sales = [
    sale({ id: "s1", status: "paid", grand_total: 100 }),
    sale({ id: "s2", status: "partially_paid", grand_total: 200 }),
    sale({ id: "s3", status: "cancelled", grand_total: 500 }),
  ];
  function customersQuery() {
    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle() {
        return Promise.resolve({
          data: { id: "cust-1", name: "Cliente Fiel", created_at: "2020-01-01", segment: null, birth_date: null },
          error: null,
        });
      },
    };
  }
  function salesQuery() {
    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      order() {
        return Promise.resolve({ data: sales, error: null });
      },
    };
  }
  function emptyListQuery() {
    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      in() {
        return Promise.resolve({ data: [], error: null });
      },
    };
  }
  return {
    supabase: {
      from(table: string) {
        if (table === "customers") return customersQuery();
        if (table === "sales") return salesQuery();
        return emptyListQuery();
      },
    },
  };
});

import { customer360Service } from "../customer-360.service";

describe("customer360Service.get · total gasto inclui parcialmente pagas", () => {
  it("soma vendas pagas e parcialmente pagas no total gasto (ignora canceladas)", async () => {
    const result = await customer360Service.get("cust-1");
    expect(result).not.toBeNull();
    // 100 (paid) + 200 (partially_paid) = 300 — a de 500 (cancelled) fica de fora.
    expect(result!.totalSpent).toBe(300);
    expect(result!.paidCount).toBe(2);
    expect(result!.averageTicket).toBe(150);
  });
});
