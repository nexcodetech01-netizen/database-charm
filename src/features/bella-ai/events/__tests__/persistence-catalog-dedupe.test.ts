/**
 * Bug 2026-10-24: "Novo pedido do catálogo" voltava a cada atualização porque
 * a notificação já lida era recriada. Pedido do catálogo nunca é recriado.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  inserted: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/integrations/supabase/client.server", () => {
  function query() {
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    const q: any = {
      select: () => q,
      eq: (col: string, val: unknown) => (filters.push((r) => r[col] === val), q),
      is: (col: string, val: unknown) => (filters.push((r) => (r[col] ?? null) === val), q),
      gt: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: db.rows.find((r) => filters.every((f) => f(r))) ?? null }),
      insert: (row: Record<string, unknown>) => {
        db.inserted.push(row);
        return {
          select: () => ({ single: async () => ({ data: { id: "new", ...row }, error: null }) }),
        };
      },
    };
    return q;
  }
  return { supabaseAdmin: { from: () => query() } };
});

import { persistNotification } from "../persistence.server";

const base = {
  companyId: "co-1",
  eventType: "catalog.order.received",
  title: "Novo pedido do catálogo",
  message: "Um novo pedido foi recebido via integração externa.",
  referenceId: "10",
};

describe("persistNotification — pedido do catálogo", () => {
  beforeEach(() => {
    db.rows = [];
    db.inserted = [];
  });

  it("não recria notificação de pedido já LIDO", async () => {
    db.rows = [
      {
        id: "n1",
        company_id: "co-1",
        event_type: "catalog.order.received",
        reference_id: "10",
        status: "read",
      },
    ];
    const res = await persistNotification(base);
    expect(db.inserted).toHaveLength(0);
    expect(res).toMatchObject({ id: "n1" });
  });

  it("cria na primeira vez", async () => {
    await persistNotification(base);
    expect(db.inserted).toHaveLength(1);
  });

  it("outros tipos de evento continuam podendo notificar de novo", async () => {
    db.rows = [
      {
        id: "n2",
        company_id: "co-1",
        event_type: "whatsapp.message.received",
        reference_id: "conv-1",
        status: "read",
      },
    ];
    await persistNotification({
      ...base,
      eventType: "whatsapp.message.received",
      referenceId: "conv-1",
    });
    expect(db.inserted).toHaveLength(1);
  });
});
