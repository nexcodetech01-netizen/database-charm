/**
 * Bella Contadora — Tributário: catálogo de navegação (somente rotas).
 */
import type { BellaTaxLink, BellaTaxLinkId } from "./types";

export const BELLA_TAX_LINKS: Record<BellaTaxLinkId, BellaTaxLink> = {
  abrir_tributario: {
    id: "abrir_tributario",
    label: "Abrir tributário",
    href: "/fiscal/tributario",
  },
  ver_apuracoes: {
    id: "ver_apuracoes",
    label: "Ver apurações",
    href: "/fiscal/tributario",
  },
  ver_projecoes: {
    id: "ver_projecoes",
    label: "Ver projeções",
    href: "/fiscal/tributario",
  },
  abrir_perfil_tributario: {
    id: "abrir_perfil_tributario",
    label: "Perfil tributário",
    href: "/fiscal/configuracao",
  },
  abrir_fiscal: { id: "abrir_fiscal", label: "Abrir fiscal", href: "/fiscal" },
};

export const BELLA_TAX_LINK_ORDER: BellaTaxLinkId[] = [
  "abrir_tributario",
  "ver_apuracoes",
  "ver_projecoes",
  "abrir_perfil_tributario",
];

export function taxLinks(ids: readonly BellaTaxLinkId[] = BELLA_TAX_LINK_ORDER) {
  return ids.map((id) => BELLA_TAX_LINKS[id]);
}
