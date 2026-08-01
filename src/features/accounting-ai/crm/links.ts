/**
 * Links de navegação do painel de CRM da Bella.
 * Somente rotas já existentes — nenhum botão executa ação.
 */
import { ROUTES } from "@/config/routes";
import type { BellaCrmActionId, BellaCrmLink, BellaCrmLinkId } from "./types";

export const BELLA_CRM_LINKS: Record<BellaCrmLinkId, BellaCrmLink> = {
  abrir_clientes: { id: "abrir_clientes", label: "Abrir clientes", href: ROUTES.customers },
  abrir_cliente: { id: "abrir_cliente", label: "Abrir cliente", href: ROUTES.customers },
  abrir_crm: { id: "abrir_crm", label: "Abrir CRM", href: ROUTES.crm },
  abrir_vendas: { id: "abrir_vendas", label: "Abrir vendas", href: ROUTES.sales },
  abrir_venda: { id: "abrir_venda", label: "Abrir venda", href: ROUTES.sales },
  abrir_historico: { id: "abrir_historico", label: "Abrir histórico", href: ROUTES.customers },
  abrir_dashboard: {
    id: "abrir_dashboard",
    label: "Abrir dashboard",
    href: ROUTES.executivePanel,
  },
  abrir_relatorios: { id: "abrir_relatorios", label: "Abrir relatório", href: ROUTES.reports },
  abrir_ranking: { id: "abrir_ranking", label: "Abrir ranking", href: ROUTES.reports },
};

export const BELLA_CRM_LINK_ORDER: BellaCrmLinkId[] = [
  "abrir_clientes",
  "abrir_crm",
  "abrir_vendas",
  "abrir_historico",
  "abrir_dashboard",
  "abrir_relatorios",
  "abrir_ranking",
];

export function crmLink(id: BellaCrmLinkId): BellaCrmLink {
  return BELLA_CRM_LINKS[id];
}

export function crmLinks(
  ids: readonly BellaCrmLinkId[] = BELLA_CRM_LINK_ORDER,
): BellaCrmLink[] {
  return ids.map(crmLink);
}

/** Rota de detalhe de um cliente (somente navegação). */
export function crmCustomerLink(customerId: string): BellaCrmLink {
  return {
    id: "abrir_cliente",
    label: "Abrir cliente",
    href: `${ROUTES.customers}/${customerId}`,
  };
}

/** Rota do histórico (Cliente 360) de um cliente (somente navegação). */
export function crmCustomerHistoryLink(customerId: string): BellaCrmLink {
  return {
    id: "abrir_historico",
    label: "Abrir histórico",
    href: `${ROUTES.customers}/${customerId}`,
  };
}

/** Rota de detalhe de uma venda (somente navegação). */
export function crmSaleLink(saleId: string): BellaCrmLink {
  return { id: "abrir_venda", label: "Abrir venda", href: `${ROUTES.sales}/${saleId}` };
}

const ACTION_LINKS: Partial<Record<BellaCrmActionId, BellaCrmLinkId>> = {
  reativar_cliente: "abrir_clientes",
  cobrar_cliente: "abrir_clientes",
  aumentar_divulgacao: "abrir_crm",
  revisar_mix: "abrir_relatorios",
  revisar_preco: "abrir_relatorios",
  manter_ritmo: "abrir_clientes",
  acompanhar: "abrir_clientes",
  conferir_dados: "abrir_relatorios",
};

export function crmLinkForAction(action?: { id: BellaCrmActionId } | null): BellaCrmLink {
  const id = action ? ACTION_LINKS[action.id] : undefined;
  return crmLink(id ?? "abrir_clientes");
}
