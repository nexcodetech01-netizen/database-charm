/**
 * Bella Contadora — Fiscal: catálogo de navegação.
 *
 * Nenhum destes links executa ação fiscal (emitir, cancelar, reprocessar):
 * são apenas rotas já existentes do módulo Fiscal. Camada pura.
 */
import type { BellaFiscalActionId, BellaFiscalLink, BellaFiscalLinkId } from "./types";

export const BELLA_FISCAL_LINKS: Record<BellaFiscalLinkId, BellaFiscalLink> = {
  abrir_fiscal: { id: "abrir_fiscal", label: "Abrir fiscal", href: "/fiscal" },
  ver_notas: { id: "ver_notas", label: "Ver notas", href: "/fiscal/notas" },
  ver_rejeitadas: { id: "ver_rejeitadas", label: "Ver notas rejeitadas", href: "/fiscal/notas" },
  ver_pendentes: {
    id: "ver_pendentes",
    label: "Ver documentos pendentes",
    href: "/fiscal/notas",
  },
  ver_canceladas: { id: "ver_canceladas", label: "Ver canceladas", href: "/fiscal/notas" },
  baixar_xml: { id: "baixar_xml", label: "Baixar XML", href: "/fiscal/notas" },
  baixar_danfe: { id: "baixar_danfe", label: "Baixar DANFE", href: "/fiscal/notas" },
  ver_timeline: { id: "ver_timeline", label: "Ver linha do tempo", href: "/fiscal/notas" },
  abrir_configuracao: {
    id: "abrir_configuracao",
    label: "Abrir configuração fiscal",
    href: "/fiscal/configuracao",
  },
  abrir_certificado: {
    id: "abrir_certificado",
    label: "Abrir certificado",
    href: "/fiscal/configuracao",
  },
};

/** Ordem estável exibida no bloco `BellaFiscalActions`. */
export const BELLA_FISCAL_LINK_ORDER: BellaFiscalLinkId[] = [
  "abrir_fiscal",
  "ver_notas",
  "ver_rejeitadas",
  "ver_pendentes",
  "baixar_xml",
  "baixar_danfe",
  "ver_timeline",
  "abrir_configuracao",
  "abrir_certificado",
];

/** Mapeia a ação sugerida (insight/notificação) para um destino fiscal. */
const ACTION_TO_LINK: Record<BellaFiscalActionId, BellaFiscalLinkId> = {
  comprar_estoque: "abrir_fiscal",
  cobrar_cliente: "ver_notas",
  revisar_preco: "abrir_fiscal",
  reduzir_despesas: "abrir_fiscal",
  aumentar_divulgacao: "abrir_fiscal",
  negociar_prazos: "abrir_fiscal",
  reativar_cliente: "abrir_fiscal",
  revisar_mix: "abrir_fiscal",
  manter_ritmo: "abrir_fiscal",
  acompanhar: "abrir_fiscal",
  revisar_retirada: "abrir_fiscal",
  ajustar_prolabore: "abrir_fiscal",
  programar_imposto: "abrir_configuracao",
  conferir_dados: "abrir_configuracao",
};

export function fiscalLink(id: BellaFiscalLinkId): BellaFiscalLink {
  return BELLA_FISCAL_LINKS[id];
}

/** Destino de navegação de uma ação sugerida (fallback: abrir fiscal). */
export function fiscalLinkForAction(action: string): BellaFiscalLink {
  const id = ACTION_TO_LINK[action as BellaFiscalActionId] ?? "abrir_fiscal";
  return BELLA_FISCAL_LINKS[id];
}

/** Documento específico: linha do tempo já existente do Fiscal v2. */
export function fiscalTimelineLink(documentId?: string | null): BellaFiscalLink {
  if (!documentId) return BELLA_FISCAL_LINKS.ver_timeline;
  return {
    id: "ver_timeline",
    label: "Ver linha do tempo",
    href: `/fiscal/notas/${documentId}`,
  };
}

export function fiscalLinks(): BellaFiscalLink[] {
  return BELLA_FISCAL_LINK_ORDER.map((id) => BELLA_FISCAL_LINKS[id]);
}
