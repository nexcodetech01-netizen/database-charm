import { describe, expect, it, vi } from "vitest";
import {
  createPdvShortcutHandler,
  isTypingTarget,
  registerPdvShortcuts,
  resolvePdvShortcut,
  type PdvShortcutHandlers,
} from "../hooks/use-pdv-shortcuts";

function key(k: string, extra: Record<string, unknown> = {}) {
  return { key: k, ...extra };
}

describe("PDV — atalhos de teclado (Sprint 2.8)", () => {
  it("F2 foca a busca de produtos", () => {
    expect(resolvePdvShortcut(key("F2"))).toBe("focus-search");
  });

  it("F3 foca o leitor de código de barras", () => {
    expect(resolvePdvShortcut(key("F3"))).toBe("focus-barcode");
  });

  it("F4 abre a seleção de cliente", () => {
    expect(resolvePdvShortcut(key("F4"))).toBe("open-customer");
  });

  it("F5 inicia uma nova venda", () => {
    expect(resolvePdvShortcut(key("F5"))).toBe("new-sale");
  });

  it("F8 inicia o recebimento", () => {
    expect(resolvePdvShortcut(key("F8"))).toBe("receive");
  });

  it("F9 imprime o recibo", () => {
    expect(resolvePdvShortcut(key("F9"))).toBe("print-receipt");
  });

  it("ESC fecha o diálogo aberto", () => {
    expect(resolvePdvShortcut(key("Escape"), { dialogOpen: true })).toBe(
      "close-dialog",
    );
    expect(resolvePdvShortcut(key("Escape"))).toBe("close-dialog");
  });

  it("ENTER confirma somente quando há diálogo aberto", () => {
    expect(resolvePdvShortcut(key("Enter"), { dialogOpen: true })).toBe(
      "confirm-dialog",
    );
    expect(resolvePdvShortcut(key("Enter"))).toBeNull();
  });

  it("com diálogo aberto os demais atalhos ficam inativos", () => {
    expect(resolvePdvShortcut(key("F2"), { dialogOpen: true })).toBeNull();
  });

  it("CTRL+DELETE limpa o carrinho (e também CMD+DELETE)", () => {
    expect(resolvePdvShortcut(key("Delete", { ctrlKey: true }))).toBe(
      "clear-cart",
    );
    expect(resolvePdvShortcut(key("Delete", { metaKey: true }))).toBe(
      "clear-cart",
    );
    expect(resolvePdvShortcut(key("Delete"))).toBeNull();
  });

  it("ignora atalhos enquanto o usuário digita em campos de texto", () => {
    const textarea = { tagName: "TEXTAREA", id: "obs" };
    const money = { tagName: "INPUT", id: "valor", type: "text" };
    const editable = { tagName: "DIV", isContentEditable: true };
    expect(isTypingTarget(textarea)).toBe(true);
    expect(resolvePdvShortcut(key("F2", { target: textarea }))).toBeNull();
    expect(resolvePdvShortcut(key("F8", { target: money }))).toBeNull();
    expect(resolvePdvShortcut(key("F5", { target: editable }))).toBeNull();
  });

  it("mantém os atalhos ativos na busca e no leitor de código de barras", () => {
    const search = { tagName: "INPUT", id: "pdv-search" };
    const barcode = { tagName: "INPUT", id: "pdv-barcode" };
    expect(isTypingTarget(search)).toBe(false);
    expect(resolvePdvShortcut(key("F3", { target: search }))).toBe(
      "focus-barcode",
    );
    expect(resolvePdvShortcut(key("F2", { target: barcode }))).toBe(
      "focus-search",
    );
  });

  it("chama a mesma action do botão e previne o comportamento padrão", () => {
    const handlers: PdvShortcutHandlers = {
      "focus-search": vi.fn(),
      receive: vi.fn(),
    };
    const onKeyDown = createPdvShortcutHandler(() => handlers);
    const preventDefault = vi.fn();
    onKeyDown({ key: "F2", preventDefault });
    expect(handlers["focus-search"]).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("não dispara quando a ação está indisponível no estado atual", () => {
    const onKeyDown = createPdvShortcutHandler(() => ({
      "new-sale": undefined,
    }));
    const preventDefault = vi.fn();
    onKeyDown({ key: "F5", preventDefault });
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
    expect(remove).not.toHaveBeenCalled();
    off();
    expect(remove).toHaveBeenCalledWith("keydown", listener);
  });
});
