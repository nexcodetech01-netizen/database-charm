import { describe, expect, it, vi } from "vitest";
import {
  createPdvShortcutHandler,
  isTypingTarget,
  isPdvSearchTarget,
  registerPdvShortcuts,
  resolvePdvShortcut,
  type PdvShortcutHandlers,
} from "../hooks/use-pdv-shortcuts";

function key(k: string, extra: Record<string, unknown> = {}) {
  return { key: k, ...extra };
}

const SEARCH = { tagName: "INPUT", id: "pdv-search" };

describe("PDV — atalhos de teclado (Sprint 2.8)", () => {
  it("ENTER adiciona o produto (busca e leitor)", () => {
    expect(resolvePdvShortcut(key("Enter"))).toBe("add-product");
    expect(resolvePdvShortcut(key("Enter", { target: SEARCH }))).toBe(
      "add-product",
    );
  });

  it("ESC limpa a pesquisa", () => {
    expect(resolvePdvShortcut(key("Escape"))).toBe("clear-search");
    expect(resolvePdvShortcut(key("Escape", { target: SEARCH }))).toBe(
      "clear-search",
    );
  });

  it("F2 abre o cliente", () => {
    expect(resolvePdvShortcut(key("F2"))).toBe("open-customer");
  });

  it("F3 foca a quantidade do item ativo", () => {
    expect(resolvePdvShortcut(key("F3"))).toBe("focus-quantity");
  });

  it("F4 foca o desconto", () => {
    expect(resolvePdvShortcut(key("F4"))).toBe("focus-discount");
  });

  it("F5 abre o pagamento", () => {
    expect(resolvePdvShortcut(key("F5"))).toBe("open-payment");
  });

  it("DELETE remove o item ativo, exceto dentro da pesquisa", () => {
    expect(resolvePdvShortcut(key("Delete"))).toBe("remove-item");
    expect(resolvePdvShortcut(key("Delete", { target: SEARCH }))).toBeNull();
  });

  it("CTRL+L limpa o carrinho (e também CMD+L e CTRL+DELETE)", () => {
    expect(resolvePdvShortcut(key("l", { ctrlKey: true }))).toBe("clear-cart");
    expect(resolvePdvShortcut(key("L", { metaKey: true }))).toBe("clear-cart");
    expect(resolvePdvShortcut(key("Delete", { ctrlKey: true }))).toBe(
      "clear-cart",
    );
  });

  it("com diálogo aberto ENTER confirma e ESC fecha", () => {
    expect(resolvePdvShortcut(key("Enter"), { dialogOpen: true })).toBe(
      "confirm-dialog",
    );
    expect(resolvePdvShortcut(key("Escape"), { dialogOpen: true })).toBe(
      "close-dialog",
    );
    expect(resolvePdvShortcut(key("F2"), { dialogOpen: true })).toBeNull();
  });

  it("ignora atalhos enquanto o usuário digita em outros campos", () => {
    const textarea = { tagName: "TEXTAREA", id: "obs" };
    const money = { tagName: "INPUT", id: "valor", type: "text" };
    const editable = { tagName: "DIV", isContentEditable: true };
    expect(isTypingTarget(textarea)).toBe(true);
    expect(resolvePdvShortcut(key("F2", { target: textarea }))).toBeNull();
    expect(resolvePdvShortcut(key("Delete", { target: money }))).toBeNull();
    expect(resolvePdvShortcut(key("Enter", { target: editable }))).toBeNull();
  });

  it("mantém os atalhos ativos na pesquisa e no leitor", () => {
    const barcode = { tagName: "INPUT", id: "pdv-barcode" };
    expect(isTypingTarget(SEARCH)).toBe(false);
    expect(isPdvSearchTarget(SEARCH)).toBe(true);
    expect(isPdvSearchTarget(barcode)).toBe(true);
    expect(isPdvSearchTarget({ tagName: "INPUT", id: "outro" })).toBe(false);
    expect(resolvePdvShortcut(key("F4", { target: SEARCH }))).toBe(
      "focus-discount",
    );
  });

  it("ALT desabilita os atalhos", () => {
    expect(resolvePdvShortcut(key("F5", { altKey: true }))).toBeNull();
  });

  it("chama a mesma action do botão e previne o comportamento padrão", () => {
    const handlers: PdvShortcutHandlers = {
      "open-customer": vi.fn(),
      "open-payment": vi.fn(),
    };
    const onKeyDown = createPdvShortcutHandler(() => handlers);
    const preventDefault = vi.fn();
    onKeyDown({ key: "F2", preventDefault });
    expect(handlers["open-customer"]).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("não dispara quando a ação está indisponível no estado atual", () => {
    const onKeyDown = createPdvShortcutHandler(() => ({
      "remove-item": undefined,
    }));
    const preventDefault = vi.fn();
    onKeyDown({ key: "Delete", preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("registra o listener e remove ao desmontar", () => {
    const add = vi.fn();
    const remove = vi.fn();
    const listener = vi.fn();
    const off = registerPdvShortcuts(
      { addEventListener: add, removeEventListener: remove },
      listener as never,
    );
    expect(add).toHaveBeenCalledWith("keydown", listener);
    off();
    expect(remove).toHaveBeenCalledWith("keydown", listener);
  });
});
