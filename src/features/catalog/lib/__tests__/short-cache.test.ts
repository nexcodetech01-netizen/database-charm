import { describe, expect, it, vi } from "vitest";
import { cached } from "../short-cache.server";

describe("cache curto do catálogo", () => {
  it("junta chamadas e reaproveita o resultado", async () => {
    const load = vi.fn(async () => ({ ok: true, n: 1 }));
    const [a, b] = await Promise.all([
      cached("k1", load, (r) => r.ok),
      cached("k1", load, (r) => r.ok),
    ]);
    await cached("k1", load, (r) => r.ok);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("não guarda erro", async () => {
    const load = vi.fn(async () => ({ ok: false }));
    await cached("k2", load, (r) => r.ok);
    await cached("k2", load, (r) => r.ok);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
