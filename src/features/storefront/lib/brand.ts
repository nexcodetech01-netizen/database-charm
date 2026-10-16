/**
 * Marca da loja nas telas que o CLIENTE FINAL vê (catálogo, rastreio,
 * fidelidade). Essas telas usam a logo e a cor principal cadastradas em
 * Configurações › Empresa — não a marca NexOS. Sem cor cadastrada, usamos
 * um padrão neutro que acompanha o tema (claro/escuro).
 */
import type { CSSProperties } from "react";

export interface StoreBranding {
  name: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}

/** Aceita "#abc", "#aabbcc" ou sem "#"; devolve "#aabbcc" ou null. */
export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  let v = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(v)) v = v.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(v)) return null;
  return `#${v.toLowerCase()}`;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Texto legível (preto ou branco) sobre a cor da loja. */
export function readableTextOn(hex: string): "#ffffff" | "#111111" {
  const l = luminance(hex);
  const contrastWhite = 1.05 / (l + 0.05);
  const contrastBlack = (l + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? "#ffffff" : "#111111";
}

/** Escurece (ou clareia, se já for muito escura) para o estado "hover". */
export function hoverShade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const dark = luminance(hex) < 0.05;
  const f = dark ? 1.25 : 0.88;
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.max(0, Math.min(255, Math.round(dark ? c + (255 - c) * 0.15 : c * f))),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Variáveis CSS que trocam a cor "primary" do tema só dentro da tela da
 * loja (botões, destaques e foco passam a usar a cor da loja).
 *
 * Sem cor (ou com cor quase preta, que some no modo escuro), usamos o
 * neutro que acompanha o tema: escuro no modo claro, claro no escuro.
 */
export function brandStyle(primaryColor: string | null | undefined): CSSProperties {
  const color = normalizeHex(primaryColor);
  if (!color || luminance(color) < 0.02) {
    return {
      ["--primary" as string]: "var(--foreground)",
      ["--primary-foreground" as string]: "var(--background)",
      ["--primary-hover" as string]: "var(--foreground)",
      ["--ring" as string]: "var(--foreground)",
    } as CSSProperties;
  }
  return {
    ["--primary" as string]: color,
    ["--primary-foreground" as string]: readableTextOn(color),
    ["--primary-hover" as string]: hoverShade(color),
    ["--ring" as string]: color,
  } as CSSProperties;
}
