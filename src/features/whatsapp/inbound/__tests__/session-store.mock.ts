/**
 * Mock em memória de `supabaseAdmin`, usado nos testes de carrinho e
 * fechamento do WhatsApp desde que essas sessões passaram a ser
 * persistidas em tabela (2026-08-15) em vez de um `Map` em memória.
 * Simula só o suficiente das duas tabelas de sessão (select/upsert/
 * delete por company_id+phone) para os testes existentes continuarem
 * funcionando sem precisar de um banco de verdade.
 */

type Row = { company_id: string; phone: string; session_data: unknown; updated_at: string };

const stores: Record<string, Map<string, Row>> = {
  whatsapp_cart_sessions: new Map(),
  whatsapp_checkout_sessions: new Map(),
};

function rowKey(companyId: string, phone: string): string {
  return `${companyId}:${phone}`;
}

export function resetSessionMockStores(): void {
  stores.whatsapp_cart_sessions.clear();
  stores.whatsapp_checkout_sessions.clear();
}

function tableApi(table: string) {
  const store = stores[table];
  if (!store) throw new Error(`unmocked table ${table} in session mock`);

  const filters: { companyId?: string; phone?: string } = {};
  let mode: "select" | "delete" | null = null;

  const api: any = {
    select() {
      mode = "select";
      return api;
    },
    delete() {
      mode = "delete";
      return api;
    },
    eq(col: string, value: string) {
      if (col === "company_id") filters.companyId = value;
      if (col === "phone") filters.phone = value;
      return api;
    },
    async neq() {
      store.clear();
      return { data: null, error: null };
    },
    async maybeSingle() {
      if (filters.companyId == null || filters.phone == null) return { data: null, error: null };
      const key = rowKey(filters.companyId, filters.phone);
      if (mode === "delete") {
        store.delete(key);
        return { data: null, error: null };
      }
      return { data: store.get(key) ?? null, error: null };
    },
    async upsert(row: Row) {
      store.set(rowKey(row.company_id, row.phone), row);
      return { data: row, error: null };
    },
    // `.delete().eq(...).eq(...)` (sem `.maybeSingle()` no final) — usado
    // por dropCartSession/dropCheckoutSession. Resolve como uma Promise
    // (o código real só faz `await supabaseAdmin.from(...).delete().eq().eq()`,
    // sem encadear mais nada).
    then(resolve: (v: { data: null; error: null }) => void) {
      if (mode === "delete" && filters.companyId != null && filters.phone != null) {
        store.delete(rowKey(filters.companyId, filters.phone));
      }
      resolve({ data: null, error: null });
    },
  };

  return api;
}

export const supabaseAdminMock = {
  from: (table: string) => tableApi(table),
};
