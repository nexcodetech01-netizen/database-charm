/**
 * SalesValidator — puro. Verifica pré-condições de cada transição
 * do fluxo de venda, sem side-effects. Nenhuma regra de negócio nova:
 * apenas checa se a Memory possui as entidades exigidas pela etapa.
 */

import type { SalesMemorySlice } from "./SalesContext";
import type { BellaEntityRef } from "../memory/MemoryTypes";
import type { SalesStage } from "./types";

export interface ValidationOutcome {
  ok: boolean;
  reason?: string;
}

function ok(): ValidationOutcome {
  return { ok: true };
}

function fail(reason: string): ValidationOutcome {
  return { ok: false, reason };
}

export const SalesValidator = {
  canSelectProducts(slice: SalesMemorySlice, customer: BellaEntityRef | null): ValidationOutcome {
    if (!customer) return fail("Selecione ou cadastre o cliente antes de escolher produtos.");
    if (slice.stage === "cancelled") return fail("Atendimento cancelado.");
    return ok();
  },

  canAddItem(item: { productId?: string; quantity?: number; unitPrice?: number }): ValidationOutcome {
    if (!item.productId) return fail("Produto obrigatório.");
    if (!item.quantity || item.quantity <= 0) return fail("Quantidade deve ser maior que zero.");
    if (item.unitPrice === undefined || item.unitPrice < 0) return fail("Preço unitário inválido.");
    return ok();
  },

  canApplyDiscount(percent: number): ValidationOutcome {
    if (!Number.isFinite(percent)) return fail("Desconto inválido.");
    if (percent < 0 || percent > 100) return fail("Desconto deve estar entre 0% e 100%.");
    return ok();
  },

  canBuildSummary(slice: SalesMemorySlice, customer: BellaEntityRef | null): ValidationOutcome {
    if (!customer) return fail("Cliente ausente.");
    if (!slice.items.length) return fail("Adicione ao menos um item.");
    return ok();
  },

  canConfirm(slice: SalesMemorySlice, customer: BellaEntityRef | null): ValidationOutcome {
    const base = this.canBuildSummary(slice, customer);
    if (!base.ok) return base;
    if (slice.stage !== "summary" && slice.stage !== "confirmation") {
      return fail("Gere o resumo antes de confirmar.");
    }
    return ok();
  },

  canTransition(from: SalesStage, to: SalesStage): ValidationOutcome {
    // Nunca sair de estados terminais.
    if (from === "closed" || from === "cancelled") {
      return fail(`Sessão já em ${from}. Inicie um novo atendimento.`);
    }
    return ok();
  },
};
