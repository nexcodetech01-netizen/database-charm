import type { EmitInput } from "../BellaEventEngine";
import type { BellaEventModule } from "../BellaEventTypes";

export interface DetectorContext {
  tenantId: string;
  now: Date;
}

export interface DetectorResult {
  /** Eventos que devem ser emitidos/upsertados. */
  emit: EmitInput[];
  /**
   * Chaves de eventos que devem ser resolvidos porque a condição
   * deixou de ser verdade (ex.: estoque reposto).
   * Formato: `${tenantId}::${type}::${entityId}` (ver `deriveEventKey`).
   */
  resolve: string[];
}

/**
 * Contrato puro dos detectores. Não acessam banco: recebem os dados
 * já buscados pelos módulos existentes (KPIs, snapshots, etc.).
 *
 * A responsabilidade de invocar os detectores com dados reais fica
 * para uma camada de orquestração futura — nesta sprint eles são
 * apenas as regras determinísticas.
 */
export interface BellaEventDetector<Input> {
  id: string;
  module: BellaEventModule;
  detect(input: Input, ctx: DetectorContext): DetectorResult;
}

export function emptyResult(): DetectorResult {
  return { emit: [], resolve: [] };
}
