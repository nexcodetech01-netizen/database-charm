/**
 * Bella Contadora — skills (somente estrutura, sem IA nesta sprint).
 *
 * Cada skill é um descritor tipado com um `run` que apenas consulta
 * providers existentes e devolve dados brutos + texto determinístico.
 */
import { formatCurrency } from "@/lib/format";
import type { ProviderDeps } from "../providers";
import {
  cashFlowProvider,
  cashProvider,
  payrollProvider,
  productsProvider,
  profitProvider,
  taxesProvider,
} from "../providers";
import { accountingAdapter } from "../services/adapters";
import { currentPeriod } from "../lib/helpers";

export type AccountingSkillId =
  | "consultar_lucro"
  | "consultar_fluxo"
  | "consultar_dre"
  | "consultar_caixa"
  | "consultar_impostos"
  | "consultar_prolabore"
  | "consultar_reserva"
  | "consultar_produtos";

export interface AccountingSkillResult {
  ok: boolean;
  text: string;
  data: unknown;
}

export interface AccountingSkill {
  id: AccountingSkillId;
  name: string;
  description: string;
  readOnly: true;
  run(companyId: string, deps?: ProviderDeps): Promise<AccountingSkillResult>;
}

const empty = (what: string): AccountingSkillResult => ({
  ok: false,
  text: `Sem dados de ${what} para o período.`,
  data: null,
});

export const consultarLucroSkill: AccountingSkill = {
  id: "consultar_lucro",
  name: "Consultar lucro",
  description: "Lucro bruto, operacional e líquido do período.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await profitProvider(companyId, deps);
    if (!res.data) return empty("lucro");
    return {
      ok: true,
      text: `Lucro líquido ${formatCurrency(res.data.netProfit)} (margem ${res.data.netMargin.toFixed(2)}%).`,
      data: res.data,
    };
  },
};

export const consultarFluxoSkill: AccountingSkill = {
  id: "consultar_fluxo",
  name: "Consultar fluxo de caixa",
  description: "Entradas e saídas previstas para os próximos 30 dias.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await cashFlowProvider(companyId, deps);
    if (!res.data) return empty("fluxo de caixa");
    return {
      ok: true,
      text: `Previsão 30 dias: entradas ${formatCurrency(res.data.incoming)} · saídas ${formatCurrency(res.data.outgoing)} · líquido ${formatCurrency(res.data.net)}.`,
      data: res.data,
    };
  },
};

export const consultarDreSkill: AccountingSkill = {
  id: "consultar_dre",
  name: "Consultar DRE",
  description: "DRE do período, direto do motor contábil.",
  readOnly: true,
  async run(companyId, deps) {
    const period = deps?.period ?? currentPeriod();
    const service = deps?.services?.accounting ?? accountingAdapter;
    try {
      const dre = await service.dre(companyId, period);
      return {
        ok: true,
        text: `Receita líquida ${formatCurrency(dre.netRevenue)} · lucro líquido ${formatCurrency(dre.netProfit)}.`,
        data: dre,
      };
    } catch {
      return empty("DRE");
    }
  },
};

export const consultarCaixaSkill: AccountingSkill = {
  id: "consultar_caixa",
  name: "Consultar caixa",
  description: "Saldo atual, a receber e a pagar.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await cashProvider(companyId, deps);
    if (!res.data) return empty("caixa");
    return {
      ok: true,
      text: `Saldo ${formatCurrency(res.data.currentBalance)} · a receber ${formatCurrency(res.data.receivable)} · a pagar ${formatCurrency(res.data.payable)}.`,
      data: res.data,
    };
  },
};

export const consultarImpostosSkill: AccountingSkill = {
  id: "consultar_impostos",
  name: "Consultar impostos",
  description: "Apuração fiscal da competência (motor fiscal existente).",
  readOnly: true,
  async run(companyId, deps) {
    const res = await taxesProvider(companyId, deps);
    if (!res.data) return empty("impostos");
    return {
      ok: true,
      text: `Competência ${res.data.competence}: imposto ${formatCurrency(res.data.taxAmount)} sobre receita ${formatCurrency(res.data.revenue)}.`,
      data: res.data,
    };
  },
};

export const consultarProlaboreSkill: AccountingSkill = {
  id: "consultar_prolabore",
  name: "Consultar pró-labore sugerido",
  description: "Sugestão indicativa de retirada sobre o lucro apurado.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await payrollProvider(companyId, deps);
    if (!res.data) return empty("pró-labore");
    return {
      ok: true,
      text: `Pró-labore sugerido ${formatCurrency(res.data.suggestedAmount)} (${res.data.suggestedRate.toFixed(0)}% do lucro).`,
      data: res.data,
    };
  },
};

export const consultarReservaSkill: AccountingSkill = {
  id: "consultar_reserva",
  name: "Consultar reserva financeira",
  description: "Reserva sugerida sobre o lucro apurado.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await payrollProvider(companyId, deps);
    if (!res.data) return empty("reserva financeira");
    return {
      ok: true,
      text: `Reserva sugerida ${formatCurrency(res.data.reserveAmount)} (${res.data.reserveRate.toFixed(0)}% do lucro).`,
      data: { reserveAmount: res.data.reserveAmount, reserveRate: res.data.reserveRate },
    };
  },
};

export const consultarProdutosSkill: AccountingSkill = {
  id: "consultar_produtos",
  name: "Consultar produtos",
  description: "Campeões de venda, sem giro e abaixo do mínimo.",
  readOnly: true,
  async run(companyId, deps) {
    const res = await productsProvider(companyId, deps);
    if (!res.data) return empty("produtos");
    const top = res.data.bestSellers[0];
    return {
      ok: true,
      text: top
        ? `Produto campeão: ${top.name} (${formatCurrency(top.revenue)}). Sem giro: ${res.data.stagnant.length}.`
        : `Sem vendas no período. Sem giro: ${res.data.stagnant.length}.`,
      data: res.data,
    };
  },
};

export const accountingAiSkills: AccountingSkill[] = [
  consultarLucroSkill,
  consultarFluxoSkill,
  consultarDreSkill,
  consultarCaixaSkill,
  consultarImpostosSkill,
  consultarProlaboreSkill,
  consultarReservaSkill,
  consultarProdutosSkill,
];

export function getAccountingSkill(id: AccountingSkillId): AccountingSkill | undefined {
  return accountingAiSkills.find((s) => s.id === id);
}
