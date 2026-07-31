/**
 * Parser mínimo de NF-e (XML) — extrai itens da tag <det><prod>.
 * Roda no navegador via DOMParser (sem dependências extras).
 */
export interface ParsedXmlItem {
  description: string;
  color: string;
  quantity: number;
  unit_price: number;
}

export function parseNfeXml(xml: string): ParsedXmlItem[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("XML inválido.");
  }
  const dets = Array.from(doc.getElementsByTagName("det"));
  const items: ParsedXmlItem[] = [];
  for (const det of dets) {
    const prod = det.getElementsByTagName("prod")[0];
    if (!prod) continue;
    const description = text(prod, "xProd");
    if (!description) continue;
    const quantity = num(text(prod, "qCom") || text(prod, "qTrib"));
    const unit_price = num(text(prod, "vUnCom") || text(prod, "vUnTrib"));
    items.push({
      description: description.slice(0, 200),
      color: "",
      quantity: quantity || 1,
      unit_price: Math.max(0, unit_price),
    });
  }
  return items;
}

function text(parent: Element, tag: string): string {
  const el = parent.getElementsByTagName(tag)[0];
  return el?.textContent?.trim() ?? "";
}
function num(v: string): number {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
