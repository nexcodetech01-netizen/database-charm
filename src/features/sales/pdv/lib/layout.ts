/**
 * PDV — Camada de apresentação do layout profissional (Sprint 2.9).
 *
 * ESCOPO 100% UX/UI. Nenhuma regra de negócio: aqui só existem tokens de
 * layout e projeções de leitura (read models) a partir de dados já
 * calculados pelo SaleEngine e pelos hooks existentes.
 *
 * Também isola o modelo da futura "segunda tela do cliente"
 * (`buildPdvCustomerDisplay`) — a tela em si NÃO é implementada nesta sprint.
 */
import type { SaleTotals } from "../../engine/types";
import type { SaleItemDraft } from "../../types";
import { computeItemTotal } from "../../types";

/**
 * Tokens de layout do PDV.
 *
 * Grade de 1366x768 até Full HD: carrinho ocupa a maior área e o painel da
 * direita é fixo (sticky) — nunca rola junto do carrinho.
 */
export const PDV_LAYOUT = {
  /** Container geral (barra de operação + áreas). */
  shell: "flex flex-col gap-4",
  /** Grade principal: carrinho (esquerda) + painel (direita). */
  grid: "grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]",
  /** Coluna do carrinho — rolagem suave e própria. */
  cartColumn: "flex min-w-0 flex-col gap-3",
  /** Área rolável do carrinho, dimensionada pela altura da viewport. */
  cartScroll:
    "max-h-[calc(100vh-22rem)] min-h-64 overflow-y-auto scroll-smooth overscroll-contain",
  /** Painel lateral fixo: acompanha o scroll da página. */
  sidePanel:
    "flex min-w-0 flex-col gap-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:overscroll-contain",
} as const;

/** Estágio visual da sessão de balcão (derivado, sem regra nova). */
export type PdvStage = "cart" | "receiving" | "completed";

export function resolvePdvStage(input: {
  pendingSale?: unknown;
  completed?: unknown;
}): PdvStage {
  if (input.completed) return "completed";
  if (input.pendingSale) return "receiving";
  return "cart";
}

export const PDV_STAGE_LABEL: Record<PdvStage, string> = {
  cart: "Montando carrinho",
  receiving: "Aguardando recebimento",
  completed: "Venda concluída",
};

export type PdvStatusTone = "open" | "closed" | "pending" | "done";

export type PdvCashStatus = {
  label: string;
  tone: PdvStatusTone;
};

/** Indicador de status do caixa exibido na barra de operação. */
export function pdvCashStatus(input: {
  canOperate: boolean;
  openedAtLabel?: string | null;
}): PdvCashStatus {
  if (!input.canOperate) return { label: "Caixa fechado", tone: "closed" };
  return {
    label: input.openedAtLabel
      ? `Caixa aberto · ${input.openedAtLabel}`
      : "Caixa aberto",
    tone: "open",
  };
}

/** Classes do indicador de status (contraste elevado, tokens semânticos). */
export const PDV_STATUS_TONE_CLASS: Record<PdvStatusTone, string> = {
  open: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  closed: "border-destructive/40 bg-destructive/10 text-destructive",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  done: "border-primary/40 bg-primary/10 text-primary",
};

/**
 * Read model da futura segunda tela do cliente.
 *
 * PREPARAÇÃO APENAS — nenhuma tela é renderizada nesta sprint. O objetivo é
 * garantir que os dados já existam isolados de qualquer componente.
 */
export type PdvCustomerDisplayItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type PdvCustomerDisplayModel = {
  saleNumber: string;
  stage: PdvStage;
  items: PdvCustomerDisplayItem[];
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
};

export function buildPdvCustomerDisplay(input: {
  saleNumber: string;
  stage: PdvStage;
  items: SaleItemDraft[];
  totals: SaleTotals;
  itemCount: number;
  /** Desconto informado no rascunho (já refletido no grand_total). */
  discountValue?: number;
}): PdvCustomerDisplayModel {
  return {
    saleNumber: input.saleNumber,
    stage: input.stage,
    items: input.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unit_price) || 0,
      total: computeItemTotal(item),
    })),
    itemCount: input.itemCount,
    subtotal: input.totals.items_total,
    discount: Number(input.discountValue) || 0,
    total: input.totals.grand_total,
  };
}
