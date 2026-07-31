/**
 * Barrel público — Finance v2 (Sprint 006).
 *
 * Reutiliza integralmente a infraestrutura das Sprints 001.5, 002, 003 e 005:
 *  - BaseService/BaseSkill/ExecutionContext (agent/infrastructure).
 *  - RPCs oficiais `settle_financial_transaction` e `reverse_financial_transaction`.
 *
 * Nenhum schema de banco novo foi criado nesta sprint.
 */
export * from "./types";
export * from "./schemas";
export { AccountsReceivableRepository } from "./repository/receivables.repository";
export type { ReceivablesFilters } from "./repository/receivables.repository";
export { AccountsPayableRepository } from "./repository/payables.repository";
export type { PayablesFilters } from "./repository/payables.repository";
export { CashFlowRepository } from "./repository/cashflow.repository";

export { AccountsReceivableService } from "./service/accounts-receivable.service";
export type { SettleReceivableInput } from "./service/accounts-receivable.service";
export { AccountsPayableService } from "./service/accounts-payable.service";
export type { SettlePayableInput } from "./service/accounts-payable.service";
export { CashFlowService } from "./service/cashflow.service";
export { FinancialReportsService } from "./service/financial-reports.service";

export * from "./skills";
