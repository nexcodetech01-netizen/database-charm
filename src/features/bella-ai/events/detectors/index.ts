/**
 * Bella IA — Detectores (barrel)
 *
 * Regras determinísticas que transformam snapshots de dados dos módulos
 * existentes em `EmitInput` para o `BellaEventEngine`. Não acessam banco.
 */
export * from "./DetectorTypes";
export * from "./finance.detectors";
export * from "./inventory.detectors";
export * from "./customers.detectors";
export * from "./sales.detectors";
