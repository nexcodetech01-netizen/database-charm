import { z } from "zod";
import { toast } from "sonner";
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




// Projeção enxuta para listagem.
const LIST_SELECT = `
  id, sku, name, brand, price, stock, min_stock, unit, status,
  category_id, supplier_id, cover_image_path, ml_item_id, ml_permalink,
  created_at, updated_at, company_id, description, sales_channels, product_type,
  category:product_categories(id, name),
  supplier:product_suppliers(id, name),
  composition:product_kit_components!product_kit_components_parent_id_fkey(
    id, parent_id, component_id, quantity,
    product:products!product_kit_components_component_id_fkey(id, name, sku, cost, stock)
  )
`;

// Projeção completa (detalhe/edição/duplicação).
const DETAIL_SELECT = `
  *,
  category:product_categories(id, name, target_margin_pct, min_margin_pct, default_discount_pct),
  supplier:product_suppliers(id, name),
  composition:product_kit_components!product_kit_components_parent_id_fkey(
    id, component_id, quantity,
    product:products!product_kit_components_component_id_fkey(id, name, sku, cost, stock)
  )
`;

function calculateKitStock(composition: any[], parentId?: string) {
  if (!composition || composition.length === 0) return 0;
  
  // Garantir que a busca na tabela kit_components use estritamente o ID do produto do kit atual
  let components = parentId 
    ? composition.filter(c => c.parent_id === parentId || c.parent_product_id === parentId)
    : composition;

  if (components.length === 0) return 0;

  // CORREÇÃO: Limpeza e deduplicação de componentes para evitar contagem duplicada ou somas incorretas
  // Mantemos apenas um registro por component_id (o primeiro que aparecer)
  const uniqueComponentsMap = new Map();
  components.forEach(c => {
    const compId = c.component_id || c.id;
    if (compId && !uniqueComponentsMap.has(compId)) {
      uniqueComponentsMap.set(compId, c);
    }
  });
  
  const uniqueComponents = Array.from(uniqueComponentsMap.values());

  const stocks = uniqueComponents.map((c: any) => {
    // Garantimos que estamos pegando o estoque do produto vinculado ao componente individualmente
    const componentProduct = c.product || c.produto_componente || c;
    const componentStock = Number(componentProduct?.stock ?? 0);
    const quantityInKit = Number(c.quantity || 1);
    
    const safeQuantity = quantityInKit > 0 ? quantityInKit : 1;
    // A conta do kit DEVE olhar o estoque de CADA componente individualmente. 
    // Fórmula Math.floor(estoque / quantidade_necessaria)
    return Math.floor(componentStock / safeQuantity);
  });
  
  // O estoque do kit é o valor MÍNIMO entre os componentes (gargalo)
  return Math.min(...stocks);
}

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

    // Listagem total de produtos ativos (auditável).
    // Filtros de exclusão por mesclagem removidos conforme solicitação Sprint RC2.
    if (!filters.includeInactive) {
      q = q.eq("status", "active");
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

    let rows = (data ?? []) as unknown as any[];
    
    // Virtual Stock Calculation for Kits in List
    // Simplificado: se o stock no banco for 0 ou nulo, usamos o cálculo do kit.
    // Se o usuário gravou um override (ex: 2), respeitamos o valor do banco.
    rows = rows.map(r => {
      if (r.product_type === 'kit' && r.composition && r.composition.length > 0) {
        const calculated = calculateKitStock(r.composition, r.id);
        // Se o stock gravado for diferente de 0, assumimos override manual.
        // Caso contrário, usamos o calculado.
        if (!r.stock || Number(r.stock) === 0) {
          r.stock = calculated;
        }
      }
      return r;
    });
    
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
        composition:product_kit_components!product_kit_components_parent_id_fkey(
          id, component_id, quantity,
          product:products!product_kit_components_component_id_fkey(id, name, sku, cost, stock)
        )
      `)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    
    if (data && data.product_type === 'kit' && data.composition) {
      const calculated = calculateKitStock(data.composition, data.id);
      if (!data.stock || Number(data.stock) === 0) {
        data.stock = calculated;
      }
    }
    
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

    const { composition, stock, ...insertPayload } = input as ProductInsert & { stock?: number };
    const { data, error } = await supabase
      .from("products")
      .insert(insertPayload as any)
      .select()
      .single();
    if (error) throw error;

    // Handle initial stock movement
    const initialQty = Number(stock ?? 0);
    if (initialQty > 0 && data?.id) {
      const { error: movError } = await supabase.from("inventory_movements").insert({
        company_id: input.company_id,
        product_id: data.id,
        quantity: initialQty,
        type: "in",
        source: "manual", // Fallback seguro conforme restrição do banco (enum: manual, purchase, sale, adjustment, etc)
        reason: "Saldo inicial no cadastro do produto",
        movement_date: new Date().toISOString(),
      });
      if (movError) {
        console.error("Erro ao registrar estoque inicial:", movError);
        toast.error("Produto criado, mas erro ao registrar saldo inicial");
      }
    }

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
    // Override manual de estoque permitido para todos os tipos (incluindo Kits).
    // O valor digitado pelo usuário tem prioridade absoluta e é gravado diretamente.
    
    const { composition, ...safeInputWithoutComp } = input;
    
    try {
      const { data: updated, error } = await supabase
        .from("products")
        .update(safeInputWithoutComp as any)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Erro ao atualizar produto:", error);
        throw error;
      }

      // Sync composition
      if (composition !== undefined) {
        // Clear existing
        await supabase.from("product_kit_components").delete().eq("parent_id", id);
        
        if (composition.length > 0) {
          const companyId = updated?.company_id || (input as any)?.company_id;
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

      // Sincronização fire-and-forget com Mercado Livre
      const patched = safeInputWithoutComp as Partial<{ price: number }>;
      const touchesMl = Object.prototype.hasOwnProperty.call(patched, "price");

      if (touchesMl && updated?.ml_item_id) {
        void import("@/lib/mercadolivre-sync.functions")
          .then(({ syncProductToMercadoLivre }) =>
            syncProductToMercadoLivre({ data: { productId: id } }).catch(() => {})
          )
          .catch(() => {});
      }
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Falha ao salvar: ${msg}`);
      throw err;
    }
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
