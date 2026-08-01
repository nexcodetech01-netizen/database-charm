/**
 * Bella Contadora — registro das regras proativas.
 * Apenas indexação: nenhuma regra é executada aqui.
 */
import {
  PROACTIVE_RULES,
  caixaCriticoRule,
  caixaSaudavelRule,
  clienteDestaqueRule,
  clienteInativoRule,
  contaVencendoRule,
  contaVencidaRule,
  dadosIncompletosRule,
  estoqueBaixoRule,
  impostoProximoRule,
  lucroCaindoRule,
  maiorCrescimentoRule,
  maiorDespesaRule,
  maiorEconomiaRule,
  margemBaixaRule,
  motivoQuedaLucroRule,
  muitasDespesasRule,
  produtoParadoRule,
  prolaboreAcimaRule,
  receitaCaindoRule,
  receitaCrescendoRule,
  retiradaRiscoRule,
} from "./rules";
import type { ProactiveRuleDescriptor } from "./types";

export const PROACTIVE_REGISTRY: ProactiveRuleDescriptor[] = [
  { id: "receita_crescendo", category: "receita", description: "Receita cresceu frente ao período anterior.", run: receitaCrescendoRule },
  { id: "receita_caindo", category: "receita", description: "Receita caiu frente ao período anterior.", run: receitaCaindoRule },
  { id: "lucro_caindo", category: "lucro", description: "Lucro recuou frente ao período anterior.", run: lucroCaindoRule },
  { id: "caixa_critico", category: "caixa", description: "Caixa negativo ou com cobertura crítica.", run: caixaCriticoRule },
  { id: "caixa_saudavel", category: "caixa", description: "Caixa cobre 30 dias ou mais de despesas.", run: caixaSaudavelRule },
  { id: "conta_vencendo", category: "financeiro", description: "Contas a pagar em aberto no período.", run: contaVencendoRule },
  { id: "conta_vencida", category: "financeiro", description: "Valores vencidos a receber.", run: contaVencidaRule },
  { id: "estoque_baixo", category: "estoque", description: "Produtos abaixo do estoque mínimo.", run: estoqueBaixoRule },
  { id: "produto_parado", category: "produtos", description: "Produtos sem giro no período.", run: produtoParadoRule },
  { id: "cliente_destaque", category: "clientes", description: "Cliente com maior faturamento.", run: clienteDestaqueRule },
  { id: "cliente_inativo", category: "clientes", description: "Clientes sem compras no período.", run: clienteInativoRule },
  { id: "margem_baixa", category: "lucro", description: "Margem líquida abaixo do saudável.", run: margemBaixaRule },
  { id: "muitas_despesas", category: "financeiro", description: "Despesas acima do recomendado sobre a receita.", run: muitasDespesasRule },
  { id: "imposto_proximo", category: "fiscal", description: "Imposto previsto, vencendo ou vencido.", run: impostoProximoRule },
  { id: "prolabore_acima", category: "financeiro", description: "Pró-labore sugerido acima da retirada segura.", run: prolaboreAcimaRule },
  { id: "retirada_risco", category: "caixa", description: "Retirada em zona de risco ou sem margem.", run: retiradaRiscoRule },
  { id: "dados_incompletos", category: "sistema", description: "Providers sem dados no período.", run: dadosIncompletosRule },
  { id: "motivo_queda_lucro", category: "lucro", description: "Maior motivo da queda do lucro (explicações oficiais).", run: motivoQuedaLucroRule },
  { id: "maior_crescimento_mes", category: "receita", description: "Maior crescimento do mês (explicações oficiais).", run: maiorCrescimentoRule },
  { id: "maior_despesa", category: "financeiro", description: "Maior despesa apurada no período.", run: maiorDespesaRule },
  { id: "maior_economia", category: "financeiro", description: "Maior economia apurada no período.", run: maiorEconomiaRule },
];

export function getProactiveRule(id: string): ProactiveRuleDescriptor | undefined {
  return PROACTIVE_REGISTRY.find((r) => r.id === id);
}

export function listProactiveRuleIds(): string[] {
  return PROACTIVE_REGISTRY.map((r) => r.id);
}

/** Sanidade: registro e lista de execução têm o mesmo tamanho. */
export const PROACTIVE_RULE_COUNT = PROACTIVE_RULES.length;
