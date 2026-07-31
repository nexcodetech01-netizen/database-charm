/**
 * SalesOrderService (Sprint 005)
 *
 * Orquestra o ciclo de vida de pedidos de venda v2. Delega:
 *  - Persistência → SalesRepository (RLS ativa).
 *  - Cancelamento → RPC `public.cancel_sale` (motor oficial).
 *  - Estoque    → SalesReservationService → StockService v2 (motor
 *                 `apply_inventory_movement`).
 *  - Precificação → SalesPricingService (utilitários existentes).
 *  - Analytics  → SalesAnalyticsRepository (somente leitura).
 *
 * Publica eventos de domínio via `emitAgentEvent` — payload sanitizado
 * pelo próprio event-bus (Sprint 001.5).
 */
import { BaseService } from "@/features/bella-ai/agent/infrastructure/base-service";
import { emitAgentEvent } from "@/features/bella-ai/agent/infrastructure/event-bus";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import type { Sale, SaleInsert, SaleItem } from "../../types";
import {
  V2_TO_DB_STATUS,
  dbStatusToV2,
  type CreateSaleOrderInput,
  type SaleOrderSummary,
  type SaleWithItemsV2,
  type SalesOrderStatus,
} from "../types";
import { SalesRepository, type SalesListFilters } from "../repository/sales.repository";
import { SalesAnalyticsRepository } from "../repository/analytics.repository";
import { SalesPricingService } from "./sales-pricing.service";
import { SalesReservationService } from "./sales-reservation.service";

const RESERVE_STATES: SalesOrderStatus[] = ["reserved", "invoiced"];

export class SalesOrderService extends BaseService {
  private readonly repo: SalesRepository;
  private readonly analytics: SalesAnalyticsRepository;
  private readonly pricing: SalesPricingService;
  private readonly reservation: SalesReservationService;

  constructor(ctx: ExecutionContext) {
    super(ctx);
    this.repo = new SalesRepository(ctx);
    this.analytics = new SalesAnalyticsRepository(ctx);
    this.pricing = new SalesPricingService(ctx);
    this.reservation = new SalesReservationService(ctx);
  }

  /** Lookup opcional de custos para precificação/margem. */
  private async fetchProductCosts(
    productIds: string[],
  ): Promise<Map<string, number | null>> {
    const map = new Map<string, number | null>();
    const unique = Array.from(new Set(productIds));
    if (unique.length === 0) return map;
    const { data, error } = await this.supabase
      .from("products")
      .select("id, price, cost")
      .eq("company_id", this.companyId)
      .in("id", unique);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{
      id: string;
      price: number | null;
      cost: number | null;
    }>) {
      map.set(row.id, row.cost != null ? Number(row.cost) : null);
    }
    return map;
  }

  private async fetchProductPrices(
    productIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const unique = Array.from(new Set(productIds));
    if (unique.length === 0) return map;
    const { data, error } = await this.supabase
      .from("products")
      .select("id, price")
      .eq("company_id", this.companyId)
      .in("id", unique);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ id: string; price: number | null }>) {
      map.set(row.id, Number(row.price ?? 0));
    }
    return map;
  }

  async create(input: CreateSaleOrderInput): Promise<SaleOrderSummary> {
    if (input.items.length === 0) throw new Error("Inclua ao menos um item.");
    const v2Status: SalesOrderStatus = input.status ?? "draft";
    const dbStatus = V2_TO_DB_STATUS[v2Status];

    // Preenche unitPrice ausente a partir do preço atual do produto (fonte oficial).
    const priceMap = await this.fetchProductPrices(input.items.map((i) => i.productId));
    const enriched = input.items.map((it) => ({
      ...it,
      unitPrice: it.unitPrice ?? priceMap.get(it.productId) ?? 0,
    }));

    const costs = await this.fetchProductCosts(enriched.map((i) => i.productId));
    const priced = this.pricing.price(enriched, {
      discount: input.discount ?? 0,
      shipping: input.shipping ?? 0,
    }, costs);

    // Regra herdada: venda não-draft/cancelled exige cliente.
    if (v2Status !== "draft" && v2Status !== "quotation" && !input.customerId) {
      throw new Error("Selecione um cliente para finalizar o pedido.");
    }

    const head: SaleInsert = {
      company_id: this.companyId,
      customer_id: input.customerId ?? null,
      status: dbStatus,
      items_total: priced.itemsTotal,
      discount: priced.discount,
      shipping: priced.shipping,
      grand_total: priced.grandTotal,
      sale_date: input.saleDate ?? null,
      notes: input.notes ?? null,
    } as SaleInsert;

    const sale = await this.repo.insertHead(head);

    const itemRows = priced.items.map((it, idx) => ({
      sale_id: sale.id,
      product_id: it.productId,
      description: it.description ?? "",
      quantity: it.quantity,
      unit_price: it.unitPrice,
      discount: it.discount,
      total: it.total,
      position: idx,
      unit_cost: it.unitCost ?? null,
    }));
    await this.repo.insertItems(itemRows as never);

    // Reserva de estoque quando aplicável.
    if (RESERVE_STATES.includes(v2Status)) {
      try {
        await this.reservation.reserve(sale.id, enriched);
        await emitAgentEvent({
          type: "sale.reserved",
          ctx: this.ctx,
          payload: { saleId: sale.id, itemsCount: enriched.length },
        });
      } catch (err) {
        this.log.warn("sales.reservation_failed", {
          saleId: sale.id,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }

    await emitAgentEvent({
      type: "sale.created",
      ctx: this.ctx,
      payload: {
        saleId: sale.id,
        v2Status,
        grandTotal: priced.grandTotal,
        itemsCount: enriched.length,
      },
    });

    if (v2Status === "invoiced") {
      await emitAgentEvent({
        type: "sale.invoiced",
        ctx: this.ctx,
        payload: { saleId: sale.id, grandTotal: priced.grandTotal },
      });
    }

    return this.toSummary(sale, priced.items.length, null);
  }

  async list(filters: SalesListFilters): Promise<SaleOrderSummary[]> {
    const rows = await this.repo.list(filters);
    const customerIds = Array.from(
      new Set(rows.map((r) => r.customer_id).filter((v): v is string => Boolean(v))),
    );
    const nameMap = await this.fetchCustomerNames(customerIds);
    return rows.map((r) => this.toSummary(r, 0, nameMap.get(r.customer_id ?? "") ?? null));
  }

  async getWithItems(id: string): Promise<SaleWithItemsV2 | null> {
    const head = await this.repo.findById(id);
    if (!head) return null;
    const items = await this.repo.findItems(id);
    const nameMap = head.customer_id
      ? await this.fetchCustomerNames([head.customer_id])
      : new Map<string, string>();
    return {
      ...head,
      items,
      customer_name: nameMap.get(head.customer_id ?? "") ?? null,
      v2Status: dbStatusToV2(head.status),
    };
  }

  async cancel(saleId: string, reason?: string | null): Promise<SaleOrderSummary> {
    const existing = await this.repo.findById(saleId);
    if (!existing) throw new Error("Venda não encontrada.");
    const cancelled = await this.repo.cancelViaRpc(saleId, reason ?? null);
    await emitAgentEvent({
      type: "sale.cancelled",
      ctx: this.ctx,
      payload: { saleId, reason: reason ?? null },
    });
    return this.toSummary(cancelled, 0, null);
  }

  async marginFor(
    filters: { saleId?: string; dateFrom?: string; dateTo?: string },
  ) {
    return this.analytics.computeMargin(filters);
  }

  async bestCustomers(
    filters: { dateFrom?: string; dateTo?: string; limit?: number },
  ) {
    return this.analytics.bestCustomers(filters);
  }

  // ---------- helpers ----------
  private async fetchCustomerNames(ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;
    const { data, error } = await this.supabase
      .from("customers")
      .select("id, name")
      .eq("company_id", this.companyId)
      .in("id", ids);
    if (error) throw error;
    for (const c of (data ?? []) as Array<{ id: string; name: string | null }>) {
      if (c.name) map.set(c.id, c.name);
    }
    return map;
  }

  private toSummary(
    sale: Sale,
    itemsCount: number,
    customerName: string | null,
  ): SaleOrderSummary {
    return {
      id: sale.id,
      number: sale.number ?? null,
      customerId: sale.customer_id ?? null,
      customerName,
      status: dbStatusToV2(sale.status),
      dbStatus: sale.status ?? "draft",
      itemsTotal: Number(sale.items_total ?? 0),
      discount: Number(sale.discount ?? 0),
      shipping: Number(sale.shipping ?? 0),
      grandTotal: Number(sale.grand_total ?? 0),
      itemsCount,
      saleDate: sale.sale_date ?? null,
      createdAt: sale.created_at ?? null,
    };
  }
}

// Reexport to make ExecutionContext type accessible externally if needed.
export type { ExecutionContext, Sale, SaleItem };
