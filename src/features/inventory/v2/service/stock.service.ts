/**
 * StockService (Sprint 003)
 *
 * Orquestra as operações de alto nível de estoque consumidas pelas
 * Skills (Bella) e por consumidores internos. Toda mutação delega
 * ao InventoryMovementService — nunca escreve `products.stock`.
 */
import { BaseService } from "@/features/bella-ai/agent/infrastructure/base-service";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import { StockRepository, type StockRow } from "../repository/stock.repository";
import { InventoryMovementService } from "./inventory-movement.service";
import type { InventoryMovement } from "../../types";

export interface ProductLookup {
  productId?: string | null;
  query?: string | null;
}

export interface StockOpInput extends ProductLookup {
  quantity: number;
  reason?: string | null;
  notes?: string | null;
}

export interface StockBalance {
  product: StockRow;
  stock: number;
  minStock: number;
  belowMin: boolean;
  outOfStock: boolean;
}

export class StockService extends BaseService {
  private readonly stockRepo: StockRepository;
  private readonly movements: InventoryMovementService;

  constructor(ctx: ExecutionContext) {
    super(ctx);
    this.stockRepo = new StockRepository(ctx);
    this.movements = new InventoryMovementService(ctx);
  }

  private async resolveProduct(lookup: ProductLookup): Promise<StockRow> {
    if (lookup.productId) {
      const p = await this.stockRepo.findProductById(lookup.productId);
      if (!p) throw new Error("Produto não encontrado.");
      return p;
    }
    if (lookup.query) {
      const p = await this.stockRepo.findProductBySkuOrName(lookup.query);
      if (!p) throw new Error(`Nenhum produto encontrado para "${lookup.query}".`);
      return p;
    }
    throw new Error("Informe productId ou query.");
  }

  async balance(lookup: ProductLookup): Promise<StockBalance> {
    const product = await this.resolveProduct(lookup);
    const stock = Number(product.stock ?? 0);
    const minStock = Number(product.min_stock ?? 0);
    return {
      product,
      stock,
      minStock,
      belowMin: stock <= minStock,
      outOfStock: stock <= 0,
    };
  }

  async add(input: StockOpInput): Promise<InventoryMovement> {
    const product = await this.resolveProduct(input);
    return this.movements.record({
      productId: product.id,
      quantity: input.quantity,
      type: "in",
      reason: input.reason ?? "Entrada via Bella",
      notes: input.notes ?? null,
    });
  }

  async remove(input: StockOpInput): Promise<InventoryMovement> {
    const product = await this.resolveProduct(input);
    return this.movements.record({
      productId: product.id,
      quantity: input.quantity,
      type: "out",
      reason: input.reason ?? "Saída via Bella",
      notes: input.notes ?? null,
    });
  }

  /**
   * Ajuste: recebe quantidade e um sinal (positivo = incrementa,
   * negativo = decrementa). O motor oficial trata negativos.
   */
  async adjust(
    input: ProductLookup & { delta: number; reason?: string | null; notes?: string | null },
  ): Promise<InventoryMovement> {
    if (input.delta === 0) throw new Error("Delta não pode ser zero.");
    const product = await this.resolveProduct(input);
    return this.movements.record({
      productId: product.id,
      quantity: input.delta,
      type: "adjustment",
      reason: input.reason ?? "Ajuste via Bella",
      notes: input.notes ?? null,
    });
  }

  async history(input: ProductLookup & { limit?: number }): Promise<InventoryMovement[]> {
    const product = await this.resolveProduct(input);
    return this.movements.history({ productId: product.id, limit: input.limit ?? 20 });
  }

  async listLowStock(limit = 50): Promise<StockRow[]> {
    return this.stockRepo.listLowStock(limit);
  }

  async listOutOfStock(limit = 50): Promise<StockRow[]> {
    return this.stockRepo.listOutOfStock(limit);
  }
}
