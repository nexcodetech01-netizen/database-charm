/**
 * ReferenceResolver — detecta expressões dêiticas ("esse produto",
 * "aplica agora", "cancelar") no texto do usuário e devolve o tipo
 * de referência.
 *
 * Determinístico. Sem LLM. Sem acesso a banco.
 * Retorna sempre `"none"` quando não houver match — nunca inventa.
 */
import type { ReferenceType } from "./contracts";

const RE = {
  product:
    /\b(esse|essa|este|esta|aquele|aquela|o|a)\s+(produto|item|sku|bolsa|bolsas|mochila|carteira|peça|peca|modelo)\b/i,
  category:
    /\b(essa|esta|aquela|a)\s+(categoria|coleção|colecao|linha|família|familia)\b/i,
  policy:
    /\b(essa|esta|aquela|a)\s+(política|politica|regra|estratégia|estrategia)\b/i,
  dashboard:
    /\b(esse|este|aquele|o)\s+(dashboard|painel|resumo comercial|painel comercial)\b/i,
  simulation:
    /\b(essa|esta|aquela|a)\s+(simulação|simulacao|simulacão)\b/i,
  action:
    /\b(essa|esta|aquela|a)\s+(ação|acao|sugestão|sugestao|recomendação|recomendacao)\b/i,
  workflow:
    /\b(esse|este|aquele|o)\s+(workflow|processo|lote|fluxo)\b/i,
  repeat: /\b(repete|repetir|de novo|novamente|refaz|refazer)\b/i,
  confirm:
    /\b(aplica(r)?\s+agora|confirma(r)?|confirmo|pode aplicar|sim,?\s*aplica(r)?)\b/i,
  cancel:
    /\b(cancela(r)?|cancele|não\s+quero|nao\s+quero|desiste|desistir|abortar|para(r)?)\b/i,
} as const;

/**
 * Ordem importa: verbos imperativos (confirm/cancel/repeat) têm
 * prioridade sobre substantivos ("aplica agora essa ação").
 */
export function resolveReference(text: string): ReferenceType {
  const t = text.trim();
  if (!t) return "none";
  if (RE.cancel.test(t)) return "cancel";
  if (RE.confirm.test(t)) return "confirm";
  if (RE.repeat.test(t)) return "repeat";
  if (RE.product.test(t)) return "product";
  if (RE.category.test(t)) return "category";
  if (RE.policy.test(t)) return "policy";
  if (RE.dashboard.test(t)) return "dashboard";
  if (RE.simulation.test(t)) return "simulation";
  if (RE.action.test(t)) return "action";
  if (RE.workflow.test(t)) return "workflow";
  return "none";
}
