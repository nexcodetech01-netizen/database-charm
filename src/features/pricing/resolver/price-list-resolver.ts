/**
 * PriceListResolver
 * =================
 *
 * Escolhe a `PriceListEntry` aplicável ao contexto de venda e decide
 * o modo (`derived` | `tabled`) que o Core deverá honrar.
 *
 * Regras (§23):
 *   - Filtra por productId e currency compatível.
 *   - Considera minQty/maxQty.
 *   - Ordena por `priority` DESC (maior prioridade vence).
 *   - Empate resolve por menor `priceCents`.
 *   - Se >1 candidata aplicável emite `PRICE_LIST_MULTIPLE_CANDIDATES`.
 *
 * PURO. Não sobrescreve preços — apenas seleciona o entry.
 */
import type { CurrencyCode, PriceListEntry } from "../engine/types";
import type { ResolverWarning } from "./types";

export interface PriceListResolution {
  readonly selected?: PriceListEntry;
  readonly mode: "derived" | "tabled";
  readonly warnings: readonly ResolverWarning[];
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export function resolvePriceList(input: {
  candidates?: readonly PriceListEntry[];
  productId: string;
  currency: CurrencyCode;
  quantity: number;
}): PriceListResolution {
  const warnings: ResolverWarning[] = [];
  const candidates = input.candidates ?? [];
  if (candidates.length === 0) {
    return { mode: "derived", warnings };
  }

  const applicable: PriceListEntry[] = [];
  for (const entry of candidates) {
    if (entry.productId !== input.productId) continue;
    if (entry.currency !== input.currency) {
      warnings.push({
        code: "PRICE_LIST_CURRENCY_MISMATCH",
        message: `PriceList ${entry.priceListId} em ${entry.currency} incompatível com ${input.currency}.`,
        field: "priceList",
        detail: { priceListId: entry.priceListId },
      });
      continue;
    }
    const qtyOk =
      (!isNum(entry.minQty) || input.quantity >= entry.minQty) &&
      (!isNum(entry.maxQty) || input.quantity <= entry.maxQty);
    if (!qtyOk) {
      warnings.push({
        code: "PRICE_LIST_NOT_APPLICABLE",
        message: `PriceList ${entry.priceListId} fora do range de quantidade.`,
        field: "priceList",
        detail: {
          priceListId: entry.priceListId,
          quantity: input.quantity,
          minQty: entry.minQty,
          maxQty: entry.maxQty,
        },
      });
      continue;
    }
    applicable.push(entry);
  }

  if (applicable.length === 0) {
    return { mode: "derived", warnings };
  }

  const sorted = [...applicable].sort((a, b) => {
    const pa = isNum(a.priority) ? a.priority : 0;
    const pb = isNum(b.priority) ? b.priority : 0;
    if (pb !== pa) return pb - pa;
    return a.priceCents - b.priceCents;
  });

  const selected = sorted[0]!;

  if (applicable.length > 1) {
    warnings.push({
      code: "PRICE_LIST_MULTIPLE_CANDIDATES",
      message: `${applicable.length} PriceLists aplicáveis — selecionada por prioridade: ${selected.priceListId}.`,
      field: "priceList",
      detail: {
        selected: selected.priceListId,
        candidates: applicable.map((e) => e.priceListId),
      },
    });
  }

  return { selected, mode: "tabled", warnings };
}
