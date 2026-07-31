/**
 * Bella IA — Tipos primitivos da camada de eventos
 *
 * Isolados em arquivo próprio para permitir imports leves (sem puxar
 * catálogo, registry ou detectores) em detectores, testes e futuros
 * adapters (Realtime/Webhooks/Cron).
 */

export type BellaEventModule =
  | "finance"
  | "customers"
  | "inventory"
  | "sales"
  | "fiscal";

export type BellaEventSeverity = "info" | "success" | "warning" | "critical";

/**
 * Catálogo tipado de eventos suportados. Adicionar aqui é o único ponto
 * de extensão necessário para novos módulos — o `BELLA_EVENT_CATALOG`
 * precisa ter uma entrada correspondente (o TS força).
 */
export type BellaEventType =
  // ============ Financeiro ============
  | "finance.invoice.overdue"
  | "finance.cashflow.negative"
  | "finance.revenue.above_average"
  | "finance.revenue.below_average"
  | "finance.expense.out_of_pattern"
  | "finance.expense.elevated"
  // ============ Financeiro v2 (Sprint 006) ============
  | "finance.receivable.created"
  | "finance.receivable.paid"
  | "finance.payable.created"
  | "finance.payable.paid"
  | "finance.cash.updated"
  // ============ Clientes ============
  | "customers.became_delinquent"
  | "customers.birthday"
  | "customers.returned_to_buy"
  | "customers.vip.inactive"
  // ============ Estoque ============
  | "inventory.min_stock_reached"
  | "inventory.slow_moving"
  | "inventory.out_of_stock"
  // ============ Vendas ============
  | "sales.goal_reached"
  | "sales.above_average"
  | "sales.decline"
  | "sales.average_ticket.drop"
  // ============ Vendas v2 (Sprint 005) ============
  | "sale.created"
  | "sale.approved"
  | "sale.reserved"
  | "sale.invoiced"
  | "sale.cancelled"
  // ============ Fiscal v2 (Sprint 007) ============
  | "fiscal.nfe.created"
  | "fiscal.nfe.sent"
  | "fiscal.nfe.authorized"
  | "fiscal.nfe.rejected"
  | "fiscal.nfe.cancelled";
