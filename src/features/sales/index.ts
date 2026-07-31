export * from "./types";
// Núcleo reutilizável (PDV, marketplace, Bella IA, API)
export * from "./engine";
export * from "./store/sale-store";
export { useSaleDraft } from "./hooks/use-sale-draft";
export * from "./lib/payments";
export * from "./lib/totals";
export * from "./lib/stock";
export { salesService } from "./services/sales.service";
export * from "./hooks/use-sales";

export { SaleStatusBadge } from "./components/sale-status-badge";
export { SaleMetrics } from "./components/sale-metrics";
export { SaleFilters } from "./components/sale-filters";
export { SaleTable } from "./components/sale-table";
export { SaleForm } from "./components/sale-form";
export { SaleItemsEditor } from "./components/sale-items-editor";
export { SaleTimeline } from "./components/sale-timeline";
export { CheckoutDialog } from "./components/checkout-dialog";
export { SaleReceipt } from "./components/sale-receipt";
export { ReceiptDialog } from "./components/receipt-dialog";

export { TestSaleBadge } from "./components/test-sale-badge";
export { DataScopeFilter } from "./components/data-scope-filter";
export * from "./lib/test-data-scope";
