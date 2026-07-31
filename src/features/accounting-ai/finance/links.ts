/**
 * Bella Contadora — Finance: catálogo de navegação.
 *
 * Nenhum destes links executa ação financeira: são apenas rotas já existentes
 * do NexOS. Camada pura (sem React, sem IO).
 */
import type {
  BellaFinanceActionId,
  BellaFinanceLink,
  BellaFinanceLinkId,
} from "./types";

export const BELLA_FINANCE_LINKS: Record<BellaFinanceLinkId, BellaFinanceLink> = {
  ver_contas: { id: "ver_contas", label: "Ver contas", href: "/financeiro?tab=payables" },
  ver_caixa: { id: "ver_caixa", label: "Ver caixa", href: "/caixa" },
  ver_relatorio: { id: "ver_relatorio", label: "Ver relatório", href: "/relatorios" },
  ver_fluxo: { id: "ver_fluxo", label: "Ver fluxo", href: "/financeiro?tab=cashflow" },
  abrir_financeiro: { id: "abrir_financeiro", label: "Abrir financeiro", href: "/financeiro" },
  abrir_contas: { id: "abrir_contas", label: "Abrir contas", href: "/financeiro?tab=receivables" },
  abrir_clientes: { id: "abrir_clientes", label: "Abrir clientes", href: "/clientes" },
  abrir_produtos: { id: "abrir_produtos", label: "Abrir produtos", href: "/produtos" },
};

/** Ordem estável exibida no bloco `BellaFinanceActions`. */
export const BELLA_FINANCE_LINK_ORDER: BellaFinanceLinkId[] = [
  "ver_contas",
  "ver_caixa",
  "ver_relatorio",
  "ver_fluxo",
  "abrir_financeiro",
  "abrir_contas",
  "abrir_clientes",
  "abrir_produtos",
];

/** Mapeia a ação sugerida (insight/notificação) para um destino de navegação. */
const ACTION_TO_LINK: Record<BellaFinanceActionId, BellaFinanceLinkId> = {
  comprar_estoque: "abrir_produtos",
  cobrar_cliente: "abrir_contas",
  revisar_preco: "abrir_produtos",
  reduzir_despesas: "ver_fluxo",
  aumentar_divulgacao: "abrir_clientes",
  negociar_prazos: "ver_contas",
  reativar_cliente: "abrir_clientes",
  revisar_mix: "abrir_produtos",
  manter_ritmo: "ver_relatorio",
  acompanhar: "abrir_financeiro",
  revisar_retirada: "ver_caixa",
  ajustar_prolabore: "ver_relatorio",
  programar_imposto: "ver_contas",
  conferir_dados: "abrir_financeiro",
};

export function financeLink(id: BellaFinanceLinkId): BellaFinanceLink {
  return BELLA_FINANCE_LINKS[id];
}

/** Destino de navegação de uma ação sugerida (fallback: abrir financeiro). */
export function financeLinkForAction(action: string): BellaFinanceLink {
  const id = ACTION_TO_LINK[action as BellaFinanceActionId] ?? "abrir_financeiro";
  return BELLA_FINANCE_LINKS[id];
}

export function financeLinks(): BellaFinanceLink[] {
  return BELLA_FINANCE_LINK_ORDER.map((id) => BELLA_FINANCE_LINKS[id]);
}
