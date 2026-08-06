import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCompanyId } from "@/lib/company-resolver.server";

async function requireCurrentCompanyId(supabase: any, userId: string): Promise<string> {
  return await resolveCompanyId(supabase, userId);
}

export const getExternalOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { marketplace?: string; status?: string } | undefined) => {
    return {
      marketplace: input?.marketplace ?? "mercadolivre",
      status: input?.status ?? "pending",
    };
  })
  .handler(async ({ data, context }) => {
    const companyId = await requireCurrentCompanyId(context.supabase, context.userId);
    
    const { data: orders, error } = await (context.supabase as any)
      .from("external_orders")
      .select("*")
      .eq("company_id", companyId)
      .eq("marketplace", data.marketplace)
      .eq("status", data.status)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return orders;
  });

export const importExternalOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    orderId: z.string(),
    productId: z.string().uuid().optional(),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const companyId = await requireCurrentCompanyId(supabase, context.userId);

    // 1. Buscar o pedido externo
    const { data: extOrder, error: fetchErr } = await (supabase as any)
      .from("external_orders")
      .select("*")
      .eq("id", data.orderId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!extOrder) throw new Error("Pedido não encontrado");
    if (extOrder.status === "imported") throw new Error("Pedido já importado");

    const payload = extOrder.payload;
    
    // 2. Criar a venda (Sale)
    const saleNumber = `ML-${payload.id}`;
    
    const { data: existingSale } = await supabase
      .from("sales")
      .select("id")
      .eq("company_id", companyId)
      .eq("number", saleNumber)
      .maybeSingle();
    
    let saleId = existingSale?.id;

    if (!saleId) {
      const { data: newSale, error: saleErr } = await supabase
        .from("sales")
        .insert({
          company_id: companyId,
          number: saleNumber,
          status: "paid", 
          sale_date: new Date().toISOString().split('T')[0],
          items_total: payload.total_amount || 0,
          grand_total: payload.total_amount || 0,
          notes: `Importado do Mercado Livre. Pedido #${payload.id}`,
          created_by: context.userId,
        })
        .select("id")
        .single();

      if (saleErr) throw saleErr;
      saleId = newSale.id;
    }

    // 3. Criar os itens da venda (Sale Items) e gravar o mapeamento se fornecido
    const items = payload.order_items || [];
    const saleItems = [];
    
    for (const item of items) {
      let productId = data.productId;
      const mlItemId = item.item.id;

      if (!productId && mlItemId) {
        const { data: product } = await (supabase as any)
          .from("products")
          .select("id")
          .eq("company_id", companyId)
          .eq("ml_item_id", mlItemId)
          .maybeSingle();
        productId = product?.id;
      }

      // Se o operador vinculou manualmente, gravar o ml_item_id no produto para automatizar próximas vendas
      if (data.productId && mlItemId) {
        await (supabase as any)
          .from("products")
          .update({ ml_item_id: mlItemId })
          .eq("id", data.productId)
          .eq("company_id", companyId);
      }

      const { data: productInfo } = await (supabase as any)
        .from("products")
        .select("name, price")
        .eq("id", productId || "")
        .maybeSingle();

      saleItems.push({
        sale_id: saleId,
        product_id: productId || null,
        description: productInfo?.name || item.item.title || "Produto ML",
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
      });
    }

    if (saleItems.length > 0) {
      const { error: itemsErr } = await supabase
        .from("sale_items")
        .insert(saleItems);
      if (itemsErr) throw itemsErr;
    }

    // 4. Marcar o pedido externo como importado
    const { error: updateErr } = await (supabase as any)
      .from("external_orders")
      .update({
        status: "imported",
        imported_at: new Date().toISOString(),
        sale_id: saleId
      })
      .eq("id", extOrder.id);
    
    if (updateErr) throw updateErr;

    return { success: true, saleId };
  });
