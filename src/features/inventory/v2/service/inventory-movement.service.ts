/**
 * InventoryMovementService (Sprint 003)
 *
 * Encapsula a criação de movimentações de estoque via motor oficial
 * (`inventory_movements` → trigger `apply_inventory_movement`).
 * Emite log/metrics/EventBus para auditoria e observabilidade.
 * Nunca faz UPDATE direto em `products.stock`.
 */
import { BaseService } from "@/features/bella-ai/agent/infrastructure/base-service";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
// EventBus: emitAgentEvent está disponível para consumidores que quiserem
// disparar `inventory.min_stock_reached` / `inventory.out_of_stock` — este
// serviço mantém-se silencioso e delega a detecção ao BellaEventEngine.
import {
  InventoryRepository,
  type CreateMovementInput,
  type HistoryFilters,
} from "../repository/inventory.repository";
import type { InventoryMovement } from "../../types";

export interface RecordMovementInput {
  productId: string;
  quantity: number;
  type: "in" | "out" | "adjustment";
  reason?: string | null;
  notes?: string | null;
  referenceNumber?: string | null;
  source?: string;
}

export class InventoryMovementService extends BaseService {
  private readonly repo: InventoryRepository;

  constructor(ctx: ExecutionContext) {
    super(ctx);
    this.repo = new InventoryRepository(ctx);
  }

  async history(filters: HistoryFilters): Promise<InventoryMovement[]> {
    this.log.debug("inventory.history", { filters });
    return this.repo.history(filters);
  }

  async record(input: RecordMovementInput): Promise<InventoryMovement> {
    if (!input.productId) throw new Error("productId é obrigatório.");
    if (input.quantity === 0) throw new Error("Quantidade não pode ser zero.");
    if (input.type !== "adjustment" && input.quantity < 0)
      throw new Error(
        "Quantidade deve ser positiva para entrada/saída (use adjustment para deltas negativos).",
      );
    if (!["in", "out", "adjustment"].includes(input.type))
      throw new Error("Tipo de movimento inválido.");

    const payload: CreateMovementInput = {
      productId: input.productId,
      quantity: input.quantity,
      type: input.type,
      source: ["manual", "purchase", "sale", "adjustment", "sale_return", "sale_cancellation", "system", "opening"].includes(input.source || "") ? (input.source!) : "manual",
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      referenceNumber: input.referenceNumber ?? null,
      userId: this.ctx.userId,
    };

    const mov = await this.repo.create(payload);
    this.metrics.counter("inventory.movement.recorded", {
      companyId: this.companyId,
      type: input.type,
      source: payload.source,
    });
    this.log.info("inventory.movement_recorded", {
      movementId: mov.id,
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
    });
    return mov;
  }
}
