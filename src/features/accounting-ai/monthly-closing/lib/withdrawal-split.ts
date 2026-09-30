/**
 * Divisão das retiradas entre as sócias e quanto ainda dá para retirar.
 *
 * Regras (definidas em 2026-09-30):
 *   · Sócias = categorias "Retirada — <nome>" (exceto "Retirada — dividida").
 *   · "Retirada — dividida" conta igualmente para cada sócia.
 *   · Disponível = valor seguro (saldo − contas 30 dias − reposição do
 *     estoque, calculado pelo banco) − reserva de 10% do saldo.
 *   · O disponível é dividido igualmente (meio a meio).
 */

export const WITHDRAWAL_PREFIX = "Retirada — ";
export const SHARED_WITHDRAWAL = "Retirada — dividida";
export const RESERVE_RATE = 0.1;

export interface CategoryTotal {
  category: string;
  total: number;
}

export interface PartnerWithdrawal {
  name: string;
  withdrawn: number;
  available: number;
}

export interface WithdrawalPlan {
  partners: PartnerWithdrawal[];
  reserve: number;
  availableTotal: number;
}

/** Nomes das sócias a partir das categorias da empresa. */
export function partnerNamesFrom(categoryNames: readonly string[]): string[] {
  return categoryNames
    .filter((name) => name.startsWith(WITHDRAWAL_PREFIX) && name !== SHARED_WITHDRAWAL)
    .map((name) => name.slice(WITHDRAWAL_PREFIX.length).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

const money = (value: number) => Math.round(value * 100) / 100;

export function planWithdrawals(input: {
  partnerNames: readonly string[];
  withdrawals: readonly CategoryTotal[];
  /** Valor seguro do banco (compute_prolabore_safe_amount). null = mês passado. */
  safeAmount: number | null;
  cashBalance: number;
  reserveRate?: number;
}): WithdrawalPlan {
  const names = input.partnerNames.length > 0 ? input.partnerNames : ["Sócia 1", "Sócia 2"];
  const count = names.length;
  const totals = new Map(input.withdrawals.map((w) => [w.category, Number(w.total) || 0]));
  const shared = (totals.get(SHARED_WITHDRAWAL) ?? 0) / count;

  const reserve = money(Math.max(0, input.cashBalance) * (input.reserveRate ?? RESERVE_RATE));
  const availableTotal =
    input.safeAmount == null ? 0 : money(Math.max(0, input.safeAmount - reserve));

  return {
    reserve,
    availableTotal,
    partners: names.map((name) => ({
      name,
      withdrawn: money((totals.get(`${WITHDRAWAL_PREFIX}${name}`) ?? 0) + shared),
            // Arredonda para baixo: a soma das partes nunca passa do disponível.
      available: Math.floor((availableTotal / count) * 100) / 100,
    })),
  };
}
