import { describe, expect, it } from "vitest";
import { resolvePdvCashAccess, pdvCashBlockedAction } from "../lib/cash-access";

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

describe("pdvCashBlockedAction", () => {
  // Bug real (2026-08-16): a tela de bloqueio do PDV só oferecia "Abrir
  // Caixa" (para state="blocked", sem sessão nenhuma) — quando
  // state="stale" (sessão de dia anterior, pendente de fechamento),
  // nenhum botão aparecia, e o operador ficava sem forma de resolver.
  it("oferece 'abrir' quando não há nenhuma sessão", () => {
    expect(pdvCashBlockedAction("blocked")).toBe("open");
  });

  it("oferece 'fechar' quando a sessão é de um dia anterior (regressão do bug real)", () => {
    expect(pdvCashBlockedAction("stale")).toBe("close");
  });

  it("não oferece ação quando o caixa já está pronto pra uso", () => {
    expect(pdvCashBlockedAction("ready")).toBeNull();
  });

  it("não oferece ação durante o carregamento", () => {
    expect(pdvCashBlockedAction("loading")).toBeNull();
  });
});
