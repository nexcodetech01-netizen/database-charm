/**
 * Policy Resolver — tipos
 * =======================
 *
 * Camada externa ao Core. Não modifica nada em `engine/*`.
 * Descreve políticas por escopo (Empresa, Categoria, Produto) e o
 * contrato de resolução que alimenta o `PricingContextFactory`.
 *
 * Referências normativas:
 *   - docs/INTELIGENCIA_COMERCIAL.md §17–§29
 *   - docs/architecture/ADR-001, ADR-004, ADR-006
 */
import type {
  ChannelContract,
  CommercialBehaviorSpec,
  CostComposition,
  CurrencyCode,
  MarginTargetSpec,
  PriceListEntry,
  PricingClock,
  RequestedBy,
  RoundingPolicySpec,
  TaxQuote,
} from "../engine/types";

// ─────────────────────────────────────────────────────────────────────────────
// Versionamento local do resolver (independente do Core)
// ─────────────────────────────────────────────────────────────────────────────

export const RESOLVER_VERSION = "policy-resolver/1.0.0" as const;
export const RESOLUTION_VERSION = "policy-resolution/1" as const;

// ─────────────────────────────────────────────────────────────────────────────
// Warnings do resolver (não confundir com PricingWarning do Core)
// ─────────────────────────────────────────────────────────────────────────────

export type ResolverWarningCode =
  | "POLICY_OVERRIDE_APPLIED"
  | "POLICY_CONFLICT_RESOLVED"
  | "PRICE_LIST_NOT_APPLICABLE"
  | "PRICE_LIST_MULTIPLE_CANDIDATES"
  | "PRICE_LIST_CURRENCY_MISMATCH"
  | "MISSING_COMPANY_DEFAULTS"
  | "MISSING_COST_COMPOSITION"
  | "TAX_QUOTE_CURRENCY_MISMATCH";

export interface ResolverWarning {
  code: ResolverWarningCode;
  message: string;
  /** Campo ou domínio afetado (ex.: "marginTarget", "priceList"). */
  field?: string;
  detail?: Readonly<Record<string, unknown>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Camadas de política — por escopo
// ─────────────────────────────────────────────────────────────────────────────

/** Campos de política que podem existir em qualquer camada (opcionais). */
export interface PolicyOverrides {
  marginTarget?: MarginTargetSpec;
  commercialBehavior?: CommercialBehaviorSpec;
  roundingPolicy?: RoundingPolicySpec;
  minMarginPct?: number;
  idealMarginPct?: number;
  premiumMarginPct?: number;
}

/** Camada Empresa. Currency e defaults vivem aqui. */
export interface CompanyPolicy extends PolicyOverrides {
  companyId: string;
  currency: CurrencyCode;
  /**
   * Defaults obrigatórios em uma empresa sadia. Se ausentes, warning
   * `MISSING_COMPANY_DEFAULTS` e assume 0/0/0.
   */
  defaults?: {
    minMarginPct?: number;
    idealMarginPct?: number;
    premiumMarginPct?: number;
  };
}

/** Camada Categoria. */
export interface CategoryPolicy extends PolicyOverrides {
  categoryId: string;
  name?: string;
}

/** Camada Produto. Mais alta prioridade no merge. */
export interface ProductPolicy extends PolicyOverrides {
  productId: string;
  sku?: string;
  priceFloorCents?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rastreio de resolução
// ─────────────────────────────────────────────────────────────────────────────

/** Origem de cada campo após o merge. Estável — usado em auditoria. */
export type PolicySource = Readonly<Record<string, PolicyLayerName>>;

export type PolicyLayerName = "product" | "category" | "company" | "system" | "context";

export interface PolicyAppliedRule {
  /** Nome do campo de política resolvido. */
  field: string;
  /** Camada vencedora. */
  layer: PolicyLayerName;
  /** Camadas que também definiram o campo (indica override). */
  shadowed: PolicyLayerName[];
  /** Valor efetivo aplicado (informativo). */
  value?: unknown;
}

/** Resultado do estágio de resolução — anexado ao retorno da factory. */
export interface PolicyResolution {
  readonly resolverVersion: typeof RESOLVER_VERSION;
  readonly resolutionVersion: typeof RESOLUTION_VERSION;
  readonly policySource: PolicySource;
  readonly appliedRules: readonly PolicyAppliedRule[];
  readonly warnings: readonly ResolverWarning[];
  /** Modo escolhido pelo resolver com base na PriceList disponível. */
  readonly pricingMode: "derived" | "tabled";
}

// ─────────────────────────────────────────────────────────────────────────────
// Entrada da factory
// ─────────────────────────────────────────────────────────────────────────────

export interface PricingContextInput {
  company: CompanyPolicy;
  category?: CategoryPolicy;
  product: ProductPolicy;

  /** Snapshots externos — resolver apenas repassa ao Core. */
  costComposition: CostComposition;
  channel?: ChannelContract;
  taxQuote?: TaxQuote;

  /** Candidatas de PriceList (o resolver escolhe a aplicável). */
  priceListCandidates?: readonly PriceListEntry[];

  /** Segmento e loja — repassados. */
  customerSegment?: { id: string; tier?: string };
  store?: { id: string; region?: string };

  /**
   * Overrides pontuais do próprio caller (ex.: simulador com margem custom).
   * Vence tudo — camada `context`.
   */
  contextOverrides?: PolicyOverrides;

  /** Quantidade de venda — impacta seleção de PriceList e rateio de fixos. */
  quantity: number;

  clock: PricingClock;
  requestId: string;
  requestedBy: RequestedBy;
  /** Se omitido, herda de `company.currency`. */
  currency?: CurrencyCode;
}
