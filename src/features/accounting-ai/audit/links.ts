/**
 * Bella Contadora — Auditoria: catálogo de navegação (somente rotas).
 */
import type { AuditLink, AuditLinkId } from "./types";

export const BELLA_AUDIT_LINKS: Record<AuditLinkId, AuditLink> = {
  abrir_financeiro: {
    id: "abrir_financeiro",
    label: "Abrir financeiro",
    href: "/financeiro",
  },
  abrir_caixa: { id: "abrir_caixa", label: "Abrir caixa", href: "/caixa" },
  abrir_estoque: { id: "abrir_estoque", label: "Abrir estoque", href: "/estoque" },
  abrir_clientes: { id: "abrir_clientes", label: "Abrir clientes", href: "/clientes" },
  abrir_produtos: { id: "abrir_produtos", label: "Abrir produtos", href: "/produtos" },
  abrir_fiscal: { id: "abrir_fiscal", label: "Abrir fiscal", href: "/fiscal" },
  abrir_tributario: {
    id: "abrir_tributario",
    label: "Abrir tributário",
    href: "/fiscal/tributario",
  },
  abrir_relatorios: {
    id: "abrir_relatorios",
    label: "Abrir relatórios",
    href: "/relatorios",
  },
};

export const BELLA_AUDIT_LINK_ORDER: AuditLinkId[] = [
  "abrir_financeiro",
  "abrir_caixa",
  "abrir_estoque",
  "abrir_fiscal",
];

export function auditLinks(ids: readonly AuditLinkId[] = BELLA_AUDIT_LINK_ORDER) {
  return ids.map((id) => BELLA_AUDIT_LINKS[id]);
}
