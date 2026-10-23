import { describe, expect, it, vi } from "vitest";
import { fetchAllRows, fetchInChunks } from "../supabase-fetch-all";

/** Simula um builder do PostgREST sobre `total` linhas com corte em max_rows. */
function fakeQuery(total: number, maxRows = 1000, failAt?: number) {
  const calls: Array<{ from: number; to: number }> = [];
  const orders: string[] = [];
  let range = { from: 0, to: maxRows - 1 };
  const q: any = {
    order(col: string) {
      orders.push(col);
      return q;
    },
    range(from: number, to: number) {
      range = { from, to };
      return q;
    },
    then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
      calls.push({ ...range });
      if (failAt !== undefined && range.from >= failAt) {
        return Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve, reject);
      }
      const size = Math.min(range.to - range.from + 1, maxRows);
      const rows = Array.from(
        { length: Math.max(0, Math.min(size, total - range.from)) },
        (_, i) => ({ id: range.from + i }),
      );
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    },
  };
  return { q, calls, orders };
}

describe("fetchAllRows", () => {
  it("busca além do corte de 1.000 linhas (o bug dos relatórios)", async () => {
    const { q, calls } = fakeQuery(2_350);
    const rows = await fetchAllRows(q);
    expect(rows).toHaveLength(2_350);
    expect(calls.map((c) => c.from)).toEqual([0, 1000, 2000]);
    expect(new Set(rows.map((r: any) => r.id)).size).toBe(2_350);
  });

  it("uma página só quando há poucas linhas", async () => {
    const { q, calls } = fakeQuery(10);
    expect(await fetchAllRows(q)).toHaveLength(10);
    expect(calls).toHaveLength(1);
  });

  it("exatamente 1.000 linhas: confirma com uma página vazia", async () => {
    const { q, calls } = fakeQuery(1000);
    expect(await fetchAllRows(q)).toHaveLength(1000);
    expect(calls).toHaveLength(2);
  });

  it("acrescenta desempate por id para paginação estável", async () => {
    const { q, orders } = fakeQuery(5);
    await fetchAllRows(q);
    expect(orders).toEqual(["id"]);
    const second = fakeQuery(5);
    await fetchAllRows(second.q, { tiebreaker: null });
    expect(second.orders).toEqual([]);
  });

  it("propaga erro do banco", async () => {
    const { q } = fakeQuery(5_000, 1000, 1000);
    await expect(fetchAllRows(q)).rejects.toMatchObject({ message: "boom" });
  });

  it("respeita o teto de segurança", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { q } = fakeQuery(10_000);
    expect(await fetchAllRows(q, { maxRows: 3000 })).toHaveLength(3000);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("fetchInChunks", () => {
  it("divide ids grandes em lotes e junta os resultados", async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `id-${i}`);
    const fn = vi.fn(async (chunk: string[]) => ({
      data: chunk.map((id) => ({ id })),
      error: null,
    }));
    const out = await fetchInChunks(ids, fn, 200);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(out).toHaveLength(450);
  });

  it("propaga erro", async () => {
    await expect(
      fetchInChunks(["a"], async () => ({ data: null, error: new Error("x") })),
    ).rejects.toThrow("x");
  });
});
