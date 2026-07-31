/**
 * Barrel público do módulo v2 de Vendas (Sprint 005).
 *
 * Reutiliza integralmente a infraestrutura das Sprints 001.5, 002 e 003:
 *  - BaseService/BaseSkill/ExecutionContext (agent/infrastructure).
 *  - StockService v2 (motor `apply_inventory_movement`).
 *  - RPCs oficiais `cancel_sale`, `settle_financial_transaction`.
 *
 * Nenhum schema de banco novo foi criado nesta sprint.
 */
export * from "./types";
export * from "./schemas";
export { SalesRepository } from "./repository/sales.repository";
export type { SalesListFilters, SaleWithItemsRow } from "./repository/sales.repository";
export { SalesAnalyticsRepository } from "./repository/analytics.repository";

export { SalesOrderService } from "./service/sales-order.service";
export { SalesPricingService } from "./service/sales-pricing.service";
export type { PricedItem, PricedOrder } from "./service/sales-pricing.service";
export { SalesReservationService } from "./service/sales-reservation.service";
export type { ReservationOutcome } from "./service/sales-reservation.service";

export * from "./skills";
