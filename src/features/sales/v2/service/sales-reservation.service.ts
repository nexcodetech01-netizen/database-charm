/**
 * SalesReservationService (Sprint 005)
 *
 * Reserva e baixa de estoque para pedidos v2. TODO acesso a estoque
 * DELEGA ao StockService v2 (Sprint 003), que por sua vez usa o motor
 * oficial `apply_inventory_movement`. Nunca escreve em `products.stock`
 * nem em `inventory_movements` diretamente.
 *
 * Modo "reserva": registra saída lógica com `reason='sale_reservation'`.
 * Modo "invoice": registra saída de faturamento (`reason='sale_invoice'`).
 *
 * Observação: hoje a arquitetura NÃO tem uma tabela dedicada de
 * "reservas" — a Sprint 005 mantém compatibilidade e apenas dispara
 * a saída via motor único. Isso é o suficiente para: (a) manter saldo
 * físico consistente; (b) auditar via inventory_movements.
 */
import { BaseService } from "@/features/bella-ai/agent/infrastructure/base-service";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import { StockService } from "@/features/inventory/v2";
import type { SaleOrderItemInput } from "../types";

export interface ReservationOutcome {
  productId: string;
  movementId: string;
  quantity: number;
}

export class SalesReservationService extends BaseService {
  private readonly stock: StockService;

  constructor(ctx: ExecutionContext) {
    super(ctx);
    this.stock = new StockService(ctx);
  }

  async reserve(
    saleId: string,
    items: SaleOrderItemInput[],
  ): Promise<ReservationOutcome[]> {
    const out: ReservationOutcome[] = [];
    for (const it of items) {
      const mov = await this.stock.remove({
        productId: it.productId,
        query: null,
        quantity: it.quantity,
        reason: `sale_reservation:${saleId}`,
        notes: it.description ?? null,
      });
      out.push({ productId: it.productId, movementId: mov.id, quantity: it.quantity });
    }
    this.log.info("sales.reservation", { saleId, count: out.length });
    return out;
  }

  async invoice(
    saleId: string,
    items: SaleOrderItemInput[],
  ): Promise<ReservationOutcome[]> {
    const out: ReservationOutcome[] = [];
    for (const it of items) {
      const mov = await this.stock.remove({
        productId: it.productId,
        query: null,
        quantity: it.quantity,
        reason: `sale_invoice:${saleId}`,
        notes: it.description ?? null,
      });
      out.push({ productId: it.productId, movementId: mov.id, quantity: it.quantity });
    }
    this.log.info("sales.invoice", { saleId, count: out.length });
    return out;
  }
}
