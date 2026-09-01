/**
 * Skill: sale.search (v2 — Sprint 005)
 * Lista pedidos de venda com filtros opcionais.
 */
import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { SalesOrderService } from "../service/sales-order.service";
import { saleSearchSchema } from "../schemas";

export { saleSearchSchema };

export const saleSearchSkill = defineBaseSkill({
  id: "sale.search",
  name: "Pesquisar vendas",
  module: "sales",
  description: "Lista pedidos com filtros (cliente, status, período, busca livre).",
  schema: saleSearchSchema,
  requiredPermissions: ["sales.view"],
  destructive: false,
  async handler(input, ctx) {
    const svc = new SalesOrderService(ctx);
    const rows = await svc.list({
      query: input.query,
      customerId: input.customerId,
      status: input.status,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      limit: input.limit ?? 20,
    });
    if (rows.length === 0) {
      // DIAGNÓSTICO TEMPORÁRIO (2026-09-01) — investigando por que
      // essa busca retorna vazio mesmo com filtros corretos e dados
      // reais confirmados no banco (logs do Supabase mostram
      // auth_user: null nessa consulta específica). Anexado um
      // resumo do estado da autenticação na própria resposta, pra dar
      // pra ver sem precisar de acesso a log de servidor. REMOVER
      // depois de identificar a causa raiz.
      const diag = `[diagnóstico: supabase=${!!ctx.supabase}, companyId=${ctx.companyId}, userId=${ctx.userId ?? "ausente"}]`;
      return skillResult.success(`Nenhum pedido encontrado com os filtros informados. ${diag}`, {
        rows: [],
      });
    }
    const preview = rows
      .slice(0, 5)
      .map(
        (r) =>
          `• #${r.number ?? "s/nº"} — ${r.customerName ?? "cliente n/i"} — R$ ${r.grandTotal.toFixed(2)} (${r.status})`,
      )
      .join("\n");
    return skillResult.success(
      `${rows.length} pedido(s) encontrado(s):\n${preview}`,
      { rows },
    );
  },
});
