/**
 * PolicyMergeResolver
 * ===================
 *
 * Aplica precedência campo-a-campo: context > product > category > company.
 * Emite `PolicyAppliedRule` por campo com `shadowed` para overrides silenciosos.
 * Emite `POLICY_CONFLICT_RESOLVED` quando ≥2 camadas concorrem no mesmo campo.
 *
 * PURO. Não conhece Core.
 */
import type { CompanyLayer } from "./company-policy-resolver";
import type { CategoryLayer } from "./category-policy-resolver";
import type { ProductLayer } from "./product-policy-resolver";
import type {
  PolicyAppliedRule,
  PolicyLayerName,
  PolicyOverrides,
  PolicySource,
  ResolverWarning,
} from "./types";

/** Campos que compõem uma política mesclável. */
const POLICY_FIELDS = [
  "marginTarget",
  "commercialBehavior",
  "roundingPolicy",
  "minMarginPct",
  "idealMarginPct",
  "premiumMarginPct",
] as const;

type PolicyField = (typeof POLICY_FIELDS)[number];

/** Camadas em ordem de prioridade DECRESCENTE (primeiro = mais forte). */
interface LayerEntry {
  name: PolicyLayerName;
  overrides: Readonly<PolicyOverrides>;
}

export interface MergeResult {
  readonly merged: Readonly<PolicyOverrides>;
  readonly policySource: PolicySource;
  readonly appliedRules: readonly PolicyAppliedRule[];
  readonly warnings: readonly ResolverWarning[];
}

const isDefined = (v: unknown): boolean => v !== undefined && v !== null;

export function mergePolicies(input: {
  company: CompanyLayer;
  category: CategoryLayer;
  product: ProductLayer;
  contextOverrides?: Readonly<PolicyOverrides>;
}): MergeResult {
  const layers: LayerEntry[] = [];
  if (input.contextOverrides && Object.keys(input.contextOverrides).length > 0) {
    layers.push({ name: "context", overrides: input.contextOverrides });
  }
  layers.push({ name: "product", overrides: input.product.overrides });
  layers.push({ name: "category", overrides: input.category.overrides });
  layers.push({ name: "company", overrides: input.company.overrides });

  const merged: Record<string, unknown> = {};
  const policySource: Record<string, PolicyLayerName> = {};
  const appliedRules: PolicyAppliedRule[] = [];
  const warnings: ResolverWarning[] = [];

  for (const field of POLICY_FIELDS) {
    let winner: LayerEntry | undefined;
    const shadowed: PolicyLayerName[] = [];
    for (const layer of layers) {
      const v = (layer.overrides as Record<PolicyField, unknown>)[field];
      if (!isDefined(v)) continue;
      if (!winner) {
        winner = layer;
      } else {
        shadowed.push(layer.name);
      }
    }
    if (winner) {
      const value = (winner.overrides as Record<PolicyField, unknown>)[field];
      merged[field] = value;
      policySource[field] = winner.name;
      appliedRules.push({
        field,
        layer: winner.name,
        shadowed,
        value,
      });
      if (shadowed.length > 0) {
        warnings.push({
          code: "POLICY_CONFLICT_RESOLVED",
          message: `Campo "${field}" definido em múltiplas camadas — vencedor: ${winner.name}, sombreados: ${shadowed.join(", ")}.`,
          field,
          detail: { winner: winner.name, shadowed },
        });
      } else if (winner.name !== "company") {
        // Override silencioso sobre defaults implícitos de empresa: registra info.
        warnings.push({
          code: "POLICY_OVERRIDE_APPLIED",
          message: `Campo "${field}" resolvido pela camada ${winner.name}.`,
          field,
          detail: { layer: winner.name },
        });
      }
    } else {
      // Nenhuma camada definiu — o Core aplica seus fallbacks (system).
      policySource[field] = "system";
    }
  }

  return {
    merged: merged as Readonly<PolicyOverrides>,
    policySource,
    appliedRules,
    warnings,
  };
}
