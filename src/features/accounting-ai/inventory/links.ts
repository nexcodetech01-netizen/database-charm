/**
 * Links de navegação do painel de Estoque da Bella.
 * Somente rotas já existentes — nenhum botão executa ação.
 */
import { ROUTES } from "@/config/routes";
import type {
  BellaInventoryActionId,
  BellaInventoryLink,
  BellaInventoryLinkId,
} from "./types";

export const BELLA_INVENTORY_LINKS: Record<BellaInventoryLinkId, BellaInventoryLink> = {
  abrir_estoque: { id: "abrir_estoque", label: "Abrir estoque", href: ROUTES.inventory },
  ver_movimentacoes: {
    id: "ver_movimentacoes",
    label: "Ver movimentações",
    href: ROUTES.inventory,
  },
  abrir_produtos: { id: "abrir_produtos", label: "Abrir produtos", href: ROUTES.products },
  abrir_produto: { id: "abrir_produto", label: "Abrir produto", href: ROUTES.products },
  abrir_inventario: {
    id: "abrir_inventario",
    label: "Abrir inventário",
    href: ROUTES.inventoryReconciliation,
  },
  abrir_compras: { id: "abrir_compras", label: "Abrir compras", href: ROUTES.purchases },
  abrir_fornecedores: {
    id: "abrir_fornecedores",
    label: "Abrir fornecedores",
    href: ROUTES.suppliers,
  },
  abrir_relatorios: {
    id: "abrir_relatorios",
    label: "Abrir relatórios",
    href: ROUTES.reports,
  },
  abrir_curva_abc: { id: "abrir_curva_abc", label: "Ver curva ABC", href: ROUTES.reports },
};

export const BELLA_INVENTORY_LINK_ORDER: BellaInventoryLinkId[] = [
  "abrir_estoque",
  "ver_movimentacoes",
  "abrir_produtos",
  "abrir_inventario",
  "abrir_compras",
  "abrir_fornecedores",
  "abrir_relatorios",
];

export function inventoryLink(id: BellaInventoryLinkId): BellaInventoryLink {
  return BELLA_INVENTORY_LINKS[id];
}

export function inventoryLinks(
  ids: readonly BellaInventoryLinkId[] = BELLA_INVENTORY_LINK_ORDER,
): BellaInventoryLink[] {
  return ids.map(inventoryLink);
}

/** Rota de detalhe de um produto no estoque (somente navegação). */
export function inventoryProductLink(productId: string): BellaInventoryLink {
  return {
    id: "abrir_produto",
    label: "Abrir produto",
    href: `${ROUTES.inventory}/produto/${productId}`,
  };
}

const ACTION_LINKS: Partial<Record<BellaInventoryActionId, BellaInventoryLinkId>> = {
  comprar_estoque: "abrir_compras",
  revisar_mix: "abrir_produtos",
  revisar_preco: "abrir_produtos",
  negociar_prazos: "abrir_fornecedores",
  acompanhar: "abrir_estoque",
  conferir_dados: "abrir_inventario",
  manter_ritmo: "abrir_estoque",
};

export function inventoryLinkForAction(
  action?: { id: BellaInventoryActionId } | null,
): BellaInventoryLink {
  const id = action ? ACTION_LINKS[action.id] : undefined;
  return inventoryLink(id ?? "abrir_estoque");
}
