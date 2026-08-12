import { z } from "zod";

export const fiscalEnvironmentSchema = z.enum(["homologation", "production"]);

export type NfeEnvironment = z.infer<typeof fiscalEnvironmentSchema>;

export const FISCAL_ENVIRONMENTS = ["homologation", "production"] as const;

export const FISCAL_ENVIRONMENT_CONSTRAINTS = [
  "fiscal_provider_config_environment_check",
  "fiscal_documents_environment_check",
  "fiscal_provider_environments_environment_check",
] as const;

export function normalizeFiscalEnvironment(value: unknown): NfeEnvironment {
  if (value === "production") return "production";
  return "homologation";
}

