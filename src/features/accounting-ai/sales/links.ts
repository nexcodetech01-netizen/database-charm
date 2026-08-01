/**
 * Links de navegação do painel de Vendas da Bella.
 * Somente rotas já existentes — nenhum botão executa ação.
 */
import { ROUTES } from "@/config/routes";
import type { BellaSalesActionId, BellaSalesLink, BellaSalesLinkId } from "./types";

export const BELLA_SALES_LINKS: Record<BellaSalesLinkId, BellaSalesLink> = {
  abrir_vendas: { id: "abrir_vendas", label: "Abrir vendas", href: ROUTES.sales },
  nova_venda: { id: "nova_venda", label: "Nova venda", href: `${ROUTES.sales}/novo` },
  abrir_pdv: { id: "abrir_pdv", label: "Abrir PDV", href: ROUTES.pdv },
  abrir_venda: { id: "abrir_venda", label: "Abrir venda", href: ROUTES.sales },
  abrir_clientes: { id: "abrir_clientes", label: "Abrir clientes", href: ROUTES.customers },
  abrir_produtos: { id: "abrir_produtos", label: "Abrir produtos", href: ROUTES.products },
  abrir_relatorios: { id: "abrir_relatorios", label: "Abrir relatórios", href: ROUTES.reports },
  abrir_painel_executivo: {
    id: "abrir_painel_executivo",
    label: "Painel executivo",
    href: ROUTES.executivePanel,
  },
};

export const BELLA_SALES_LINK_ORDER: BellaSalesLinkId[] = [
  "abrir_vendas",
  "nova_venda",
  "abrir_pdv",
  "abrir_clientes",
  "abrir_produtos",
  "abrir_relatorios",
  "abrir_painel_executivo",
];

export function salesLink(id: BellaSalesLinkId): BellaSalesLink {
  return BELLA_SALES_LINKS[id];
}

export function salesLinks(
  ids: readonly BellaSalesLinkId[] = BELLA_SALES_LINK_ORDER,
): BellaSalesLink[] {
  return ids.map(salesLink);
}

/** Rota de detalhe de uma venda (somente navegação). */
export function saleDetailLink(saleId: string): BellaSalesLink {
  return { id: "abrir_venda", label: "Abrir venda", href: `${ROUTES.sales}/${saleId}` };
}

/** Rota de detalhe de um cliente (somente navegação). */
export function salesCustomerLink(customerId: string): BellaSalesLink {
  return {
    id: "abrir_clientes",
    label: "Abrir cliente",
    href: `${ROUTES.customers}/${customerId}`,
  };
}

/** Rota de detalhe de um produto (somente navegação). */
export function salesProductLink(productId: string): BellaSalesLink {
  return {
    id: "abrir_produtos",
    label: "Abrir produto",
    href: `${ROUTES.inventory}/produto/${productId}`,
  };
}

const ACTION_LINKS: Partial<Record<BellaSalesActionId, BellaSalesLinkId>> = {
  aumentar_divulgacao: "abrir_clientes",
  revisar_preco: "abrir_produtos",
  revisar_mix: "abrir_produtos",
  reativar_cliente: "abrir_clientes",
  cobrar_cliente: "abrir_clientes",
  comprar_estoque: "abrir_produtos",
  manter_ritmo: "abrir_vendas",
  acompanhar: "abrir_vendas",
  conferir_dados: "abrir_relatorios",
};

export function salesLinkForAction(
  action?: { id: BellaSalesActionId } | null,
): BellaSalesLink {
  const id = action ? ACTION_LINKS[action.id] : undefined;
  return salesLink(id ?? "abrir_vendas");
}
