/**
 * Resumo quinzenal da Bella: mais vendidos + quantos produtos precisam de
 * reposição. Parte pura (montagem do texto) — o envio fica em
 * biweekly-summary.server.ts.
 */

export const BIWEEKLY_SUMMARY_EVENT = "inventory.restock_summary";
export const BIWEEKLY_SUMMARY_DAYS = 15;
export const BIWEEKLY_SUMMARY_TOP = 5;

export interface TopSellingProduct {
  product_id: string;
  name: string;
  quantity: number;
  revenue: number;
}

const money = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const qty = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function buildBiweeklySummary(
  top: readonly TopSellingProduct[],
  restockCount: number,
): { title: string; message: string } | null {
  if (top.length === 0 && restockCount === 0) return null;

  const parts: string[] = [];
  if (top.length > 0) {
    const ranking = top
      .map((p, i) => `${i + 1}. ${p.name} — ${qty(p.quantity)} un. (${money(p.revenue)})`)
      .join(" · ");
    parts.push(`Mais vendidos nos últimos ${BIWEEKLY_SUMMARY_DAYS} dias: ${ranking}.`);
  } else {
    parts.push(`Nenhuma venda nos últimos ${BIWEEKLY_SUMMARY_DAYS} dias.`);
  }

  if (restockCount > 0) {
    parts.push(
      restockCount === 1
        ? "1 produto precisa de reposição — veja a sugestão de compra em Estoque."
        : `${restockCount} produtos precisam de reposição — veja a sugestão de compra em Estoque.`,
    );
  } else {
    parts.push("Nenhum produto precisa de reposição agora.");
  }

  return {
    title: "Resumo quinzenal: mais vendidos e reposição",
    message: parts.join(" "),
  };
}
