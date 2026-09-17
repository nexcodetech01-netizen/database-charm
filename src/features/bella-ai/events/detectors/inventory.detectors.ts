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

/**
 * Um grupo de possíveis duplicatas, no mesmo formato que
 * `preview_duplicate_products` (banco) já devolve — a função SQL agrupa
 * produtos pelo nome normalizado (mesma lógica usada por
 * `find_products_by_name_key`, que avisa na hora de lançar uma compra) e
 * escolhe automaticamente qual manter (`keeperId`). Este detector não
 * reimplementa esse agrupamento — só decide, a partir dele, se vale
 * emitir um evento.
 */
export interface DuplicateProductGroup {
  nameKey: string;
  keeperId: string;
  keeperName: string;
  duplicateCount: number;
  duplicateNames: string[];
}

/**
 * Detecta grupos de produtos possivelmente duplicados (mesmo nome
 * normalizado) que já existem no catálogo — complementa o aviso que já
 * acontece na hora de LANÇAR uma compra (purchase-items-editor /
 * purchase-import-review-dialog): aqui a checagem é periódica e cobre
 * duplicatas criadas por qualquer caminho (cadastro manual de produto,
 * importação antiga, etc.), não só compra nova.
 *
 * Não tem "resolve" automático como os outros detectores de estoque: o
 * agrupamento vem de uma consulta que só retorna grupos que SÃO
 * duplicata agora — quando alguém mescla os produtos (ferramenta já
 * existente merge_duplicate_products), o grupo simplesmente para de
 * aparecer nas próximas execuções.
 */
export const possibleDuplicateProductDetector: BellaEventDetector<DuplicateProductGroup[]> = {
  id: "inventory.possible_duplicate",
  module: "inventory",
  detect(groups, ctx): DetectorResult {
    const emit: DetectorResult["emit"] = [];
    for (const g of groups) {
      if (g.duplicateCount <= 0) continue;
      emit.push({
        type: "inventory.possible_duplicate",
        tenantId: ctx.tenantId,
        payload: {
          entityId: g.keeperId,
          name: g.keeperName,
          duplicateCount: g.duplicateCount,
          duplicateNames: g.duplicateNames,
        },
        description:
          g.duplicateCount === 1
            ? `"${g.keeperName}" tem 1 possível duplicata (${g.duplicateNames[0]}) no catálogo.`
            : `"${g.keeperName}" tem ${g.duplicateCount} possíveis duplicatas no catálogo.`,
        source: "detector:inventory.possible_duplicate",
      });
    }
    return { emit, resolve: [] };
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
