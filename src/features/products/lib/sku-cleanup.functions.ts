/**
 * Server functions da ferramenta administrativa "Padronizar SKUs legados".
 *
 * - Lista produtos cujo SKU começa com "PROD-" (padrão legado de compras).
 * - Calcula o SKU sugerido via RPC `generate_product_sku` (fonte única).
 * - Aplica renomeação **apenas** de `products.sku` (não toca vendas, estoque,
 *   compras, movimentos ou históricos).
 * - Registra cada renomeação em `sku_rename_audit`.
 *
 * Autorização:
 *   - `requireSupabaseAuth` (RLS ativa).
 *   - Escrita restrita a owner da empresa ou role `owner`/`admin` — validado
 *     na policy da tabela de auditoria e no início do handler.
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerPermission } from "@/features/rbac/guards/server-guards";
import type { Database } from "@/integrations/supabase/types";

const LEGACY_PREFIX = "PROD-";

export interface LegacySkuRow {
  productId: string;
  name: string;
  categoryName: string | null;
  currentSku: string;
  suggestedSku: string | null;
  conflict: boolean;
  reason: string | null;
}

export interface LegacySkuScan {
  rows: LegacySkuRow[];
  total: number;
}

const scanInput = z.object({ companyId: z.string().uuid() });
const applyInput = z.object({
  companyId: z.string().uuid(),
  productId: z.string().uuid(),
  newSku: z.string().trim().min(3).max(64),
  source: z.enum(["single", "bulk"]).default("single"),
});

async function assertAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
  companyId: string,
): Promise<void> {
  const { data: company } = await supabase
    .from("companies")
    .select("owner_id")
    .eq("id", companyId)
    .maybeSingle();
  if (company?.owner_id === userId) return;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role:roles(name)")
    .eq("user_id", userId)
    .eq("company_id", companyId);

  const names = ((roles ?? []) as Array<{ role: { name: string } | null }>)
    .map((r) => r.role?.name)
    .filter(Boolean) as string[];

  if (!names.some((n) => n === "owner" || n === "admin")) {
    throw new Error("Apenas administradores podem padronizar SKUs.");
  }
}

/** Lista produtos legados + SKU sugerido + verificação de conflito. */
export const scanLegacySkus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => scanInput.parse(data))
  .handler(async ({ data, context }): Promise<LegacySkuScan> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.companyId);

    const { data: rows, error } = await supabase
      .from("products")
      .select("id, name, sku, category:product_categories(name)")
      .eq("company_id", data.companyId)
      .ilike("sku", `${LEGACY_PREFIX}%`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    type Row = {
      id: string;
      name: string;
      sku: string;
      category: { name: string | null } | null;
    };
    const list = (rows ?? []) as unknown as Row[];

    const out: LegacySkuRow[] = [];
    for (const p of list) {
      const categoryName = p.category?.name ?? null;
      let suggestedSku: string | null = null;
      let reason: string | null = null;
      let conflict = false;

      const { data: sku, error: rpcErr } = await supabase.rpc(
        "generate_product_sku",
        {
          _company_id: data.companyId,
          _name: p.name,
          _category_name: categoryName ?? undefined,
        },
      );
      if (rpcErr) {
        reason = rpcErr.message;
      } else if (!sku) {
        reason = "RPC retornou vazio";
      } else {
        suggestedSku = sku as string;
        if (suggestedSku.toLowerCase() === p.sku.toLowerCase()) {
          reason = "SKU sugerido é igual ao atual";
        } else {
          const { data: dup } = await supabase
            .from("products")
            .select("id")
            .eq("company_id", data.companyId)
            .ilike("sku", suggestedSku)
            .neq("id", p.id)
            .limit(1);
          if (dup && dup.length > 0) {
            conflict = true;
            reason = "Conflito: SKU já usado por outro produto";
          }
        }
      }

      out.push({
        productId: p.id,
        name: p.name,
        categoryName,
        currentSku: p.sku,
        suggestedSku,
        conflict,
        reason,
      });
    }

    return { rows: out, total: out.length };
  });

/**
 * Aplica a renomeação de um único produto.
 * - Verifica que o SKU atual ainda começa com "PROD-" (evita corrida).
 * - Verifica ausência de conflito.
 * - Atualiza `products.sku` e insere registro em `sku_rename_audit`.
 * - **Não** altera outras tabelas.
 */
export const applyLegacySkuRename = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => applyInput.parse(data))
  .handler(async ({ data, context }) => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "products.update", {
      companyId: data.companyId,
      action: "products.sku.rename",
      module: "products",
    });
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.companyId);

    const { data: product, error: fetchErr } = await supabase
      .from("products")
      .select("id, sku, company_id")
      .eq("id", data.productId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!product) throw new Error("Produto não encontrado.");
    if (product.company_id !== data.companyId) {
      throw new Error("Produto pertence a outra empresa.");
    }
    const currentSku = product.sku ?? "";
    if (!currentSku.toUpperCase().startsWith(LEGACY_PREFIX)) {
      throw new Error(
        `Este produto não é legado (SKU atual: ${currentSku || "(vazio)"}). Nada foi alterado.`,
      );
    }
    if (product.sku === data.newSku) {
      throw new Error("O SKU sugerido é igual ao atual.");
    }

    const { data: dup } = await supabase
      .from("products")
      .select("id")
      .eq("company_id", data.companyId)
      .ilike("sku", data.newSku)
      .neq("id", data.productId)
      .limit(1);
    if (dup && dup.length > 0) {
      throw new Error(`SKU "${data.newSku}" já está em uso.`);
    }

    const oldSku = currentSku;
    const { error: updErr } = await supabase
      .from("products")
      .update({ sku: data.newSku })
      .eq("id", data.productId);
    if (updErr) throw new Error(updErr.message);

    const { error: auditErr } = await supabase.from("sku_rename_audit").insert({
      company_id: data.companyId,
      product_id: data.productId,
      old_sku: oldSku,
      new_sku: data.newSku,
      applied_by: userId,
      source: data.source,
    });
    if (auditErr) {
      // Reverte a alteração para manter consistência com o log.
      await supabase
        .from("products")
        .update({ sku: oldSku })
        .eq("id", data.productId);
      throw new Error(`Falha ao registrar auditoria: ${auditErr.message}`);
    }

    return { ok: true as const, oldSku, newSku: data.newSku };
  });

export interface SkuAuditEntry {
  id: string;
  productId: string;
  oldSku: string;
  newSku: string;
  source: string;
  createdAt: string;
}

/** Últimas renomeações da empresa, para exibir junto ao workspace. */
export const listSkuRenameAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ companyId: z.string().uuid(), limit: z.number().int().min(1).max(200).default(50) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<SkuAuditEntry[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("sku_rename_audit")
      .select("id, product_id, old_sku, new_sku, source, created_at")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      productId: r.product_id as string,
      oldSku: r.old_sku as string,
      newSku: r.new_sku as string,
      source: r.source as string,
      createdAt: r.created_at as string,
    }));
  });
