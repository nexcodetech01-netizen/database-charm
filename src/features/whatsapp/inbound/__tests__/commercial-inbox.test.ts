/**
 * Sprint 6.8 — Etapa 2: Inbox Comercial.
 * Nenhum motor oficial é chamado: sem venda, orçamento, estoque,
 * financeiro ou CRM — apenas a tabela do inbox.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMMERCIAL_HANDOFF_MESSAGE,
  COMMERCIAL_INBOX_STATUS,
  buildCommercialTicketDraft,
  formatDeliveryLine,
  isConfirmationIntent,
} from "../commercial-inbox";
import {
  findOpenTicket,
  handleCommercialConfirmationTurn,
  upsertCommercialTicket,
} from "../commercial-inbox.server";
import { createCheckoutSession, type CheckoutSession } from "../checkout-session";
import { resetCheckoutSessions, saveCheckoutSession } from "../checkout-session.server";
import { addProduct, createCartSession, type CartSession } from "../cart-session";
import { getCartSession, resetCartSessions, saveCartSession } from "../cart-session.server";

function summarySession(over: Partial<CheckoutSession> = {}): CheckoutSession {
  return {
    ...createCheckoutSession("co", "5511", 1000),
    step: "summary",
    buyerName: "Maria",
    fulfillment: "delivery",
    delivery: {
      city: "Recife",
      neighborhood: "Boa Viagem",
      address: "Rua A, 100",
      complement: null,
    },
    payment: "pix",
    ...over,
  };
}

function cartWith(qty = 2): CartSession {
  return addProduct(
    createCartSession("co", "5511", 1000),
    { id: "p1", name: "Bolsa", price: 200, brand: null, categoryId: null, unit: "un" },
    qty,
    1000,
  );
}

/** Fake mínimo da tabela `whatsapp_commercial_inbox`. */
function makeDb(seed: any[] = []) {
  const rows = [...seed];
  const calls: string[] = [];
  const db = {
    rows,
    calls,
    from(table: string) {
      calls.push(table);
      const state: any = { filters: {}, op: "select", patch: null, insert: null };
      const q: any = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          state.filters[col] = val;
          return q;
        },
        maybeSingle: async () => ({
          data: rows.find((r) => matches(r, state.filters)) ?? null,
        }),
        single: async () => ({ data: state.inserted ?? null }),
        insert: (payload: any) => {
          const row = { id: `t${rows.length + 1}`, ...payload };
          rows.push(row);
          state.inserted = row;
          return q;
        },
        update: (patch: any) => {
          state.patch = patch;
          state.isUpdate = true;
          return {
            eq: (col: string, val: unknown) => {
              const row = rows.find((r) => r[col] === val);
              if (row) Object.assign(row, patch);
              return Promise.resolve({ data: row ?? null });
            },
          };
        },
      };
      return q;
    },
  };
  function matches(row: any, filters: Record<string, unknown>) {
    return Object.entries(filters).every(([k, v]) => row[k] === v);
  }
  return db;
}

describe("isConfirmationIntent", () => {
  it.each(["sim", "confirmo", "está certo", "pode finalizar", "ok", "confirmado"])(
    "reconhece '%s'",
    (t) => expect(isConfirmationIntent(t)).toBe(true),
  );

  it("ignora respostas negativas ou vazias", () => {
    expect(isConfirmationIntent("não")).toBe(false);
    expect(isConfirmationIntent("")).toBe(false);
  });
});

describe("buildCommercialTicketDraft", () => {
  it("monta o snapshot do pedido com status aguardando", () => {
    const draft = buildCommercialTicketDraft({
      session: summarySession(),
      cart: cartWith(2),
      now: 1000,
    });
    expect(draft).toMatchObject({
      companyId: "co",
      phone: "5511",
      buyerName: "Maria",
      itemCount: 2,
      total: 400,
      fulfillment: "delivery",
      payment: "pix",
      origin: "whatsapp",
      status: COMMERCIAL_INBOX_STATUS.waiting,
    });
    expect(draft.items).toHaveLength(1);
    expect(formatDeliveryLine(draft)).toBe("Rua A, 100, Boa Viagem, Recife");
  });

  it("retirada não gera linha de endereço", () => {
    const draft = buildCommercialTicketDraft({
      session: summarySession({ fulfillment: "pickup" }),
      cart: cartWith(1),
    });
    expect(formatDeliveryLine(draft)).toBe("");
  });
});

describe("upsertCommercialTicket", () => {
  it("cria um novo atendimento", async () => {
    const db = makeDb();
    const draft = buildCommercialTicketDraft({ session: summarySession(), cart: cartWith() });
    const out = await upsertCommercialTicket(db as never, draft);
    expect(out.created).toBe(true);
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]!.status).toBe(COMMERCIAL_INBOX_STATUS.waiting);
  });

  it("atualiza o atendimento aberto em vez de duplicar", async () => {
    const db = makeDb([
      {
        id: "t1",
        company_id: "co",
        phone: "5511",
        status: COMMERCIAL_INBOX_STATUS.waiting,
        item_count: 1,
        total: 200,
      },
    ]);
    const draft = buildCommercialTicketDraft({ session: summarySession(), cart: cartWith(3) });
    const out = await upsertCommercialTicket(db as never, draft);
    expect(out).toEqual({ id: "t1", created: false });
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]!.item_count).toBe(3);
    expect(db.rows[0]!.total).toBe(600);
  });

  it("atendimento cancelado/atendido não bloqueia um novo", async () => {
    const db = makeDb([
      {
        id: "t1",
        company_id: "co",
        phone: "5511",
        status: COMMERCIAL_INBOX_STATUS.cancelled,
      },
    ]);
    expect(await findOpenTicket(db as never, "co", "5511")).toBeNull();
    const draft = buildCommercialTicketDraft({ session: summarySession(), cart: cartWith() });
    const out = await upsertCommercialTicket(db as never, draft);
    expect(out.created).toBe(true);
    expect(db.rows).toHaveLength(2);
  });
});

describe("handleCommercialConfirmationTurn", () => {
  beforeEach(() => {
    resetCheckoutSessions();
    resetCartSessions();
  });

  function prepare(now = Date.now()) {
    saveCheckoutSession(summarySession({ createdAt: now, updatedAt: now }));
    saveCartSession(
      addProduct(
        getCartSession("co", "5511", now),
        { id: "p1", name: "Bolsa", price: 200, brand: null, categoryId: null, unit: "un" },
        2,
        now,
      ),
    );
  }

  it("encaminha o pedido e responde a mensagem oficial", async () => {
    prepare();
    const db = makeDb();
    const out = await handleCommercialConfirmationTurn({
      db: db as never,
      companyId: "co",
      phone: "5511",
      text: "confirmo",
    });
    expect(out?.text).toBe(COMMERCIAL_HANDOFF_MESSAGE);
    expect(out?.created).toBe(true);
    expect(db.calls).toEqual(["whatsapp_commercial_inbox", "whatsapp_commercial_inbox"]);
    // nenhum motor oficial: só a tabela do inbox foi tocada
    expect(db.calls.every((t) => t === "whatsapp_commercial_inbox")).toBe(true);
    // carrinho efêmero é limpo após o encaminhamento
    expect(getCartSession("co", "5511").items).toHaveLength(0);
  });

  it("não duplica quando já existe atendimento aberto", async () => {
    prepare();
    const db = makeDb([
      {
        id: "t1",
        company_id: "co",
        phone: "5511",
        status: COMMERCIAL_INBOX_STATUS.waiting,
      },
    ]);
    const out = await handleCommercialConfirmationTurn({
      db: db as never,
      companyId: "co",
      phone: "5511",
      text: "está certo",
    });
    expect(out?.created).toBe(false);
    expect(db.rows).toHaveLength(1);
  });

  it("ignora mensagens que não são confirmação", async () => {
    prepare();
    const db = makeDb();
    const out = await handleCommercialConfirmationTurn({
      db: db as never,
      companyId: "co",
      phone: "5511",
      text: "quero mudar o endereço",
    });
    expect(out).toBeNull();
    expect(db.rows).toHaveLength(0);
  });

  it("ignora quando não há resumo aguardando confirmação", async () => {
    const db = makeDb();
    const out = await handleCommercialConfirmationTurn({
      db: db as never,
      companyId: "co",
      phone: "5511",
      text: "sim",
    });
    expect(out).toBeNull();
  });

  it("ignora carrinho vazio", async () => {
    saveCheckoutSession(summarySession());
    const db = makeDb();
    const out = await handleCommercialConfirmationTurn({
      db: db as never,
      companyId: "co",
      phone: "5511",
      text: "ok",
    });
    expect(out).toBeNull();
    expect(db.rows).toHaveLength(0);
  });

  it("nunca chama create_sale nem outra tabela do ERP", async () => {
    prepare();
    const db = makeDb();
    const rpc = vi.fn();
    await handleCommercialConfirmationTurn({
      db: { ...db, rpc } as never,
      companyId: "co",
      phone: "5511",
      text: "confirmado",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(db.calls).not.toContain("sales");
    expect(db.calls).not.toContain("inventory_movements");
    expect(db.calls).not.toContain("financial_transactions");
  });
});
