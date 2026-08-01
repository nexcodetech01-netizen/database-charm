/**
 * Lista de Interesse (Sprint Comercial 8.1) — barrel público.
 *
 * Módulo somente de registro de demanda: não cria venda, não reserva
 * estoque e não envia mensagens automáticas a clientes.
 */
export * from "./types";
export { interestsService } from "./services/interests.service";
export * from "./hooks/use-interests";
export * from "./hooks/use-interest-options";
export * from "./lib/interest-insights";
export { InterestStatusBadge } from "./components/interest-status-badge";
export { InterestForm } from "./components/interest-form";
export { InterestTable } from "./components/interest-table";
export { InterestBellaHints } from "./components/interest-bella-hints";
export { ProductInterestPanel } from "./components/product-interest-panel";
export { CustomerInterestsPanel } from "./components/customer-interests-panel";
export { InterestDashboardCard } from "./components/interest-dashboard-card";
