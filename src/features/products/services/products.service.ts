import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { updateRow } from "@/services/supabase.service";
import { applyProductSearch } from "../lib/product-search";
import type { Product, ProductInsert, ProductListFilters, ProductUpdate } from "../types";

// P1.2 — Validação server-side na criação de produto.
const productCreateSchema = z
  .object({
    company_id: z.string().uuid("Empresa inválida."),
    name: z
      .string()
      .trim()
      .min(1, "Nome do produto é obrigatório.")
      .max(200, "Nome muito longo."),
    cost: z.number().nonnegative("Custo não pode ser negativo.").nullable().optional(),
    price: z.number().nonnegative("Preço não pode ser negativo.").nullable().optional(),
  })
  .passthrough();




// Projeção enxuta para listagem (evita jsonb, custo, tags e joins de política de preço).
const LIST_SELECT = `
  id, sku, name, brand, price, stock, min_stock, unit, status,
  category_id, supplier_id, cover_image_path, ml_item_id, ml_permalink,
  created_at, updated_at, company_id, description, sales_channels,
  category:product_categories(id, name),
  supplier:product_suppliers(id, name)
`;

// Projeção completa (detalhe/edição/duplicação).
const DETAIL_SELECT = `
  *,
  category:product_categories(id, name, target_margin_pct, min_margin_pct, default_discount_pct),
  supplier:product_suppliers(id, name)
`;

export const productsService = {
  async list(companyId: string, filters: ProductListFilters) {
    let q = supabase
      .from("products")
      .select(LIST_SELECT, { count: "exact" })
      .eq("company_id", companyId);

    if (filters.search.trim()) {
      q = applyProductSearch(q, filters.search);
    }

    if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
    if (filters.supplierId) q = q.eq("supplier_id", filters.supplierId);
    if (filters.status) q = q.eq("status", filters.status);
    else if (!filters.includeInactive) q = q.eq("status", "active");

    // Produtos inativados por mesclagem recebem sufixo -MERGED no SKU.
    if (!filters.includeInactive) {
      q = q.or("sku.is.null,and(sku.not.ilike.%-MERGED,sku.not.ilike.%_MERGED)");
    }

    if (filters.stock === "out") q = q.lte("stock", 0);
    else if (filters.stock === "low") q = q.gt("stock", 0);
    else if (filters.stock === "in_stock") q = q.gt("stock", 0);

    q = q.order(filters.sortBy, { ascending: filters.sortDir === "asc" });

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    let rows = (data ?? []) as unknown as Product[];
    // "low" precisa comparar stock <= min_stock — filtro client-side pós query
    if (filters.stock === "low") {
      rows = rows.filter((r) => Number(r.stock) <= Number(r.min_stock));
    }

    return { rows, total: count ?? 0 };
  },

  async metrics(companyId: string) {
    const { data, error } = await supabase.rpc("products_inventory_metrics", {
      _company_id: companyId,
    });
    if (error) throw error;
    const m = (data ?? {}) as {
      total_products?: number;
      active_products?: number;
      below_min_count?: number;
      inventory_value?: number;
    };
    return {
      total: Number(m.total_products ?? 0),
      active: Number(m.active_products ?? 0),
      critical: Number(m.below_min_count ?? 0),
      inventoryValue: Number(m.inventory_value ?? 0),
    };
  },

  async get(id: string) {
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        category:product_categories(id, name, target_margin_pct, min_margin_pct, default_discount_pct),
        supplier:product_suppliers(id, name),
        images:product_images(id, path, position, focal_x, focal_y, zoom),
        composition:product_kit_components(
          id, component_id, quantity,
          product:products!product_kit_components_component_id_fkey(name, sku, cost, stock)
        )
      `)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * Criação com UPSERT: se já existir produto com o mesmo Nome, SKU ou
   * Código de Barras na empresa, o registro existente é atualizado
   * (custo/preço/dados do novo lançamento) e a quantidade informada entra
   * como movimentação de estoque — nunca é criado um duplicado.
   */
  async create(input: ProductInsert) {
    // Sanitização de marca: TG ou vazio vira Generica
    const brand = (input.brand ?? "").trim();
    if (!brand || brand.toLowerCase() === "tg") {
      input.brand = "Generica";
    }

    const parsed = productCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => i.message).join(" · "));
    }

    const { findDuplicateProduct } = await import("../lib/product-dedupe");
    const duplicate = await findDuplicateProduct(input.company_id, {
      name: input.name,
      sku: input.sku ?? null,
      barcode: (input as { barcode?: string | null }).barcode ?? null,
    });

    if (duplicate) {
      const {
        stock,
        company_id: _companyId,
        sku,
        // Mesmo produto: a descrição já salva no banco nunca é sobrescrita.
        description: _ignoredDescription,
        price: incomingPrice,
        cost: incomingCost,
        ...rest
      } = input as ProductInsert & {
        stock?: number | null;
        description?: string | null;
        price?: number | null;
        cost?: number | null;
      };

      const num = (v: unknown) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };
      // Só sobrescreve price/cost quando o novo lançamento traz valor > 0.
      const nextPrice = num(incomingPrice) > 0 ? num(incomingPrice) : num(duplicate.price);
      const nextCost = num(incomingCost) > 0 ? num(incomingCost) : num(duplicate.cost);

      // Atualiza o registro existente com os dados do novo lançamento.
      // O SKU original é preservado (não geramos SKU novo para o mesmo produto).
      const patch = {
        ...rest,
        price: nextPrice,
        cost: nextCost,
        ...(duplicate.sku ? {} : { sku: sku ?? null }),
      } as ProductUpdate;

      const { composition: _composition, ...safePatch } = patch;
      const { data: updated, error: updateError } = await supabase
        .from("products")
        .update(safePatch as any)
        .eq("id", duplicate.id)
        .select()
        .single();
      if (updateError) throw updateError;

      // Estoque: sempre pelo motor oficial (inventory_movements).
      const qty = Number(stock ?? 0);
      if (Number.isFinite(qty) && qty > 0) {
        const { error: movError } = await supabase.from("inventory_movements").insert({
          company_id: input.company_id,
          product_id: duplicate.id,
          quantity: qty,
          type: "in",
          source: "product_upsert",
          reason: "Entrada por cadastro/importação de produto existente",
          movement_date: new Date().toISOString(),
        });
        if (movError) throw movError;
      }

      return { ...(updated as Record<string, unknown>), __merged: true, __matchedBy: duplicate.matchedBy } as unknown as typeof updated;
    }

    const { composition, ...insertPayload } = input;
    const { data, error } = await supabase
      .from("products")
      .insert(insertPayload as any)
      .select()
      .single();
    if (error) throw error;

    // Handle composition for kits
    if (composition && composition.length > 0 && data?.id) {
      const components = composition.map((c: any) => ({
        company_id: (input as any).company_id,
        parent_id: data.id,
        component_id: c.component_id,
        quantity: c.quantity
      }));

      const { error: compError } = await supabase
        .from("product_kit_components")
        .insert(components);
      
      if (compError) {
        console.error("Erro ao salvar composição:", compError);
        toast.error("Produto criado, mas erro ao salvar composição");
      }
    }

    return data;
  },



  async update(id: string, input: ProductUpdate) {
    // CORREÇÃO 1 — products.stock só pode ser alterado pelo motor
    // (inventory_movements → apply_inventory_movement). Qualquer `stock`
    // presente no payload é descartado aqui; o banco também bloqueia.
    const { stock: _ignoredStock, ...safeInput } = input as ProductUpdate & {
      stock?: number;
    };
    const { composition, ...safeInputWithoutComp } = safeInput;
    const updated = await updateRow("products", id, safeInputWithoutComp as any);

    // Sync composition
    if (composition !== undefined) {
      // Clear existing
      await supabase.from("product_kit_components").delete().eq("parent_id", id);
      
      if (composition.length > 0) {
        // Get company_id from updated or input
        const companyId = (updated as any)?.company_id || (input as any)?.company_id;
        if (companyId) {
          const components = composition.map((c: any) => ({
            company_id: companyId,
            parent_id: id,
            component_id: c.component_id,
            quantity: c.quantity
          }));
          await supabase.from("product_kit_components").insert(components);
        }
      }
    }
    // Sincronização fire-and-forget com Mercado Livre quando o produto
    // já está publicado (ml_item_id) e price foi alterado.
    const patched = safeInput as Partial<{ price: number }>;
    const touchesMl = Object.prototype.hasOwnProperty.call(patched, "price");

    const rec = updated as unknown as { ml_item_id?: string | null };
    if (touchesMl && rec?.ml_item_id) {
      // Import dinâmico para não puxar server-fn em bundles que só leem produtos.
      void import("@/lib/mercadolivre-sync.functions")
        .then(({ syncProductToMercadoLivre }) =>
          syncProductToMercadoLivre({ data: { productId: id } }).catch(() => {
            /* silencioso — log fica no server-function-logs */
          }),
        )
        .catch(() => {});
    }
    return updated;
  },

  // Inativação: preserva histórico (imagens, SKU, movements, vendas, compras).
  // Apenas altera products.status para 'inactive'.
  async deactivate(id: string) {
    const { data, error } = await supabase
      .from("products")
      .update({ status: "inactive" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },


  async remove(id: string) {
    const { count, error: countError } = await supabase
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id);
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      throw new Error(
        "Este produto possui movimentação de estoque e não pode ser excluído.",
      );
    }
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
  },
};
