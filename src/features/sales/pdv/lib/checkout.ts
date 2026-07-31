/**
 * PDV — Finalização da venda (Sprint 2.4).
 *
 * Camada pura: nenhuma regra nova. Apenas orquestra as decisões já
 * existentes do `SaleEngine` e delega a gravação ao `salesService.create`
 * recebido por injeção (o mesmo usado pelo formulário de vendas).
 */
import { SaleEngine } from "../../engine";
import type { SaleCheck, SaleDraftState } from "../../engine/types";
import type { SaleItemDraft } from "../../types";

/** Número sugerido para a venda de balcão (mesmo padrão do formulário). */
export function nextPdvSaleNumber(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `PDV-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/** Validação do carrinho — exclusivamente via SaleEngine. */
export function validatePdvSale(state: SaleDraftState): SaleCheck {
  const identity = SaleEngine.validateIdentity(state);
  if (!identity.ok) return identity;
  const customer = SaleEngine.validateCustomer(state);
  if (!customer.ok) return customer;
  return SaleEngine.validateItems(state.items);
}

export type PdvSaleCreateInput = ReturnType<typeof SaleEngine.buildPayload> & {
  items: SaleItemDraft[];
};

export type PdvSubmitResult =
  | { ok: true; sale: { id: string } }
  | { ok: false; code: SaleCheck extends { ok: false } ? string : string; message: string };

/**
 * Constrói o payload com o SaleEngine e persiste com o serviço existente.
 * Em caso de erro o estado do carrinho não é tocado (quem limpa é a UI,
 * somente no caminho de sucesso).
 */
export async function submitPdvSale(input: {
  state: SaleDraftState;
  companyId: string;
  cashSessionId: string | null;
  create: (payload: PdvSaleCreateInput) => Promise<{ id: string }>;
}): Promise<PdvSubmitResult> {
  const check = validatePdvSale(input.state);
  if (!check.ok) return { ok: false, code: check.code, message: check.message };

  const payload = SaleEngine.buildPayload(input.state, {
    companyId: input.companyId,
    finalize: true,
    isEdit: false,
    cashSessionId: input.cashSessionId,
  });

  try {
    const sale = await input.create({ ...payload, items: input.state.items });
    return { ok: true, sale };
  } catch (err) {
    return {
      ok: false,
      code: "persist_failed",
      message:
        err instanceof Error ? err.message : "Não foi possível gravar a venda.",
    };
  }
}
