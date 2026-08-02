/**
 * ChannelContract — factory + validador
 * =====================================
 * Espelha `ChannelContract.v1`. Canal é dono do Sales (ADR-006);
 * aqui apenas validamos a forma para injeção segura no PricingContext.
 */
import { CHANNEL_CONTRACT_VERSION, type ChannelContract } from "../engine/types";
import type { DomainIssue } from "./errors";
import {
  issue,
  isFiniteNumber,
  validateCents,
  validatePct,
  validateRequiredString,
} from "./primitives";

export interface ChannelContractInput {
  channelId: string;
  variableFeePct: number;
  fixedFeePerOrderCents: number;
  operationalCostCents: number;
  minMarginOverridePct?: number;
  hasNonLinearRules?: boolean;
}

export function createChannelContract(input: ChannelContractInput): ChannelContract {
  return {
    channelId: input.channelId,
    variableFeePct: input.variableFeePct,
    fixedFeePerOrderCents: input.fixedFeePerOrderCents,
    operationalCostCents: input.operationalCostCents,
    minMarginOverridePct: input.minMarginOverridePct,
    hasNonLinearRules: input.hasNonLinearRules,
    version: CHANNEL_CONTRACT_VERSION,
  };
}

export function validateChannelContract(value: unknown, path = "channelContract"): DomainIssue[] {
  if (value === null || typeof value !== "object") {
    return [issue("INVALID_TYPE", path, `${path} deve ser objeto`)];
  }
  const c = value as Record<string, unknown>;
  const issues: DomainIssue[] = [];

  if (c.version !== CHANNEL_CONTRACT_VERSION) {
    issues.push(
      issue(
        "UNSUPPORTED_CONFIG_VERSION",
        `${path}.version`,
        `versão de ChannelContract não suportada`,
        { expected: CHANNEL_CONTRACT_VERSION, actual: c.version },
      ),
    );
  }

  issues.push(...validateRequiredString(c.channelId, `${path}.channelId`));

  if (!isFiniteNumber(c.variableFeePct)) {
    issues.push(issue("INVALID_NUMBER", `${path}.variableFeePct`, `variableFeePct inválido`));
  } else if (c.variableFeePct < 0 || c.variableFeePct > 100) {
    issues.push(
      issue(
        "CHANNEL_FEE_OUT_OF_RANGE",
        `${path}.variableFeePct`,
        `variableFeePct deve estar em [0..100]`,
        { value: c.variableFeePct },
      ),
    );
  }

  issues.push(...validateCents(c.fixedFeePerOrderCents, `${path}.fixedFeePerOrderCents`));
  issues.push(...validateCents(c.operationalCostCents, `${path}.operationalCostCents`));

  if (c.minMarginOverridePct !== undefined) {
    issues.push(
      ...validatePct(c.minMarginOverridePct, `${path}.minMarginOverridePct`, {
        min: -100,
        max: 100,
      }),
    );
  }

  if (c.hasNonLinearRules !== undefined && typeof c.hasNonLinearRules !== "boolean") {
    issues.push(issue("INVALID_TYPE", `${path}.hasNonLinearRules`, `deve ser boolean`));
  }

  return issues;
}
