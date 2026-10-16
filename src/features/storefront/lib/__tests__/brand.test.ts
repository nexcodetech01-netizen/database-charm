import { describe, expect, it } from "vitest";
import { brandStyle, normalizeHex, readableTextOn } from "../brand";

describe("marca da loja nas telas públicas", () => {
  it("normaliza a cor cadastrada", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("c9a227")).toBe("#c9a227");
    expect(normalizeHex("vermelho")).toBeNull();
    expect(normalizeHex("")).toBeNull();
  });

  it("escolhe texto legível sobre a cor", () => {
    expect(readableTextOn("#000000")).toBe("#ffffff");
    expect(readableTextOn("#ffffff")).toBe("#111111");
    expect(readableTextOn("#f5d76e")).toBe("#111111"); // dourado claro
    expect(readableTextOn("#7b1e3a")).toBe("#ffffff"); // vinho
  });

  it("sem cor (ou quase preta) usa o neutro que acompanha o tema", () => {
    for (const c of [null, "#000000", "#0a0a0a"]) {
      const s = brandStyle(c) as Record<string, string>;
      expect(s["--primary"]).toBe("var(--foreground)");
      expect(s["--primary-foreground"]).toBe("var(--background)");
    }
  });

  it("usa a cor da loja com texto legível", () => {
    const s = brandStyle("#7B1E3A") as Record<string, string>;
    expect(s["--primary"]).toBe("#7b1e3a");
    expect(s["--primary-foreground"]).toBe("#ffffff");
  });
});
