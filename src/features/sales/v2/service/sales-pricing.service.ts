/**
 * SalesPricingService (Sprint 005)
 *
 * Consolida cálculo de totais e margem de um pedido v2. Nenhuma regra
 * de precificação nova é criada aqui — os utilitários existentes
 * (`computeItemTotal`, `computeTotals`, `computeSaleMetrics`) do módulo
 * de vendas seguem sendo a fonte única de verdade.
 */
import { BaseService } from "@/features/bella-ai/agent/infrastructure/base-service";
import { computeItemTotal, computeTotals } from "../../types";
import type { SaleOrderItemInput } from "../types";

export interface PricedItem extends SaleOrderItemInput {
  unitPrice: number;
  discount: number;
  total: number;
  unitCost?: number | null;
}

export interface PricedOrder {
  items: PricedItem[];
  itemsTotal: number;
  discount: number;
  shipping: number;
  grandTotal: number;
  totalCost: number;
  totalProfit: number;
  marginPct: number | null;
}

export class SalesPricingService extends BaseService {
  price(
    items: SaleOrderItemInput[],
    extras: { discount?: number | null; shipping?: number | null } = {},
    productCosts?: Map<string, number | null>,
  ): PricedOrder {
    const priced: PricedItem[] = items.map((it) => {
      const unitPrice = Number(it.unitPrice ?? 0);
      const discount = Number(it.discount ?? 0);
      const unitCost = productCosts?.get(it.productId) ?? null;
      const total = computeItemTotal({
        quantity: it.quantity,
        unit_price: unitPrice,
        discount,
      });
      return {
        ...it,
        unitPrice,
        discount,
        total,
        unitCost,
      };
    });
    const totals = computeTotals(
      priced.map((p) => ({
        quantity: p.quantity,
        unit_price: p.unitPrice,
        discount: p.discount,
      })),
      { discount: Number(extras.discount ?? 0), shipping: Number(extras.shipping ?? 0) },
    );

    let totalCost = 0;
    let hasCost = false;
    for (const p of priced) {
      if (p.unitCost != null) {
        hasCost = true;
        totalCost += Number(p.unitCost) * p.quantity;
      }
    }
    const profit = totals.grand_total - totalCost;
    return {
      items: priced,
      itemsTotal: totals.items_total,
      discount: Number(extras.discount ?? 0),
      shipping: Number(extras.shipping ?? 0),
      grandTotal: totals.grand_total,
      totalCost,
      totalProfit: profit,
      marginPct: hasCost && totals.grand_total > 0 ? (profit / totals.grand_total) * 100 : null,
    };
  }
}
