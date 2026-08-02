/**
 * ProductService (Sprint 002)
 *
 * Regras de negócio do módulo Products v2. Consumido exclusivamente
 * pelas Skills — nunca pela UI diretamente. Herda de BaseService para
 * garantir cliente Supabase autenticado + logger/metrics scoped.
 */
import { BaseService } from "@/features/bella-ai/agent/infrastructure/base-service";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import { priceForMargin } from "@/features/pricing/calculator";
import { fetchCompanyCostDefaults } from "@/features/pricing/lib/company-cost-defaults";
import type { Product, ProductInsert } from "../../types";
import {
  ProductRepository,
  type ProductSearchFilters,
  type ProductSearchResult,
} from "../repository/product.repository";

export interface CreateProductInput {
  name: string;
  price?: number | null;
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
    const inputPrice = typeof input.price === "number" ? input.price : null;
    if (inputPrice != null && inputPrice < 0)
      throw new Error("Preço não pode ser negativo.");
    if (input.cost != null && input.cost < 0)
      throw new Error("Custo não pode ser negativo.");

    const cost = input.cost ?? 0;

    // Deduplicação por Nome / SKU / Código de barras (RLS-safe).
    const duplicate = await this.repo.findDuplicate({
      name: input.name,
      sku: input.sku ?? null,
      barcode: input.barcode ?? null,
    });

    if (duplicate) {
      // Nunca sobrescreve descrição; price/cost só quando o novo valor > 0.
      const patch: Record<string, unknown> = {};
      if (inputPrice != null && inputPrice > 0) patch.price = inputPrice;
      if (cost > 0) patch.cost = cost;
      if (input.sku?.trim() && !duplicate.sku) patch.sku = input.sku.trim();
      if (input.barcode?.trim() && !duplicate.barcode) patch.barcode = input.barcode.trim();

      const updated = Object.keys(patch).length
        ? await this.repo.update(duplicate.id, patch as never)
        : ((await this.repo.findById(duplicate.id)) as Product);
      this.log.info("product.merged_duplicate", {
        productId: duplicate.id,
        matchedBy: duplicate.matchedBy,
      });
      return updated;
    }

    // Produto genuinamente novo: calcula preço a partir do custo quando ausente.
    let price = inputPrice ?? 0;
    if (price <= 0 && cost > 0) {
      const defaults = await fetchCompanyCostDefaults(this.ctx.supabase, this.companyId);
      const costTotal =
        cost + defaults.freight + defaults.packaging + defaults.insurance + defaults.otherCosts;
      const suggested = priceForMargin(costTotal, 50, 0);
      price = Number.isFinite(suggested) ? Math.round(suggested * 100) / 100 : 0;
    }

    // `company_id` sempre derivado do ExecutionContext.
    const payload: ProductInsert = {
      company_id: this.companyId,
      name: input.name.trim(),
      price,
      cost,
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
