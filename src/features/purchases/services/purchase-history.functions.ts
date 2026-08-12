import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/**
 * Busca a última compra efetivada (status received) de um produto com um fornecedor específico.
 * Retorna o custo unitário e o frete rateado gravado no item.
 */
export const getLastPurchaseInfo = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    companyId: z.string().uuid(),
    productId: z.string().uuid().optional().nullable(),
    supplierId: z.string().uuid().optional().nullable(),
    productName: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { companyId, productId, supplierId, productName, sku } = data;

    let query = supabase
      .from("purchase_items")
      .select(`
        unit_price,
        discount,
        total,
        quantity,
        purchase:purchases!inner(
          id,
          status,
          purchase_date,
          shipping,
          items_total,
          supplier_id
        )
      `)
      .eq("purchase.company_id", companyId)
      .eq("purchase.status", "received")
      .order("purchase(purchase_date)", { ascending: false })
      .limit(1);

    if (productId) {
      query = query.eq("product_id", productId);
    } else if (sku) {
      query = query.eq("product_sku", sku);
    } else if (productName) {
      query = query.ilike("product_name", `%${productName}%`);
    } else {
      return null;
    }

    if (supplierId) {
      query = query.eq("purchase.supplier_id", supplierId);
    }

    const { data: results, error } = await query.maybeSingle();

    if (error) {
      console.error("[getLastPurchaseInfo] Error fetching last purchase:", error);
      return null;
    }

    if (!results) return null;

    const item = results as any;
    const purchase = item.purchase;

    // Cálculo do frete proporcional/rateado
    // A regra de negócio padrão no motor de compras é rateio por valor (pro-rata)
    const itemsTotal = Number(purchase.items_total) || 1; // evitar divisão por zero
    const totalShipping = Number(purchase.shipping) || 0;
    const itemValue = Number(item.total) || 0;
    
    // Proporção do item no total da nota
    const proportion = itemValue / itemsTotal;
    const itemShippingTotal = totalShipping * proportion;
    
    // Frete unitário
    const quantity = Number(item.quantity) || 1;
    const unitShipping = itemShippingTotal / quantity;

    return {
      unitPrice: Number(item.unit_price) || 0,
      unitShipping: unitShipping,
      purchaseDate: purchase.purchase_date,
      purchaseId: purchase.id,
    };
  });
