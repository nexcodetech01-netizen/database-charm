import { describe, expect, it, vi } from "vitest";

const rows = [
  { id: "c", name: "Carteira", stock: 1, min_stock: 0 },
  { id: "a", name: "Bolsa Preta", stock: 1, min_stock: 0 },
  { id: "b", name: "Michael Kors", stock: 1, min_stock: 0 },
];
const calls: string[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "or", "lte", "gt", "order", "range"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push(m);
      void args;
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null, count: 99 });
  return {
    supabase: {
      from: () => builder,
      rpc: vi.fn(async () => ({ data: [{ id: "a" }, { id: "b" }, { id: "c" }], error: null })),
    },
  };
});

describe("productsService.list com busca", () => {
  it("ordena por relevância e pagina localmente com total correto", async () => {
    const { productsService } = await import("../products.service");
    const res = await productsService.list("co", {
      search: "bolsas",
      page: 1,
      pageSize: 2,
      sortBy: "name",
      sortDir: "asc",
    } as never);
    expect(res.rows.map((r: { id: string }) => r.id)).toEqual(["a", "b"]);
    expect(res.total).toBe(3);
    expect(calls).not.toContain("range");
  });
});
