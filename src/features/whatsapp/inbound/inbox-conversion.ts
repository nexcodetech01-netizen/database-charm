/**
 * Conversão do Atendimento (Inbox WhatsApp) em Venda — camada PURA.
 * Sprint 6.8.4 — Nível 1.
 *
 * Este módulo NÃO cria venda, NÃO grava em `sales` / `sale_items`, NÃO chama
 * RPC de vendas, NÃO movimenta estoque, financeiro, caixa ou crediário.
 * Ele apenas:
 *  • decide se um atendimento pode ser convertido;
 *  • monta o PRÉ-PREENCHIMENTO do formulário oficial de Nova Venda;
 *  • monta o patch de atualização do Inbox DEPOIS que a venda oficial existe.
 */
import { COMMERCIAL_INBOX_STATUS } from "./commercial-inbox";

/** Status registrado no Inbox após a venda oficial ter sido criada. */
export const INBOX_CONVERTED_STATUS = "convertido" as const;

export const SALE_ORIGIN_WHATSAPP = "whatsapp" as const;

export interface ConvertibleTicket {
  id: string;
  phone: string;
  buyer_name: string | null;
  full_name?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  status: string;
  sale_id?: string | null;
  items: Array<{
    productId: string;
    name: string;
    qty: number;
    unitPrice: number;
  }>;
}

/** Atendimento já convertido (tem venda vinculada ou status convertido). */
export function isConverted(ticket: {
  status: string;
  sale_id?: string | null;
}): boolean {
  return ticket.status === INBOX_CONVERTED_STATUS || Boolean(ticket.sale_id);
}

/**
 * Pode converter quando o atendimento ainda está aberto (aguardando ou
 * atendido), possui itens e ainda não foi convertido. Cancelado não converte.
 */
export function canConvert(ticket: ConvertibleTicket): boolean {
  if (isConverted(ticket)) return false;
  if (ticket.status === COMMERCIAL_INBOX_STATUS.cancelled) return false;
  return (ticket.items?.length ?? 0) > 0;
}

export interface SalePrefillItem {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface SalePrefill {
  inboxId: string;
  origin: typeof SALE_ORIGIN_WHATSAPP;
  phone: string;
  notes: string;
  items: SalePrefillItem[];
  /** Documento do comprador (usado só para tentar casar um cliente existente). */
  document: string | null;
  buyerName: string | null;
}

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

/** Observação padrão da venda originada no WhatsApp. */
export function buildOriginNote(phone: string): string {
  return `Origem: WhatsApp\nTelefone: ${phone}`;
}

/** Pré-preenchimento — nada aqui persiste; tudo continua editável na tela. */
export function buildSalePrefill(ticket: ConvertibleTicket): SalePrefill {
  return {
    inboxId: ticket.id,
    origin: SALE_ORIGIN_WHATSAPP,
    phone: ticket.phone,
    notes: buildOriginNote(ticket.phone),
    items: (ticket.items ?? [])
      .filter((i) => Boolean(i.productId) && i.qty > 0)
      .map((i) => ({
        productId: i.productId,
        description: i.name,
        quantity: i.qty,
        unitPrice: Number(i.unitPrice) || 0,
      })),
    document: onlyDigits(ticket.cnpj ?? ticket.cpf) || null,
    buyerName: ticket.full_name ?? ticket.buyer_name ?? null,
  };
}

export interface CustomerCandidate {
  id: string;
  name?: string | null;
  phone?: string | null;
  document?: string | null;
}

/**
 * Cliente "identificado": documento igual, ou telefone igual (últimos 8+
 * dígitos). Sem match → venda fica sem cliente e o operador escolhe.
 */
export function pickMatchingCustomer(
  candidates: CustomerCandidate[],
  prefill: Pick<SalePrefill, "document" | "phone">,
): string | null {
  const doc = prefill.document;
  if (doc) {
    const byDoc = candidates.find((c) => onlyDigits(c.document) === doc);
    if (byDoc) return byDoc.id;
  }
  const phone = onlyDigits(prefill.phone);
  if (phone.length >= 8) {
    const tail = phone.slice(-8);
    const byPhone = candidates.find((c) => {
      const p = onlyDigits(c.phone);
      return p.length >= 8 && p.slice(-8) === tail;
    });
    if (byPhone) return byPhone.id;
  }
  return null;
}

export interface InboxConversionPatch {
  status: typeof INBOX_CONVERTED_STATUS;
  sale_id: string;
  converted_at: string;
}

/** Patch aplicado SOMENTE após a venda oficial ter sido criada com sucesso. */
export function buildConversionPatch(
  saleId: string,
  now: number = Date.now(),
): InboxConversionPatch {
  return {
    status: INBOX_CONVERTED_STATUS,
    sale_id: saleId,
    converted_at: new Date(now).toISOString(),
  };
}
