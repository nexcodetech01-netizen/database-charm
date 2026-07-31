/**
 * Skills do módulo Clientes (CRM).
 * Reutilizam customersService — nenhuma regra de negócio duplicada.
 */

import { customersService } from "@/features/customers/services/customers.service";
import type { BellaSkill, BellaSkillMissingField } from "./types";
import { skillResult } from "./types";

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function requireName(payload: Record<string, unknown>): BellaSkillMissingField[] {
  const name = asString(payload.name);
  return name
    ? []
    : [{ field: "name", label: "Nome do cliente", type: "text", required: true }];
}

export const createCustomerSkill: BellaSkill = {
  id: "customer.create",
  name: "Criar cliente",
  module: "customer",
  description: "Cadastra um novo cliente no CRM.",
  requiresConfirmation: true,
  canExecute: (ctx) => Boolean(ctx.companyId),
  validate: (payload) => requireName(payload),
  confirmationSummary: (payload) => {
    const name = asString((payload as Record<string, unknown>).name) ?? "cliente";
    return `Confirma o cadastro do cliente ${name}?`;
  },
  async execute(payload, ctx) {
    const missing = requireName(payload);
    if (missing.length) return skillResult.missing("Informe o nome do cliente.", missing);

    const customer = await customersService.create({
      company_id: ctx.companyId,
      name: asString(payload.name)!,
      email: asString(payload.email),
      phone: asString(payload.phone),
      whatsapp: asString(payload.whatsapp),
      document: asString(payload.document),
      notes: asString(payload.notes),
      owner_id: ctx.userId ?? null,
    });

    return skillResult.success(
      `Cliente "${asString(payload.name)}" cadastrado.`,
      customer,
      [{ id: "open_customer", title: "Abrir cliente", actionLabel: "Ver" }],
    );
  },
};

export const updateCustomerSkill: BellaSkill = {
  id: "customer.update",
  name: "Atualizar cliente",
  module: "customer",
  description: "Atualiza dados de um cliente existente.",
  requiresConfirmation: true,
  canExecute: (ctx) => Boolean(ctx.companyId),
  validate: (payload) => {
    const id = asString(payload.id);
    if (!id) {
      return [{ field: "id", label: "ID do cliente", type: "uuid", required: true }];
    }
    const patched = ["name", "email", "phone", "whatsapp", "document", "notes"].some(
      (k) => asString(payload[k]) !== null,
    );
    if (!patched) {
      return [{ field: "name", label: "Novo valor (nome, telefone, etc)", type: "text", required: true }];
    }
    return [];
  },
  confirmationSummary: () => "Confirma a atualização do cliente?",
  async execute(payload) {
    const id = asString(payload.id);
    if (!id) {
      return skillResult.missing("Informe o cliente a ser atualizado.", [
        { field: "id", label: "ID do cliente", type: "uuid", required: true },
      ]);
    }

    const patch: Record<string, string | null> = {};
    for (const key of ["name", "email", "phone", "whatsapp", "document", "notes"] as const) {
      const v = asString(payload[key]);
      if (v !== null) patch[key] = v;
    }

    if (Object.keys(patch).length === 0) {
      return skillResult.missing("Informe pelo menos um campo para atualizar.", [
        { field: "name", label: "Nome", type: "text", required: true },
      ]);
    }

    const updated = await customersService.update(id, patch);
    return skillResult.success(`Cliente atualizado.`, updated);
  },
};

export const findCustomerSkill: BellaSkill = {
  id: "customer.find",
  name: "Localizar cliente",
  module: "customer",
  description: "Busca clientes por nome, documento ou telefone.",
  canExecute: (ctx) => Boolean(ctx.companyId),
  validate: (payload) =>
    asString(payload.query)
      ? []
      : [{ field: "query", label: "Nome, telefone ou documento", type: "text", required: true }],
  async execute(payload, ctx) {
    const query = asString(payload.query);
    if (!query) {
      return skillResult.missing("Qual cliente quer localizar?", [
        { field: "query", label: "Nome, telefone ou documento", type: "text", required: true },
      ]);
    }

    const { rows } = await customersService.list(ctx.companyId, {
      search: query,
      status: "",
      segment: "",
      state: "",
      sortBy: "name",
      sortDir: "asc",
      page: 1,
      pageSize: 5,
    });

    if (rows.length === 0) {
      return skillResult.success(`Nenhum cliente encontrado para "${query}".`, { rows });
    }
    const preview = rows
      .slice(0, 3)
      .map((r) => `• ${r.name}${r.phone ? ` — ${r.phone}` : ""}`)
      .join("\n");
    return skillResult.success(
      `Encontrei ${rows.length} cliente(s) para "${query}":\n${preview}`,
      { rows },
      [{ id: "open_customers", title: "Abrir Clientes", actionLabel: "Ver" }],
    );
  },
};

export const customerSkills: BellaSkill[] = [
  createCustomerSkill,
  updateCustomerSkill,
  findCustomerSkill,
];
