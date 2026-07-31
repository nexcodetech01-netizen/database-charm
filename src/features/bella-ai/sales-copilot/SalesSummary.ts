/**
 * SalesSummary — puro. Consolida totais e produz o resumo apresentado
 * ao operador/cliente antes da confirmação. Nenhuma consulta externa.
 */

import type { BellaEntityRef } from "../memory/MemoryTypes";
import type { SalesLineItem } from "./types";

export interface SalesTotals {
  subtotal: number;
  discount: number;
  grandTotal: number;
  itemCount: number;
}

export interface SalesSummaryOutput {
  totals: SalesTotals;
  lines: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineDiscount: number;
    lineTotal: number;
  }>;
  headline: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeTotals(
  items: SalesLineItem[],
  overallDiscountPercent: number,
): SalesTotals {
  let subtotal = 0;
  let discount = 0;
  for (const it of items) {
    const gross = it.quantity * it.unitPrice;
    const linePct = (it.discountPercent ?? 0) / 100;
    const lineDiscount = gross * linePct;
    subtotal += gross;
    discount += lineDiscount;
  }
  const afterLine = subtotal - discount;
  const overall = afterLine * (overallDiscountPercent / 100);
  discount = round2(discount + overall);
  subtotal = round2(subtotal);
  return {
    subtotal,
    discount,
    grandTotal: round2(Math.max(0, subtotal - discount)),
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
  };
}

export function buildSummary(params: {
  customer: BellaEntityRef | null;
  items: SalesLineItem[];
  discountPercent: number;
  paymentMethod: string | null;
}): SalesSummaryOutput {
  const totals = computeTotals(params.items, params.discountPercent);
  const lines = params.items.map((it) => {
    const gross = it.quantity * it.unitPrice;
    const lineDiscount = round2(gross * ((it.discountPercent ?? 0) / 100));
    return {
      productId: it.productId,
      name: it.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      lineDiscount,
      lineTotal: round2(gross - lineDiscount),
    };
  });
  const cust = params.customer?.label ?? "Cliente não identificado";
  const pay = params.paymentMethod ?? "a definir";
  const headline = `Cliente: ${cust} · ${lines.length} item(ns) · Pagamento: ${pay} · Total: R$ ${totals.grandTotal.toFixed(2)}`;
  return { totals, lines, headline };
}
