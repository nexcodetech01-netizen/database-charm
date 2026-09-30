/**
 * Formatação da resposta "quantos <produto> vendi" (skill sale.products_sold).
 * Parte pura — testável sem banco.
 */

export type SoldPeriod = "this_month" | "last_month" | "last_30_days";

export interface ProductSoldRow {
  product_id: string;
  name: string;
  category: string | null;
  quantity: number;
  revenue: number;
  stock: number;
  sold_60d: number;
  suggested_qty: number;
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const qty = (v: number) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Datas (inclusivas) e rótulo do período. */
export function resolveSoldPeriod(period: SoldPeriod, now = new Date()) {
  if (period === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: iso(start), end: iso(end), label: `em ${MONTHS[start.getMonth()]}` };
  }
  if (period === "last_30_days") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    return { start: iso(start), end: iso(now), label: "nos últimos 30 dias" };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: iso(start), end: iso(now), label: `em ${MONTHS[now.getMonth()]}` };
}

export function buildProductsSoldMessage(
  term: string,
  periodLabel: string,
  rows: readonly ProductSoldRow[],
  maxLines = 10,
): string {
  const sold = rows.filter((r) => Number(r.quantity) > 0);
  const toRestock = rows.filter((r) => Number(r.suggested_qty) > 0);

  if (sold.length === 0) {
    const base = `Não encontrei vendas de "${term}" ${periodLabel}.`;
    return toRestock.length > 0
      ? `${base}\n\n${restockBlock(toRestock, maxLines)}`
      : `${base} Confira se o nome do produto ou da categoria está escrito como no cadastro.`;
  }

  const totalQty = sold.reduce((s, r) => s + Number(r.quantity), 0);
  const totalRev = sold.reduce((s, r) => s + Number(r.revenue), 0);
  const lines = sold
    .slice(0, maxLines)
    .map((r) => `• ${r.name} — ${qty(r.quantity)} un. · estoque ${qty(r.stock)}`);
  if (sold.length > maxLines) lines.push(`• …e mais ${sold.length - maxLines} produto(s)`);

  const parts = [
    `${capitalize(periodLabel)} você vendeu ${qty(totalQty)} un. de "${term}" (${brl(totalRev)}):`,
    lines.join("\n"),
  ];
  parts.push(
    toRestock.length > 0
      ? restockBlock(toRestock, maxLines)
      : "Pelo giro dos últimos 60 dias, o estoque desses produtos está suficiente para os próximos 30 dias.",
  );
  return parts.join("\n\n");
}

function restockBlock(rows: readonly ProductSoldRow[], maxLines: number): string {
  const lines = rows
    .slice(0, maxLines)
    .map((r) => `• ${r.name} — comprar ${qty(r.suggested_qty)} un. (estoque ${qty(r.stock)})`);
  return [
    "Pra repor (giro dos últimos 60 dias, estoque para 30 dias):",
    lines.join("\n"),
    "Você pode gerar o pedido de compra em Estoque → Sugestão de compra.",
  ].join("\n");
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
