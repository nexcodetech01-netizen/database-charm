/**
 * Links de navegação do painel de Compras da Bella.
 * Somente rotas já existentes — nenhum botão executa ação.
 */
import { ROUTES } from "@/config/routes";
import type {
  BellaPurchasesActionId,
  BellaPurchasesLink,
  BellaPurchasesLinkId,
} from "./types";

export const BELLA_PURCHASES_LINKS: Record<BellaPurchasesLinkId, BellaPurchasesLink> = {
  abrir_compras: { id: "abrir_compras", label: "Abrir pedidos", href: ROUTES.purchases },
  nova_compra: { id: "nova_compra", label: "Nova compra", href: `${ROUTES.purchases}/novo` },
  abrir_pedido: { id: "abrir_pedido", label: "Abrir pedido", href: ROUTES.purchases },
  abrir_fornecedores: {
    id: "abrir_fornecedores",
    label: "Abrir fornecedores",
    href: ROUTES.suppliers,
  },
  abrir_fornecedor: {
    id: "abrir_fornecedor",
    label: "Abrir fornecedor",
    href: ROUTES.suppliers,
  },
  abrir_produtos: { id: "abrir_produtos", label: "Abrir produtos", href: ROUTES.products },
  abrir_produto: { id: "abrir_produto", label: "Abrir produto", href: ROUTES.products },
  abrir_estoque: { id: "abrir_estoque", label: "Abrir estoque", href: ROUTES.inventory },
  ver_movimentacoes: {
    id: "ver_movimentacoes",
    label: "Ver movimentações",
    href: ROUTES.inventory,
  },
  abrir_relatorios: { id: "abrir_relatorios", label: "Abrir relatório", href: ROUTES.reports },
};

export const BELLA_PURCHASES_LINK_ORDER: BellaPurchasesLinkId[] = [
  "abrir_compras",
  "nova_compra",
  "abrir_fornecedores",
  "abrir_produtos",
  "abrir_estoque",
  "ver_movimentacoes",
  "abrir_relatorios",
];

export function purchasesLink(id: BellaPurchasesLinkId): BellaPurchasesLink {
  return BELLA_PURCHASES_LINKS[id];
}

export function purchasesLinks(
  ids: readonly BellaPurchasesLinkId[] = BELLA_PURCHASES_LINK_ORDER,
): BellaPurchasesLink[] {
  return ids.map(purchasesLink);
}

/** Rota de detalhe de um pedido de compra (somente navegação). */
export function purchaseOrderLink(purchaseId: string): BellaPurchasesLink {
  return {
    id: "abrir_pedido",
    label: "Abrir pedido",
    href: `${ROUTES.purchases}/${purchaseId}/editar`,
  };
}

/** Rota de detalhe de um fornecedor (somente navegação). */
export function purchaseSupplierLink(supplierId: string): BellaPurchasesLink {
  return {
    id: "abrir_fornecedor",
    label: "Abrir fornecedor",
    href: `${ROUTES.suppliers}/${supplierId}`,
  };
}

/** Rota de detalhe de um produto no estoque (somente navegação). */
export function purchaseProductLink(productId: string): BellaPurchasesLink {
  return {
    id: "abrir_produto",
    label: "Abrir produto",
    href: `${ROUTES.inventory}/produto/${productId}`,
  };
}

const ACTION_LINKS: Partial<Record<BellaPurchasesActionId, BellaPurchasesLinkId>> = {
  comprar_estoque: "abrir_compras",
  revisar_mix: "abrir_produtos",
  revisar_preco: "abrir_produtos",
  revisar_custos: "abrir_compras",
  reduzir_despesas: "abrir_compras",
  acompanhar: "abrir_compras",
  conferir_dados: "abrir_relatorios",
};

export function purchasesLinkForAction(
  action?: { id: BellaPurchasesActionId } | null,
): BellaPurchasesLink {
  const id = action ? ACTION_LINKS[action.id] : undefined;
  return purchasesLink(id ?? "abrir_compras");
}
