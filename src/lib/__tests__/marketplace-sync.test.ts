import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const integrationFetch = vi.fn();
const ensureFreshAccessToken = vi.fn();
const decryptToken = vi.fn(() => "TOKEN");
const recordDeadLetter = vi.fn();

vi.mock("@/lib/http-client.server", () => ({
  integrationFetch: (url: unknown, init: unknown, opts?: unknown) => integrationFetch(url, init, opts),
}));
vi.mock("@/lib/mercadolivre.server", () => ({
  ensureFreshAccessToken: (...args: unknown[]) => ensureFreshAccessToken(args),
}));
vi.mock("@/lib/meta-crypto.server", () => ({
  decryptToken: (value: unknown) => decryptToken(),
}));
vi.mock("@/lib/dead-letter.server", () => ({
  recordDeadLetter: (input: unknown) => recordDeadLetter(input),
}));

interface QueueRow {
  id: string;
  company_id: string;
  product_id: string;
  marketplace: string;
  attempts: number;
  status?: string;
  last_error?: string | null;
}

const queueUpdates: Array<Record<string, unknown>> = [];
let queueRows: QueueRow[] = [];
let productRow: Record<string, unknown> | null = null;
let integrationRow: Record<string, unknown> | null = null;

function makeClient() {
  const client = {
    from(table: string) {
      if (table === "marketplace_sync_queue") {
        const builder: Record<string, unknown> = {};
        const chain = () => builder;
        Object.assign(builder, {
          select: chain,
          eq: chain,
          order: chain,
          limit: () => Promise.resolve({ data: queueRows, error: null }),
          update(payload: Record<string, unknown>) {
            queueUpdates.push(payload);
            return { eq: () => Promise.resolve({ error: null }) };
          },
        });
        return builder;
      }
      if (table === "products") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: productRow, error: null }) }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: integrationRow, error: null }) }),
        }),
      };
    },
  };
  return client;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return makeClient();
  },
}));

beforeEach(() => {
  queueUpdates.length = 0;
  queueRows = [];
  productRow = {
    id: "p1",
    company_id: "c1",
    price: 100,
    stock: 7,
    ml_item_id: "MLB123",
  };
  integrationRow = { access_token_encrypted: "enc", token_expires_at: null };
  integrationFetch.mockReset();
  ensureFreshAccessToken.mockReset();
  recordDeadLetter.mockReset();
});

afterEach(() => vi.restoreAllMocks());

async function core() {
  return await import("@/lib/marketplace-sync.server");
}

describe("syncProductToMercadoLivreCore", () => {
  it("envia estoque e preço para o anúncio", async () => {
    integrationFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "{}" });
    const { syncProductToMercadoLivreCore } = await core();
    const out = await syncProductToMercadoLivreCore(makeClient(), { productId: "p1" });
    expect(out.ok).toBe(true);
    const body = JSON.parse((integrationFetch.mock.calls[0]![1] as { body: string }).body);
    expect(body.available_quantity).toBe(7);
    expect(body.price).toBe(100);
  });

  it("ignora produto sem anúncio no Mercado Livre", async () => {
    productRow = { id: "p1", company_id: "c1", price: 10, stock: 1, ml_item_id: null };
    const { syncProductToMercadoLivreCore } = await core();
    const out = await syncProductToMercadoLivreCore(makeClient(), { productId: "p1" });
    expect(out).toEqual({ ok: true, skipped: "no-ml-item" });
    expect(integrationFetch).not.toHaveBeenCalled();
  });

  it("não lança quando o provedor rejeita", async () => {
    integrationFetch.mockResolvedValue({ ok: false, status: 401, text: async () => "invalid" });
    const { syncProductToMercadoLivreCore } = await core();
    const out = await syncProductToMercadoLivreCore(makeClient(), { productId: "p1" });
    expect(out.ok).toBe(false);
  });

  it("estoque negativo é normalizado para zero", async () => {
    productRow = { id: "p1", company_id: "c1", price: 10, stock: -3, ml_item_id: "MLB1" };
    integrationFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "{}" });
    const { syncProductToMercadoLivreCore } = await core();
    await syncProductToMercadoLivreCore(makeClient(), { productId: "p1" });
    const body = JSON.parse((integrationFetch.mock.calls[0]![1] as { body: string }).body);
    expect(body.available_quantity).toBe(0);
  });
});

describe("drainMarketplaceSyncQueue", () => {
  it("marca como done quando sincroniza", async () => {
    queueRows = [{ id: "q1", company_id: "c1", product_id: "p1", marketplace: "mercadolivre", attempts: 0 }];
    integrationFetch.mockResolvedValue({ ok: true, status: 200, text: async () => "{}" });
    const { drainMarketplaceSyncQueue } = await core();
    const summary = await drainMarketplaceSyncQueue();
    expect(summary).toMatchObject({ processed: 1, synced: 1, failed: 0 });
    expect(queueUpdates.at(-1)).toMatchObject({ status: "done" });
  });

  it("devolve para pending permitindo nova tentativa", async () => {
    queueRows = [{ id: "q1", company_id: "c1", product_id: "p1", marketplace: "mercadolivre", attempts: 1 }];
    integrationFetch.mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    const { drainMarketplaceSyncQueue } = await core();
    const summary = await drainMarketplaceSyncQueue();
    expect(summary.failed).toBe(1);
    expect(queueUpdates.at(-1)).toMatchObject({ status: "pending", attempts: 2 });
    expect(recordDeadLetter).not.toHaveBeenCalled();
  });

  it("esgota tentativas, marca erro e registra dead letter", async () => {
    queueRows = [{ id: "q1", company_id: "c1", product_id: "p1", marketplace: "mercadolivre", attempts: 4 }];
    integrationFetch.mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    const { drainMarketplaceSyncQueue } = await core();
    await drainMarketplaceSyncQueue();
    expect(queueUpdates.at(-1)).toMatchObject({ status: "error", attempts: 5 });
    expect(recordDeadLetter).toHaveBeenCalledTimes(1);
  });

  it("token ausente não derruba o job", async () => {
    integrationRow = { access_token_encrypted: null };
    queueRows = [{ id: "q1", company_id: "c1", product_id: "p1", marketplace: "mercadolivre", attempts: 0 }];
    const { drainMarketplaceSyncQueue } = await core();
    const summary = await drainMarketplaceSyncQueue();
    expect(summary.failed).toBe(1);
    expect(integrationFetch).not.toHaveBeenCalled();
  });
});
