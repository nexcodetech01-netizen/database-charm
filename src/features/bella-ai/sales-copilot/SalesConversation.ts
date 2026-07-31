/**
 * SalesConversation — leitor de intenção conversacional.
 *
 * Não é um NLU: apenas normaliza mensagens vindas do chat interno ou
 * do WhatsApp em intenções discretas que o SalesCopilot sabe executar.
 * Todo comportamento realmente inteligente segue no Action Engine /
 * Skills existentes; aqui só ajudamos a rotear.
 */

import type { SalesChannel } from "./types";

export type SalesIntent =
  | { kind: "start" }
  | { kind: "find_customer"; query: string }
  | { kind: "add_item"; text: string }
  | { kind: "remove_item"; ref: string }
  | { kind: "change_quantity"; ref: string; quantity: number }
  | { kind: "apply_discount"; percent: number }
  | { kind: "summary" }
  | { kind: "confirm" }
  | { kind: "cancel"; reason?: string }
  | { kind: "note"; text: string }
  | { kind: "unknown"; text: string };

const RE_DISCOUNT = /(\d{1,3})\s*%\s*(desconto|off|de\s+desconto)?/i;
const RE_QTY = /(?:qtd|quantidade)\s*(?:do|de)?\s*([\w-]+)\s*[:=]?\s*(\d+)/i;

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

export const SalesConversation = {
  parse(text: string, _channel: SalesChannel): SalesIntent {
    const raw = text.trim();
    const t = normalize(raw);
    if (!t) return { kind: "unknown", text: raw };

    if (/^(oi|olá|iniciar|começar|nova venda|abrir venda)/.test(t)) {
      return { kind: "start" };
    }
    if (/^(cancelar|cancela|desistir|encerrar)/.test(t)) {
      return { kind: "cancel", reason: raw };
    }
    if (/(resumo|fechar conta|totalize|totalizar)/.test(t)) {
      return { kind: "summary" };
    }
    if (/^(sim|confirmo|confirmar|ok|pode fechar|pode gerar)/.test(t)) {
      return { kind: "confirm" };
    }
    const qty = t.match(RE_QTY);
    if (qty) return { kind: "change_quantity", ref: qty[1], quantity: Number(qty[2]) };
    const disc = t.match(RE_DISCOUNT);
    if (disc) return { kind: "apply_discount", percent: Number(disc[1]) };
    if (/^(remover|tirar|excluir)\s+(.+)/.test(t)) {
      const m = t.match(/^(?:remover|tirar|excluir)\s+(.+)/);
      return { kind: "remove_item", ref: m?.[1]?.trim() ?? "" };
    }
    if (/^(cliente|encontrar cliente|buscar cliente)\s*[:\-]?\s*(.+)/.test(t)) {
      const m = t.match(/^(?:cliente|encontrar cliente|buscar cliente)\s*[:\-]?\s*(.+)/);
      return { kind: "find_customer", query: m?.[1]?.trim() ?? "" };
    }
    if (/^(adicionar|add|incluir)\s+(.+)/.test(t)) {
      const m = t.match(/^(?:adicionar|add|incluir)\s+(.+)/);
      return { kind: "add_item", text: m?.[1]?.trim() ?? "" };
    }
    if (/^(observaç(a|ã)o|nota|obs)\s*[:\-]?\s*(.+)/.test(t)) {
      const m = t.match(/^(?:observaç(?:a|ã)o|nota|obs)\s*[:\-]?\s*(.+)/);
      return { kind: "note", text: m?.[3]?.trim() ?? m?.[1]?.trim() ?? "" };
    }
    return { kind: "unknown", text: raw };
  },
};
