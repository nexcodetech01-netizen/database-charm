/**
 * Bella Contadora — Proactive (Sprint 5.5): barrel público.
 * Camada pura + store de sessão. Nenhuma execução automática.
 */
export * from "./types";
export * from "./helpers";
export * from "./providers";
export {
  PROACTIVE_RULES,
  runRule,
  receitaCrescendoRule,
  receitaCaindoRule,
  lucroCaindoRule,
  caixaCriticoRule,
  caixaSaudavelRule,
  contaVencendoRule,
  contaVencidaRule,
  estoqueBaixoRule,
  produtoParadoRule,
  clienteDestaqueRule,
  clienteInativoRule,
  margemBaixaRule,
  muitasDespesasRule,
  impostoProximoRule,
  prolaboreAcimaRule,
  retiradaRiscoRule,
  dadosIncompletosRule,
} from "./rules";
export {
  PROACTIVE_REGISTRY,
  PROACTIVE_RULE_COUNT,
  getProactiveRule,
  listProactiveRuleIds,
} from "./registry";
export {
  buildBellaNotifications,
  buildTopNotifications,
  countCriticalNotifications,
} from "./engine";
export {
  bellaNotificationStore,
  useBellaNotifications,
  useBellaCriticalCount,
} from "./store";
