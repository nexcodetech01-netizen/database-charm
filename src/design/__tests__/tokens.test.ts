import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DESIGN_TOKENS,
  MOTION_DURATION_MS,
  MOTION_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  SPACING_TOKENS,
  STATUS_KEYS,
  STATUS_TOKENS,
  TEXT_TOKENS,
  statusToken,
} from "../tokens";

const css = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

describe("UI.1.1 — Design Tokens", () => {
  it("define os 12 tokens de status", () => {
    expect(STATUS_KEYS).toHaveLength(12);
    for (const key of STATUS_KEYS) {
      expect(css).toContain(`--status-${key}:`);
      expect(css).toContain(`--status-${key}-foreground:`);
      expect(css).toContain(`--status-${key}-surface:`);
      expect(css).toContain(`--color-status-${key}: var(--status-${key});`);
      expect(STATUS_TOKENS[key].soft).toContain(`bg-status-${key}-surface`);
    }
  });

  it("expõe status também no tema escuro", () => {
    const dark = css.slice(css.indexOf(".dark {"));
    for (const key of STATUS_KEYS) {
      expect(dark).toContain(`--status-${key}:`);
    }
  });

  it("cai em neutral para status desconhecido", () => {
    expect(statusToken("inexistente")).toEqual(STATUS_TOKENS.neutral);
    expect(statusToken(null)).toEqual(STATUS_TOKENS.neutral);
    expect(statusToken("success")).toEqual(STATUS_TOKENS.success);
  });

  it("padroniza o radius em sm/lg/xl", () => {
    expect(Object.keys(RADIUS_TOKENS)).toEqual(["sm", "lg", "xl"]);
    expect(Object.values(RADIUS_TOKENS)).not.toContain("rounded-md");
    expect(Object.values(RADIUS_TOKENS)).not.toContain("rounded-2xl");
  });

  it("padroniza a elevação em quatro níveis", () => {
    expect(Object.keys(SHADOW_TOKENS)).toEqual([
      "surface",
      "card",
      "floating",
      "overlay",
    ]);
    for (const level of Object.keys(SHADOW_TOKENS)) {
      expect(css).toContain(`--shadow-${level}:`);
    }
  });

  it("mantém uma escala tipográfica única, sem tamanhos arbitrários", () => {
    expect(Object.keys(TEXT_TOKENS)).toEqual([
      "xs",
      "sm",
      "base",
      "lg",
      "xl",
      "2xl",
    ]);
    for (const cls of Object.values(TEXT_TOKENS)) {
      expect(cls).not.toMatch(/\[\d+px\]/);
    }
  });

  it("define motion fast/normal/slow com duração e easing", () => {
    expect(Object.keys(MOTION_TOKENS)).toEqual(["fast", "normal", "slow"]);
    expect(MOTION_DURATION_MS.fast).toBeLessThan(MOTION_DURATION_MS.normal);
    expect(MOTION_DURATION_MS.normal).toBeLessThan(MOTION_DURATION_MS.slow);
    expect(css).toContain("--animate-duration-fast:");
    expect(css).toContain("--ease-standard:");
  });

  it("define spacing compact/normal/comfortable/relaxed", () => {
    expect(Object.keys(SPACING_TOKENS)).toEqual([
      "compact",
      "normal",
      "comfortable",
      "relaxed",
    ]);
    for (const level of Object.keys(SPACING_TOKENS)) {
      expect(css).toContain(`--spacing-${level}:`);
    }
  });

  it("agrupa tudo em DESIGN_TOKENS", () => {
    expect(Object.keys(DESIGN_TOKENS).sort()).toEqual(
      [
        "interaction",
        "motion",
        "radius",
        "shadow",
        "spacing",
        "status",
        "text",
      ].sort(),
    );
  });
});
