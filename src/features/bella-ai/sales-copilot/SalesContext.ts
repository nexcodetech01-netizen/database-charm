/**
 * SalesContext — leitor/gravador do estado da venda dentro da
 * Bella Memory. Toda persistência conversacional passa por aqui, para
 * a Memory continuar sendo a única fonte de verdade da conversa.
 *
 * Convenção: dados da venda vivem em memory.collectedParameters sob a
 * chave `__sales_copilot__`. Entidades ativas (cliente, orçamento)
 * usam os slots oficiais da Memory (activeCustomer / activeQuote).
 */

import {
  bellaMemoryManager,
  type BellaMemoryManager,
} from "../memory/BellaMemoryManager";
import type { BellaEntityRef } from "../memory/MemoryTypes";
import type {
  SalesChannel,
  SalesCopilotContext,
  SalesLineItem,
  SalesStage,
} from "./types";

export const SALES_MEMORY_KEY = "__sales_copilot__";

export interface SalesMemorySlice {
  channel: SalesChannel;
  stage: SalesStage;
  items: SalesLineItem[];
  discountPercent: number;
  paymentMethod: string | null;
  notes: string | null;
  startedAt: number;
  updatedAt: number;
  interactions: number;
}

function emptySlice(channel: SalesChannel): SalesMemorySlice {
  const now = Date.now();
  return {
    channel,
    stage: "discovery",
    items: [],
    discountPercent: 0,
    paymentMethod: null,
    notes: null,
    startedAt: now,
    updatedAt: now,
    interactions: 0,
  };
}

export class SalesContextStore {
  constructor(private readonly memory: BellaMemoryManager = bellaMemoryManager) {}

  read(ctx: SalesCopilotContext): SalesMemorySlice {
    const mem = this.memory.get(ctx.tenantId, ctx.userId);
    const raw = mem.collectedParameters[SALES_MEMORY_KEY];
    if (!raw || typeof raw !== "object") return emptySlice(ctx.channel);
    const slice = raw as Partial<SalesMemorySlice>;
    return {
      channel: slice.channel ?? ctx.channel,
      stage: slice.stage ?? "discovery",
      items: Array.isArray(slice.items) ? [...slice.items] : [],
      discountPercent: Number(slice.discountPercent ?? 0),
      paymentMethod: slice.paymentMethod ?? null,
      notes: slice.notes ?? null,
      startedAt: Number(slice.startedAt ?? Date.now()),
      updatedAt: Number(slice.updatedAt ?? Date.now()),
      interactions: Number(slice.interactions ?? 0),
    };
  }

  write(ctx: SalesCopilotContext, next: SalesMemorySlice): SalesMemorySlice {
    const mem = this.memory.get(ctx.tenantId, ctx.userId);
    const updated: SalesMemorySlice = { ...next, updatedAt: Date.now() };
    this.memory.update(ctx.tenantId, ctx.userId, {
      collectedParameters: {
        ...mem.collectedParameters,
        [SALES_MEMORY_KEY]: updated,
      },
    });
    return updated;
  }

  patch(
    ctx: SalesCopilotContext,
    patch: Partial<SalesMemorySlice>,
  ): SalesMemorySlice {
    const current = this.read(ctx);
    return this.write(ctx, {
      ...current,
      ...patch,
      interactions: current.interactions + 1,
    });
  }

  setCustomer(ctx: SalesCopilotContext, customer: BellaEntityRef | null): void {
    this.memory.update(ctx.tenantId, ctx.userId, { activeCustomer: customer });
  }

  setQuote(ctx: SalesCopilotContext, quote: BellaEntityRef | null): void {
    this.memory.update(ctx.tenantId, ctx.userId, { activeQuote: quote });
  }

  entities(ctx: SalesCopilotContext): {
    customer: BellaEntityRef | null;
    quote: BellaEntityRef | null;
  } {
    const mem = this.memory.get(ctx.tenantId, ctx.userId);
    return {
      customer: mem.activeCustomer ?? null,
      quote: mem.activeQuote ?? null,
    };
  }

  clear(ctx: SalesCopilotContext): void {
    const mem = this.memory.get(ctx.tenantId, ctx.userId);
    const nextParams = { ...mem.collectedParameters };
    delete nextParams[SALES_MEMORY_KEY];
    this.memory.update(ctx.tenantId, ctx.userId, {
      collectedParameters: nextParams,
      activeCustomer: null,
      activeQuote: null,
    });
  }
}

export const salesContextStore = new SalesContextStore();
