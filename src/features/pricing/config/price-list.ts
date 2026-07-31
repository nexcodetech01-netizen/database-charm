/**
 * PriceList — agregado de domínio
 * ===============================
 * O Core (§23 / ADR-003) consome apenas UMA `PriceListEntry` aplicável.
 * O agregado `PriceList` vive aqui, no domínio de configuração comercial,
 * e é responsável por:
 *   - conter múltiplas entries (por produto, faixa de qty, prioridade)
 *   - garantir consistência (moeda uniforme, sem sobreposição de faixas)
 *   - servir de fonte para o resolver escolher a entry vencedora
 */
import { PRICE_LIST_VERSION, type PriceListEntry } from "../engine/types";
import type { DomainIssue } from "./errors";
import {
  isFiniteNumber,
  issue,
  validateCents,
  validateCurrency,
  validateRequiredString,
} from "./primitives";

export const PRICE_LIST_AGGREGATE_VERSION = "price-list-aggregate/1" as const;

export type PriceListFallback = PriceListEntry["fallback"];

export interface PriceListEntryInput {
  productId: string;
  priceCents: number;
  currency: string;
  minQty?: number;
  maxQty?: number;
  fallback?: PriceListFallback;
  priority?: number;
}

export interface PriceListScope {
  channelIds?: readonly string[];
  segmentIds?: readonly string[];
  storeIds?: readonly string[];
  validFrom?: string;
  validTo?: string;
}

export interface PriceListAggregate {
  readonly version: typeof PRICE_LIST_AGGREGATE_VERSION;
  readonly priceListId: string;
  readonly name?: string;
  readonly currency: string;
  readonly priority: number;
  readonly scope: PriceListScope;
  readonly entries: readonly PriceListEntry[];
}

export interface PriceListInput {
  priceListId: string;
  name?: string;
  currency: string;
  priority?: number;
  scope?: PriceListScope;
  entries: readonly PriceListEntryInput[];
}

export function createPriceListEntry(
  priceListId: string,
  input: PriceListEntryInput,
): PriceListEntry {
  return {
    version: PRICE_LIST_VERSION,
    priceListId,
    productId: input.productId,
    priceCents: input.priceCents,
    currency: input.currency,
    minQty: input.minQty,
    maxQty: input.maxQty,
    fallback: input.fallback ?? "derived",
    priority: input.priority,
  };
}

export function createPriceList(input: PriceListInput): PriceListAggregate {
  const priority = input.priority ?? 0;
  const entries = input.entries.map((e) =>
    createPriceListEntry(input.priceListId, {
      ...e,
      currency: e.currency ?? input.currency,
      priority: e.priority ?? priority,
    }),
  );
  return {
    version: PRICE_LIST_AGGREGATE_VERSION,
    priceListId: input.priceListId,
    name: input.name,
    currency: input.currency,
    priority,
    scope: input.scope ?? {},
    entries,
  };
}

export function validatePriceListEntry(
  value: unknown,
  path = "entry",
): DomainIssue[] {
  if (value === null || typeof value !== "object") {
    return [issue("INVALID_TYPE", path, `${path} deve ser objeto`)];
  }
  const e = value as Record<string, unknown>;
  const issues: DomainIssue[] = [];

  if (e.version !== PRICE_LIST_VERSION) {
    issues.push(
      issue(
        "UNSUPPORTED_CONFIG_VERSION",
        `${path}.version`,
        `versão de PriceListEntry não suportada`,
        { expected: PRICE_LIST_VERSION, actual: e.version },
      ),
    );
  }

  issues.push(...validateRequiredString(e.priceListId, `${path}.priceListId`));
  issues.push(...validateRequiredString(e.productId, `${path}.productId`));
  issues.push(...validateCents(e.priceCents, `${path}.priceCents`));
  issues.push(...validateCurrency(e.currency, `${path}.currency`));

  if (e.fallback !== undefined && e.fallback !== "derived" && e.fallback !== "reject") {
    issues.push(
      issue("INVALID_ENUM", `${path}.fallback`, `fallback inválido`, {
        expected: ["derived", "reject"],
        actual: e.fallback,
      }),
    );
  }

  if (e.minQty !== undefined && (!isFiniteNumber(e.minQty) || e.minQty < 0)) {
    issues.push(issue("OUT_OF_RANGE", `${path}.minQty`, `minQty deve ser ≥ 0`));
  }
  if (e.maxQty !== undefined && (!isFiniteNumber(e.maxQty) || e.maxQty <= 0)) {
    issues.push(issue("OUT_OF_RANGE", `${path}.maxQty`, `maxQty deve ser > 0`));
  }
  if (
    isFiniteNumber(e.minQty) &&
    isFiniteNumber(e.maxQty) &&
    (e.maxQty as number) < (e.minQty as number)
  ) {
    issues.push(
      issue(
        "PRICE_LIST_RANGE_INVALID",
        `${path}.maxQty`,
        `maxQty < minQty`,
        { minQty: e.minQty, maxQty: e.maxQty },
      ),
    );
  }

  return issues;
}

export function validatePriceList(
  value: unknown,
  path = "priceList",
): DomainIssue[] {
  if (value === null || typeof value !== "object") {
    return [issue("INVALID_TYPE", path, `${path} deve ser objeto`)];
  }
  const pl = value as Record<string, unknown>;
  const issues: DomainIssue[] = [];

  if (pl.version !== PRICE_LIST_AGGREGATE_VERSION) {
    issues.push(
      issue(
        "UNSUPPORTED_CONFIG_VERSION",
        `${path}.version`,
        `versão de PriceList não suportada`,
        { expected: PRICE_LIST_AGGREGATE_VERSION, actual: pl.version },
      ),
    );
  }
  issues.push(...validateRequiredString(pl.priceListId, `${path}.priceListId`));
  issues.push(...validateCurrency(pl.currency, `${path}.currency`));

  const entries = pl.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    issues.push(
      issue("PRICE_LIST_EMPTY", `${path}.entries`, `PriceList deve ter ao menos 1 entry`),
    );
    return issues;
  }

  // Valida cada entry.
  entries.forEach((e, i) => {
    issues.push(...validatePriceListEntry(e, `${path}.entries[${i}]`));
  });

  // Consistência: currency uniforme.
  const currency = pl.currency;
  entries.forEach((raw, i) => {
    const e = raw as { currency?: unknown };
    if (e.currency !== currency) {
      issues.push(
        issue(
          "PRICE_LIST_CURRENCY_MIX",
          `${path}.entries[${i}].currency`,
          `currency da entry difere da PriceList`,
          { expected: currency, actual: e.currency },
        ),
      );
    }
  });

  // Detecta sobreposição de faixas para o mesmo produto.
  const byProduct = new Map<string, { min: number; max: number; index: number }[]>();
  entries.forEach((raw, i) => {
    const e = raw as PriceListEntry;
    if (!e.productId) return;
    const min = e.minQty ?? 0;
    const max = e.maxQty ?? Number.POSITIVE_INFINITY;
    const list = byProduct.get(e.productId) ?? [];
    for (const prev of list) {
      const overlap = min <= prev.max && prev.min <= max;
      if (overlap) {
        issues.push(
          issue(
            "PRICE_LIST_RANGE_OVERLAP",
            `${path}.entries[${i}]`,
            `faixa de qty sobrepõe entry #${prev.index}`,
            { productId: e.productId, previousIndex: prev.index },
          ),
        );
      }
    }
    list.push({ min, max, index: i });
    byProduct.set(e.productId, list);
  });

  return issues;
}
