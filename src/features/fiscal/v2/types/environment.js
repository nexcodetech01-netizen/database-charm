import { z } from "zod";
export const FISCAL_ENVIRONMENTS = ["homologation", "production"];
export const fiscalEnvironmentSchema = z.enum(FISCAL_ENVIRONMENTS);
/** Tabelas cujo CHECK de ambiente deve bater com FISCAL_ENVIRONMENTS. */
export const FISCAL_ENVIRONMENT_CONSTRAINTS = [
    "fiscal_documents_environment_check",
    "fiscal_provider_config_environment_check",
    "fiscal_settings_default_environment_check",
];
/**
 * Normaliza qualquer valor legado/externo para o enum canônico.
 * Default seguro: homologação (nunca produção por engano).
 */
export function normalizeFiscalEnvironment(value) {
    return String(value ?? "").toLowerCase() === "production" ? "production" : "homologation";
}
