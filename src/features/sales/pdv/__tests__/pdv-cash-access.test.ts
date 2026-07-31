import { describe, expect, it } from "vitest";
import { resolvePdvCashAccess } from "../lib/cash-access";

const now = new Date("2026-07-31T15:00:00");

describe("resolvePdvCashAccess", () => {
  it("mantém estado de carregamento enquanto a sessão é consultada", () => {
    const r = resolvePdvCashAccess({ isLoading: true, session: undefined, now });
    expect(r.state).toBe("loading");
    expect(r.canOperate).toBe(false);
  });

  it("bloqueia o PDV quando não há caixa aberto", () => {
    const r = resolvePdvCashAccess({ isLoading: false, session: null, now });
    expect(r.state).toBe("blocked");
    expect(r.canOperate).toBe(false);
    expect(r.message).toMatch(/Abra o caixa/i);
  });

  it("libera o PDV quando existe sessão aberta no dia", () => {
    const r = resolvePdvCashAccess({
      isLoading: false,
      session: { status: "open", opened_at: "2026-07-31T08:00:00" },
      now,
    });
    expect(r.state).toBe("ready");
    expect(r.canOperate).toBe(true);
    expect(r.message).toBeNull();
  });

  it("bloqueia quando a sessão aberta é de outro dia (pendente de fechamento)", () => {
    const r = resolvePdvCashAccess({
      isLoading: false,
      session: { status: "open", opened_at: "2026-07-30T08:00:00" },
      now,
    });
    expect(r.state).toBe("stale");
    expect(r.canOperate).toBe(false);
    expect(r.message).toMatch(/fechar esse caixa/i);
  });
});
