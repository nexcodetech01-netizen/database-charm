import { toTitleCasePtBr } from "./text-format";

const MAX_TAGS = 10;

export function normalizeTag(raw: string): string {
  return toTitleCasePtBr(raw.replace(/[\r\n\t]+/g, " ").trim());
}

export function normalizeTags(raws: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raws) {
    const t = normalizeTag(r);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export function mergeTags(existing: readonly string[], incoming: readonly string[]): string[] {
  return normalizeTags([...existing, ...incoming]);
}

export const MAX_PRODUCT_TAGS = MAX_TAGS;
