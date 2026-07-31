/**
 * Bella Sales Copilot — Tipos públicos.
 *
 * Camada de orquestração conversacional para conduzir uma venda de
 * ponta a ponta. NÃO duplica regra de negócio: todo efeito real passa
 * pelas Skills existentes via BellaSkillRegistry (executadas pelo
 * BellaWorkflowEngine ou pelo Action Engine).
 */

import type { BellaEntityRef } from "../memory/MemoryTypes";
import type { BellaSkillResult } from "../skills/types";
import type {
  BellaWorkflowExecutionResult,
  BellaWorkflowProgress,
} from "../workflows/BellaWorkflowTypes";

/** Fases da jornada de venda conduzida pela Bella. */
export type SalesStage =
  | "idle"
  | "discovery"
  | "customer_lookup"
  | "customer_create"
  | "product_search"
  | "presentation"
  | "quote_build"
  | "discount"
  | "summary"
  | "confirmation"
  | "order_generation"
  | "payment"
  | "closed"
  | "cancelled";

/** Canal em que a conversa acontece. */
export type SalesChannel = "chat" | "whatsapp";

/** Item selecionado no orçamento em construção. */
export interface SalesLineItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  notes?: string;
}

/** Recomendação retornada ao operador/cliente. */
export interface SalesProductSuggestion {
  productId: string;
  label: string;
  reason: "similar" | "same_category" | "same_brand" | "price_range";
  price?: number;
}

/** Snapshot conversacional consumido por UI e WhatsApp. */
export interface SalesCopilotSnapshot {
  channel: SalesChannel;
  stage: SalesStage;
  customer: BellaEntityRef | null;
  quote: BellaEntityRef | null;
  items: SalesLineItem[];
  discountPercent: number;
  paymentMethod: string | null;
  notes: string | null;
  totals: {
    subtotal: number;
    discount: number;
    grandTotal: number;
    itemCount: number;
  };
  workflow: BellaWorkflowProgress | null;
  updatedAt: number;
}

/** Métricas agregadas em memória (não persiste — reset por processo). */
export interface SalesCopilotMetrics {
  started: number;
  completed: number;
  cancelled: number;
  totalInteractions: number;
  totalDurationMs: number;
  skillsUsed: Record<string, number>;
  cancellationReasons: Record<string, number>;
}

/** Log estruturado (in-memory). */
export type SalesLogEvent =
  | "session_started"
  | "stage_changed"
  | "customer_selected"
  | "customer_created"
  | "product_added"
  | "product_removed"
  | "quantity_changed"
  | "discount_applied"
  | "summary_shown"
  | "confirmation_requested"
  | "sale_confirmed"
  | "sale_cancelled"
  | "skill_executed"
  | "workflow_advanced"
  | "session_closed";

export interface SalesLogEntry {
  event: SalesLogEvent;
  tenantId: string;
  userId: string;
  channel: SalesChannel;
  at: number;
  detail?: string;
  skillId?: string;
  workflowInstanceId?: string;
}

/** Resultado padrão de qualquer comando do Copilot. */
export interface SalesCopilotResult {
  ok: boolean;
  message: string;
  snapshot: SalesCopilotSnapshot;
  /** Perguntas pendentes para o operador/cliente (missing_fields). */
  followUps?: string[];
  /** Última execução de Skill/Workflow — útil para o chat renderizar. */
  lastSkillResult?: BellaSkillResult;
  lastWorkflow?: BellaWorkflowExecutionResult;
}

/** Contexto mínimo aceito por todo comando (chat OU whatsapp). */
export interface SalesCopilotContext {
  tenantId: string;
  userId: string;
  channel: SalesChannel;
}
