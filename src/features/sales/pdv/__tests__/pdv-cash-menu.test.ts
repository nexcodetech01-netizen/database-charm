import { describe, expect, it } from "vitest";
import {
  PDV_CASH_MENU_ITEMS,
  pdvCashMenuLabel,
} from "../lib/cash-menu";
import {
  createPdvShortcutHandler,
  resolvePdvShortcut,
} from "../hooks/use-pdv-shortcuts";

describe("PDV — menu operacional do caixa (UX)", () => {
  it("rotula o caixa aberto com data e hora", () => {
    const label = pdvCashMenuLabel({ opened_at: "2026-07-31T13:43:00.000Z" });
    expect(label.open).toBe(true);
    expect(label.title).toBe("Caixa Aberto");
    expect(label.detail).toMatch(/^\d{2}\/\d{2}\/\d{4} • \d{2}:\d{2}$/);
  });

  it("rotula o caixa fechado sem detalhe", () => {
    expect(pdvCashMenuLabel(null)).toEqual({
      title: "Caixa Fechado",
      detail: null,
      open: false,
    });
  });

  it("expõe os itens do menu na ordem definida, com F12 no fechamento", () => {
    expect(PDV_CASH_MENU_ITEMS.map((i) => i.action)).toEqual([
      "view-session",
      "cash-out",
      "cash-in",
      "close-cash",
    ]);
    const close = PDV_CASH_MENU_ITEMS.find((i) => i.action === "close-cash")!;
    expect(close.hint).toBe("F12");
    expect(close.danger).toBe(true);
    expect(close.separatorBefore).toBe(true);
  });
});

describe("PDV — atalho F12", () => {
  it("F12 resolve para abrir o fechamento de caixa", () => {
    expect(resolvePdvShortcut({ key: "F12" })).toBe("close-cash");
  });

  it("F12 dispara o handler e bloqueia o comportamento do navegador", () => {
    let opened = 0;
    let prevented = 0;
    const onKeyDown = createPdvShortcutHandler(() => ({
      "close-cash": () => {
        opened += 1;
      },
    }));
    onKeyDown({ key: "F12", preventDefault: () => (prevented += 1) });
    expect(opened).toBe(1);
    expect(prevented).toBe(1);
  });

  it("nunca fecha o caixa quando não há sessão (handler ausente)", () => {
    const onKeyDown = createPdvShortcutHandler(() => ({}));
    expect(() => onKeyDown({ key: "F12" })).not.toThrow();
  });

  it("com o diálogo de fechamento aberto, Enter confirma e Esc fecha", () => {
    const ctx = { dialogOpen: true };
    expect(resolvePdvShortcut({ key: "Enter" }, ctx)).toBe("confirm-dialog");
    expect(resolvePdvShortcut({ key: "Escape" }, ctx)).toBe("close-dialog");
    // F12 não reabre nada enquanto o diálogo está aberto.
    expect(resolvePdvShortcut({ key: "F12" }, ctx)).toBeNull();
  });

  it("digitar em um campo de texto não dispara o fechamento", () => {
    expect(
      resolvePdvShortcut({ key: "F12", target: { tagName: "INPUT", id: "x" } }),
    ).toBeNull();
  });
});
