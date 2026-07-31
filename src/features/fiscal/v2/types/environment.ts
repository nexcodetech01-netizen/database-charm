/**
 * Fiscal v2 — ENUM CANÔNICO DE AMBIENTE (fonte única de verdade).
 *
 * ⚠ Um único vocabulário em todo o sistema (banco, tipos, Zod, provider, UI):
 *
 *    "homologation" | "production"
 *
 * NUNCA usar variações: homolog, homologacao, sandbox, test, HOMOLOGATION.
 *
 * Constraints do banco alinhadas a esta lista:
 *  - fiscal_documents.environment
 *  - fiscal_provider_config.environment
 *  - fiscal_settings.default_environment
 */
import { z } from "zod";

export const FISCAL_ENVIRONMENTS = ["homologation", "production"] as const;

export type NfeEnvironment = (typeof FISCAL_ENVIRONMENTS)[number];

export const fiscalEnvironmentSchema = z.enum(FISCAL_ENVIRONMENTS);

/** Tabelas cujo CHECK de ambiente deve bater com FISCAL_ENVIRONMENTS. */
export const FISCAL_ENVIRONMENT_CONSTRAINTS = [
  "fiscal_documents_environment_check",
  "fiscal_provider_config_environment_check",
  "fiscal_settings_default_environment_check",
] as const;

/**
 * Normaliza qualquer valor legado/externo para o enum canônico.
 * Default seguro: homologação (nunca produção por engano).
 */
export function normalizeFiscalEnvironment(value: unknown): NfeEnvironment {
  return String(value ?? "").toLowerCase() === "production" ? "production" : "homologation";
}
