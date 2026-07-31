/**
 * Fiscal v2 — Rateio de desconto e consistência de totais.
 *
 * A NF-e exige que o total do documento feche exatamente:
 *
 *   vNF = vProd - vDesc + vFrete
 *
 * O desconto lançado no cabeçalho da venda precisa ser distribuído
 * proporcionalmente entre os itens, com o resíduo de arredondamento
 * aplicado no último item — assim a soma dos descontos dos itens é
 * idêntica ao desconto do cabeçalho (evita rejeição 531/533).
 *
 * Sprint P0.6.3: correção de REPRESENTAÇÃO apenas. Nenhuma regra
 * comercial ou cálculo de preço é alterado.
 */

/** Arredonda para 2 casas (moeda) evitando erro de ponto flutuante. */
export function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Distribui `discount` proporcionalmente aos `amounts` (valor bruto de
 * cada item). O resíduo vai para o último item com valor > 0.
 * Retorna sempre um array do mesmo tamanho de `amounts`.
 */
export function allocateDiscount(
  amounts: readonly number[],
  discount: number,
): number[] {
  const result = amounts.map(() => 0);
  const total = round2(discount);
  if (!Number.isFinite(total) || total <= 0 || amounts.length === 0) return result;

  const base = amounts.reduce((acc, v) => acc + (Number(v) || 0), 0);
  if (base <= 0) {
    result[result.length - 1] = total;
    return result;
  }

  let assigned = 0;
  let lastIndex = -1;
  for (let i = 0; i < amounts.length; i++) {
    const amount = Number(amounts[i]) || 0;
    if (amount <= 0) continue;
    lastIndex = i;
    const share = round2((amount / base) * total);
    result[i] = share;
    assigned = round2(assigned + share);
  }

  if (lastIndex >= 0 && assigned !== total) {
    result[lastIndex] = round2(result[lastIndex]! + (total - assigned));
  }
  return result;
}

export interface FiscalTotals {
  /** Soma do valor bruto dos itens (vProd). */
  products: number;
  /** Desconto do documento (vDesc). */
  discount: number;
  /** Frete do documento (vFrete). */
  freight: number;
  /** Total do documento (vNF). */
  total: number;
}

/**
 * Total esperado pela SEFAZ para os valores informados.
 * Não altera nada — serve para auditar consistência.
 */
export function expectedDocumentTotal(
  totals: Pick<FiscalTotals, "products" | "discount" | "freight">,
): number {
  return round2(
    (Number(totals.products) || 0) -
      (Number(totals.discount) || 0) +
      (Number(totals.freight) || 0),
  );
}

/** Os totais fecham a equação da NF-e (tolerância de 1 centavo)? */
export function totalsAreConsistent(totals: FiscalTotals): boolean {
  return Math.abs(expectedDocumentTotal(totals) - round2(totals.total)) <= 0.01;
}
