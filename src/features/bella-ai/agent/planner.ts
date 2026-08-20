/**
 * Planner — converte um AgentIntent em um AgentPlan.
 *
 * Fase 1: planos determinísticos 1:1 (um step por intent).
 * Preparado para orquestrar múltiplos passos no futuro
 * (ex.: venda = localizar cliente + reservar estoque + criar venda).
 */
import { getSkillPermissionSpec } from "./permission-engine";
import type { AgentIntent, AgentPlan, AgentPlanStep } from "./types";

const INTENT_TO_SKILL: Record<string, string> = {
  "customer.create": "customer.create",
  "customer.update": "customer.update",
  "customer.find": "customer.find",
  "product.create": "product.create",
  "product.find": "product.search",
  "product.search": "product.search",
  "product.update_price": "product.update_price",
  "product.update_stock": "product.update_stock",
  "product.list_low_stock": "product.list_low_stock",
  "agenda.create": "agenda.create_appointment",
  "quote.create": "quote.create",
  "service_order.create": "service_order.create",
  "finance.expense": "finance.register_expense",
  "finance.income": "finance.register_income",
  "finance.cash_balance": "finance.get_cash_balance",
  "cash.supply": "cash.register_supply",
  "cash.withdrawal": "cash.register_withdrawal",
  "finance.receivable": "finance.get_receivables",
  "finance.payable": "finance.get_payables",
  "sale.search": "sale.search",
  "sale.best_customer": "sale.best_customer",
  // Sprint 003 — Estoque
  "stock.add": "stock.add",
  "stock.remove": "stock.remove",
  "stock.adjust": "stock.adjust",
  "stock.history": "stock.history",
  "stock.low": "stock.low",
  "stock.balance": "stock.balance",
  "stock.purchase_suggestion": "stock.purchase_suggestion",
};

export function planFromIntent(intent: AgentIntent): AgentPlan | null {
  const skillId = INTENT_TO_SKILL[intent.id];
  console.log(`[BELLA-AUDIT] plannerIntent: ${intent.id} -> ${skillId || "null"}`);
  if (!skillId) return null;

  const spec = getSkillPermissionSpec(skillId);
  const destructive = spec?.destructive ?? false;

  const step: AgentPlanStep = {
    order: 1,
    skillId,
    description: `Executar ${skillId}`,
    payload: { 
      ...intent.entities,
      // Passamos metadados da intenção para a skill se necessário
      _intentSource: intent.source
    },
    critical: true,
  };

  return {
    intentId: intent.id,
    requiresConfirmation: intent.confirmationRequired || destructive,
    confirmationSummary: destructive ? `Confirmar operação sensível: ${skillId}?` : undefined,
    steps: [step],
  };
}
