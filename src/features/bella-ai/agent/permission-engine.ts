/**
 * PermissionEngine — mapa Skill → permissão RBAC.
 *
 * Consulta a permissão *localmente* usando o `AgentContext.permissions`
 * que já foi carregado por `fetchUserPermissions()` (fonte de verdade
 * equivalente a `public.has_permission`). Não faz round-trip no banco;
 * a RLS no Supabase é a última barreira e continua ativa.
 */
import type { PermissionCode } from "@/features/rbac/lib/permission-codes";
import type { AgentContext, SkillPermissionSpec } from "./types";

const SKILL_PERMISSION_MAP: Record<string, SkillPermissionSpec> = {
  // Clientes
  "customer.create": {
    skillId: "customer.create",
    requires: ["customers.create"],
    destructive: false,
  },
  "customer.update": {
    skillId: "customer.update",
    requires: ["customers.update"],
    destructive: false,
  },
  "customer.find": { skillId: "customer.find", requires: ["customers.view"], destructive: false },
  "customer.delete": {
    skillId: "customer.delete",
    requires: ["customers.delete"],
    destructive: true,
  },

  // Produtos / Estoque
  "product.create": {
    skillId: "product.create",
    requires: ["products.create"],
    destructive: false,
  },
  "product.find": { skillId: "product.find", requires: ["products.view"], destructive: false },
  "product.search": {
    skillId: "product.search",
    requires: ["products.view"],
    destructive: false,
  },
  "product.update_price": {
    skillId: "product.update_price",
    requires: ["products.update"],
    destructive: true,
  },
  "product.update_stock": {
    skillId: "product.update_stock",
    requires: ["inventory.update"],
    destructive: true,
  },
  "product.list_low_stock": {
    skillId: "product.list_low_stock",
    requires: ["inventory.view"],
    destructive: false,
  },

  // Estoque (Sprint 003)
  "stock.add": { skillId: "stock.add", requires: ["inventory.update"], destructive: true },
  "stock.remove": { skillId: "stock.remove", requires: ["inventory.update"], destructive: true },
  "stock.adjust": { skillId: "stock.adjust", requires: ["inventory.update"], destructive: true },
  "stock.history": { skillId: "stock.history", requires: ["inventory.view"], destructive: false },
  "stock.low": { skillId: "stock.low", requires: ["inventory.view"], destructive: false },
  "stock.balance": { skillId: "stock.balance", requires: ["inventory.view"], destructive: false },
  "stock.purchase_suggestion": {
    skillId: "stock.purchase_suggestion",
    requires: ["inventory.view"],
    destructive: false,
  },

  // Vendas
  "sale.search": { skillId: "sale.search", requires: ["sales.view"], destructive: false },
  "sale.best_customer": {
    skillId: "sale.best_customer",
    requires: ["reports.view"],
    destructive: false,
  },

  // Financeiro (Consultas)
  "finance.get_receivables": {
    skillId: "finance.get_receivables",
    requires: ["finance.view"],
    destructive: false,
  },
  "finance.get_payables": {
    skillId: "finance.get_payables",
    requires: ["finance.view"],
    destructive: false,
  },

  // Agenda
  "agenda.create_appointment": {
    skillId: "agenda.create_appointment",
    requires: ["agenda.create"],
    destructive: false,
  },

  // OS / Orçamentos
  "service_order.create": {
    skillId: "service_order.create",
    requires: ["sales.create"],
    destructive: false,
  },
  "quote.create": { skillId: "quote.create", requires: ["sales.create"], destructive: false },

  // Financeiro
  "finance.register_expense": {
    skillId: "finance.register_expense",
    requires: ["finance.create"],
    destructive: false,
  },
  "finance.register_income": {
    skillId: "finance.register_income",
    requires: ["finance.create"],
    destructive: false,
  },
  "finance.get_cash_balance": {
    skillId: "finance.get_cash_balance",
    requires: ["finance.view"],
    destructive: false,
  },
  "cash.register_supply": {
    skillId: "cash.register_supply",
    requires: ["finance.create"],
    destructive: false,
  },
  "cash.register_withdrawal": {
    skillId: "cash.register_withdrawal",
    requires: ["finance.create"],
    destructive: true,
  },
};

export function getSkillPermissionSpec(skillId: string): SkillPermissionSpec | undefined {
  return SKILL_PERMISSION_MAP[skillId];
}

/** true quando o contexto tem UMA das permissões requeridas (ou owner). */
export function hasPermission(ctx: AgentContext, codes: readonly PermissionCode[]): boolean {
  if (ctx.isOwner) return true;
  if (ctx.permissions.has("*")) return true;
  for (const code of codes) {
    if (ctx.permissions.has(code)) return true;
  }
  return false;
}

export function canExecuteSkill(
  ctx: AgentContext,
  skillId: string,
): {
  allowed: boolean;
  reason?: string;
  destructive: boolean;
} {
  const spec = getSkillPermissionSpec(skillId);
  if (!spec) {
    // Skills não mapeadas — política conservadora: exigir owner.
    return {
      allowed: ctx.isOwner === true,
      reason: ctx.isOwner ? undefined : `Skill "${skillId}" sem mapeamento RBAC — requer owner.`,
      destructive: false,
    };
  }
  if (!hasPermission(ctx, spec.requires)) {
    return {
      allowed: false,
      reason: `Você não tem permissão (${spec.requires.join(" ou ")}) para executar "${skillId}".`,
      destructive: spec.destructive,
    };
  }
  return { allowed: true, destructive: spec.destructive };
}
