/**
 * SalesConfirmation — camada de decisão explícita. A Bella nunca
 * finaliza uma venda sem confirmação humana; este módulo formaliza
 * esse contrato para chat e WhatsApp.
 */

import type { SalesCopilotContext } from "./types";

export type ConfirmationStatus = "pending" | "confirmed" | "declined";

export interface ConfirmationTicket {
  id: string;
  ctxKey: string;
  summaryHeadline: string;
  createdAt: number;
  status: ConfirmationStatus;
  resolvedAt: number | null;
}

const CONFIRM_WORDS = ["sim", "confirmo", "confirmar", "ok", "pode", "fechar", "fecha"];
const DECLINE_WORDS = ["não", "nao", "cancela", "cancelar", "desisto", "para"];

function key(ctx: SalesCopilotContext): string {
  return `${ctx.tenantId}::${ctx.userId}`;
}

export class SalesConfirmationBus {
  private tickets = new Map<string, ConfirmationTicket>();
  private counter = 0;

  request(ctx: SalesCopilotContext, summaryHeadline: string): ConfirmationTicket {
    this.counter += 1;
    const ticket: ConfirmationTicket = {
      id: `sc_${Date.now().toString(36)}_${this.counter}`,
      ctxKey: key(ctx),
      summaryHeadline,
      createdAt: Date.now(),
      status: "pending",
      resolvedAt: null,
    };
    this.tickets.set(ticket.ctxKey, ticket);
    return ticket;
  }

  current(ctx: SalesCopilotContext): ConfirmationTicket | null {
    return this.tickets.get(key(ctx)) ?? null;
  }

  resolve(ctx: SalesCopilotContext, status: Exclude<ConfirmationStatus, "pending">): ConfirmationTicket | null {
    const t = this.tickets.get(key(ctx));
    if (!t || t.status !== "pending") return t ?? null;
    t.status = status;
    t.resolvedAt = Date.now();
    return t;
  }

  clear(ctx: SalesCopilotContext): void {
    this.tickets.delete(key(ctx));
  }

  /** Detecta intenção de confirmação/negação em texto livre (chat e WhatsApp). */
  static classify(text: string): ConfirmationStatus {
    const t = text.trim().toLowerCase();
    if (!t) return "pending";
    if (CONFIRM_WORDS.some((w) => t === w || t.startsWith(`${w} `))) return "confirmed";
    if (DECLINE_WORDS.some((w) => t === w || t.startsWith(`${w} `))) return "declined";
    return "pending";
  }
}

export const salesConfirmationBus = new SalesConfirmationBus();
