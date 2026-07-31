/**
 * ProductService (Sprint 002)
 *
 * Regras de negócio do módulo Products v2. Consumido exclusivamente
 * pelas Skills — nunca pela UI diretamente. Herda de BaseService para
 * garantir cliente Supabase autenticado + logger/metrics scoped.
 */
import { BaseService } from "@/features/bella-ai/agent/infrastructure/base-service";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import type { Product, ProductInsert } from "../../types";
import {
  ProductRepository,
  type ProductSearchFilters,
  type ProductSearchResult,
} from "../repository/product.repository";

export interface CreateProductInput {
  name: string;
  price: number;
  cost?: number | null;
  sku?: string | null;
  unit?: string | null;
  categoryId?: string | null;
  supplierId?: string | null;
  description?: string | null;
  minStock?: number | null;
  barcode?: string | null;
  status?: "active" | "inactive" | "draft";
}

export interface UpdatePriceInput {
  productId: string;
  price: number;
}

export interface UpdateStockInput {
  productId: string;
  quantity: number;
  type: "in" | "out" | "adjustment";
  reason?: string | null;
  notes?: string | null;
}

export class ProductService extends BaseService {
  private readonly repo: ProductRepository;

  constructor(ctx: ExecutionContext) {
    super(ctx);
    this.repo = new ProductRepository(ctx);
  }

  async search(filters: ProductSearchFilters): Promise<ProductSearchResult> {
    this.log.debug("product.search", { filters });
    return this.repo.search(filters);
  }

  async listLowStock(limit = 50): Promise<Product[]> {
    return this.repo.listLowStock(limit);
  }

  async findById(id: string): Promise<Product | null> {
    return this.repo.findById(id);
  }

  async create(input: CreateProductInput): Promise<Product> {
    if (input.price < 0) throw new Error("Preço não pode ser negativo.");
    if (input.cost != null && input.cost < 0)
      throw new Error("Custo não pode ser negativo.");

    // Duplicidade por SKU dentro da mesma empresa (RLS-safe).
    if (input.sku && input.sku.trim()) {
      const existing = await this.repo.findBySku(input.sku.trim());
      if (existing) {
        throw new Error(`Já existe produto com SKU "${input.sku.trim()}".`);
      }
    }

    // `company_id` sempre derivado do ExecutionContext.
    const payload: ProductInsert = {
      company_id: this.companyId,
      name: input.name.trim(),
      price: input.price,
      cost: input.cost ?? 0,
      sku: input.sku?.trim() || null,
      unit: input.unit ?? "un",
      status: input.status ?? "active",
      category_id: input.categoryId ?? null,
      supplier_id: input.supplierId ?? null,
      description: input.description ?? null,
      min_stock: input.minStock ?? 0,
      barcode: input.barcode ?? null,
    } as ProductInsert;

    const product = await this.repo.insert(payload);
    this.log.info("product.created", { productId: product.id });
    return product;
  }

  async updatePrice(input: UpdatePriceInput): Promise<Product> {
    if (input.price < 0) throw new Error("Preço não pode ser negativo.");
    const current = await this.repo.findById(input.productId);
    if (!current) throw new Error("Produto não encontrado.");
    const updated = await this.repo.updatePrice(input.productId, input.price);
    this.log.info("product.price_updated", {
      productId: input.productId,
      from: current.price,
      to: input.price,
    });
    return updated;
  }

  /**
   * Toda alteração de estoque passa pelo motor oficial
   * (inventory_movements → trigger apply_inventory_movement).
   */
  async updateStock(input: UpdateStockInput): Promise<{ movementId: string }> {
    if (input.quantity <= 0)
      throw new Error("Quantidade deve ser maior que zero.");
    const current = await this.repo.findById(input.productId);
    if (!current) throw new Error("Produto não encontrado.");
    const mov = await this.repo.insertInventoryMovement({
      productId: input.productId,
      quantity: input.quantity,
      type: input.type,
      source: "bella_skill",
      reason: input.reason ?? "Ajuste via Bella (Skill)",
      notes: input.notes ?? null,
      userId: this.ctx.userId,
    });
    this.log.info("product.stock_movement", {
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      movementId: mov.id,
    });
    return { movementId: mov.id };
  }
}
