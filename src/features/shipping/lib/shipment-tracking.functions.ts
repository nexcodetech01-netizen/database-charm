import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Rastreio de envios — feature nova (2026-08-21).
 *
 * Duas server functions:
 * - `saveShipment`: chamada internamente (usuário logado, mesmo padrão
 *   de rota autenticada) logo depois de emitir uma etiqueta com
 *   sucesso, pra guardar o código de rastreio ligado à venda.
 * - `getShipmentByTrackingCode`: chamada pela página PÚBLICA de
 *   rastreio (sem login) — busca no servidor com `supabaseAdmin` (não
 *   por RLS direto no navegador), retornando só os campos que fazem
 *   sentido o cliente final ver. Mesmo padrão de segurança já usado
 *   nas páginas públicas do catálogo (`load-product-page.server.ts`).
 */

export const saveShipment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      saleId: z.string().uuid().nullable().optional(),
      orderSource: z.string().optional(),
      orderReference: z.string().optional(),
      carrier: z.string().optional(),
      serviceName: z.string().optional(),
      trackingCode: z.string().nullable().optional(),
      labelUrl: z.string().nullable().optional(),
      orderIdSuperfrete: z.string().nullable().optional(),
      recipientName: z.string().optional(),
      recipientCity: z.string().optional(),
      recipientState: z.string().optional(),
      estimatedDeliveryDays: z.number().nullable().optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inserted, error } = await supabaseAdmin
      .from("shipments")
      .insert({
        company_id: data.companyId,
        sale_id: data.saleId ?? null,
        order_source: data.orderSource ?? null,
        order_reference: data.orderReference ?? null,
        carrier: data.carrier ?? "Correios",
        service_name: data.serviceName ?? null,
        tracking_code: data.trackingCode ?? null,
        label_url: data.labelUrl ?? null,
        order_id_superfrete: data.orderIdSuperfrete ?? null,
        recipient_name: data.recipientName ?? null,
        recipient_city: data.recipientCity ?? null,
        recipient_state: data.recipientState ?? null,
        estimated_delivery_days: data.estimatedDeliveryDays ?? null,
        status: "label_created",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[saveShipment] Erro ao salvar rastreio:", error);
      // Best-effort: não travamos o fluxo de emissão de etiqueta se
      // isso falhar — a etiqueta já foi paga e emitida, o mais
      // importante já aconteceu. Só perde a página de rastreio.
      return { success: false, error: error.message };
    }

    return { success: true, shipmentId: inserted?.id };
  });

export const getShipmentByTrackingCode = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ trackingCode: z.string().min(3) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: shipment, error } = await supabaseAdmin
      .from("shipments")
      .select(
        "tracking_code, carrier, service_name, status, recipient_name, recipient_city, recipient_state, estimated_delivery_days, created_at, order_reference",
      )
      .eq("tracking_code", data.trackingCode.trim())
      .maybeSingle();

    if (error) {
      console.error("[getShipmentByTrackingCode] Erro:", error);
      return null;
    }

    return shipment;
  });
