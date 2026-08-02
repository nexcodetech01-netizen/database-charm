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
  /** Container geral (barra de operação + áreas + rodapé de atalhos). */
  shell: "mx-auto flex w-full max-w-[1800px] flex-col gap-3",
  /** Grade principal: carrinho (esquerda) + painel (direita). */
  grid: "grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px]",
  /** Coluna do carrinho — rolagem suave e própria. */
  cartColumn: "flex min-w-0 flex-col gap-2",
  /**
   * Área rolável do carrinho, dimensionada pela altura da viewport.
   * Sprint PDV.3.1: barra de operação compacta libera ~9rem de altura útil.
   */
  cartScroll:
    "max-h-[calc(100vh-15rem)] min-h-56 overflow-y-auto scroll-smooth overscroll-contain",
  /** Painel lateral fixo: acompanha o scroll da página. */
  sidePanel:
    "flex min-w-0 flex-col gap-2 lg:sticky lg:top-2 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:overscroll-contain",
  /** Rodapé discreto de atalhos (somente leitura). */
  shortcutBar:
    "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground",
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

/**
 * Classes do indicador de status.
 * Sprint PDV.3.1: cores cruas substituídas pelos tokens do design system.
 */
export const PDV_STATUS_TONE_CLASS: Record<PdvStatusTone, string> = {
  open: STATUS_TOKENS.success.soft,
  closed: STATUS_TOKENS.danger.soft,
  pending: STATUS_TOKENS.warning.soft,
  done: STATUS_TOKENS.info.soft,
};

/**
 * Estado visual da operação (Sprint 3.1) — SOMENTE apresentação.
 * Deriva de flags já existentes na tela; não altera nenhum fluxo.
 */
export type PdvActivity = {
  label: string;
  tone: PdvStatusTone;
};

export function pdvActivity(input: {
  saving?: boolean;
  fiscalPending?: boolean;
  stage: PdvStage;
}): PdvActivity {
  if (input.saving) return { label: "Processando venda", tone: "pending" };
  if (input.fiscalPending) return { label: "Emitindo NFC-e", tone: "pending" };
  if (input.stage === "receiving")
    return { label: "Pagamento em andamento", tone: "pending" };
  if (input.stage === "completed")
    return { label: "Venda concluída", tone: "done" };
  return { label: "Montando carrinho", tone: "open" };
}


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
