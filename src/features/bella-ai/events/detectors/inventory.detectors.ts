import { deriveEventKey } from "../BellaEventRegistry";
import type { BellaEventDetector, DetectorResult } from "./DetectorTypes";

export interface InventoryProductSnapshot {
  productId: string;
  name: string;
  stock: number;
  minStock: number;
  /** Dias sem venda registrada. */
  daysWithoutSale?: number;
}

/**
 * Detecta estoque crítico e esgotado, além de resolver eventos anteriores
 * quando o estoque volta a ficar saudável.
 */
export const criticalStockDetector: BellaEventDetector<InventoryProductSnapshot[]> = {
  id: "inventory.min_stock_reached",
  module: "inventory",
  detect(products, ctx): DetectorResult {
    const emit: DetectorResult["emit"] = [];
    const resolve: string[] = [];
    for (const p of products) {
      const belowMin = p.stock > 0 && p.stock <= p.minStock;
      if (belowMin) {
        emit.push({
          type: "inventory.min_stock_reached",
          tenantId: ctx.tenantId,
          payload: { entityId: p.productId, name: p.name, stock: p.stock, minStock: p.minStock },
          source: "detector:inventory.min",
        });
      } else if (p.stock > p.minStock) {
        resolve.push(
          deriveEventKey({
            tenantId: ctx.tenantId,
            type: "inventory.min_stock_reached",
            payload: { entityId: p.productId },
          }),
        );
      }
    }
    return { emit, resolve };
  },
};

export const outOfStockDetector: BellaEventDetector<InventoryProductSnapshot[]> = {
  id: "inventory.out_of_stock",
  module: "inventory",
  detect(products, ctx): DetectorResult {
    const emit: DetectorResult["emit"] = [];
    const resolve: string[] = [];
    for (const p of products) {
      if (p.stock <= 0) {
        emit.push({
          type: "inventory.out_of_stock",
          tenantId: ctx.tenantId,
          payload: { entityId: p.productId, name: p.name },
          source: "detector:inventory.out",
        });
      } else {
        resolve.push(
          deriveEventKey({
            tenantId: ctx.tenantId,
            type: "inventory.out_of_stock",
            payload: { entityId: p.productId },
          }),
        );
      }
    }
    return { emit, resolve };
  },
};

export interface SlowMovingConfig {
  /** Dias sem venda para considerar parado. Default: 60. */
  minDaysWithoutSale?: number;
}

export const slowMovingDetector: BellaEventDetector<{ products: InventoryProductSnapshot[]; config?: SlowMovingConfig }> = {
  id: "inventory.slow_moving",
  module: "inventory",
  detect(input, ctx): DetectorResult {
    const min = input.config?.minDaysWithoutSale ?? 60;
    const emit: DetectorResult["emit"] = [];
    const resolve: string[] = [];
    for (const p of input.products) {
      const days = p.daysWithoutSale ?? 0;
      if (p.stock > 0 && days >= min) {
        emit.push({
          type: "inventory.slow_moving",
          tenantId: ctx.tenantId,
          payload: { entityId: p.productId, name: p.name, daysWithoutSale: days },
          source: "detector:inventory.slow",
        });
      } else {
        resolve.push(
          deriveEventKey({
            tenantId: ctx.tenantId,
            type: "inventory.slow_moving",
            payload: { entityId: p.productId },
          }),
        );
      }
    }
    return { emit, resolve };
  },
};
