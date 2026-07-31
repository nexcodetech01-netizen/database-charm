/**
 * Barrel público do módulo v2 de Estoque (Sprint 003).
 */
export { InventoryRepository } from "./repository/inventory.repository";
export { StockRepository } from "./repository/stock.repository";
export type { StockRow, StagnantRow } from "./repository/stock.repository";
export { InventoryMovementService } from "./service/inventory-movement.service";
export { StockService } from "./service/stock.service";
export type { StockBalance, StockOpInput, ProductLookup } from "./service/stock.service";
export * from "./skills";
