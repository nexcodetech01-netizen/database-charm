import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { emitAgentEvent } from "@/features/bella-ai/agent/infrastructure/event-bus";
import { makeSecurityContext } from "@/features/bella-ai/agent/infrastructure/context";
import { formatCurrency } from "@/lib/format";

const NotificationPayloadSchema = z.object({
  type: z.literal("catalog.order.received"),
  company_id: z.string().uuid(),
  title: z.string().min(1),
  message: z.string().min(1),
  source: z.string().default("n8n"),
  event_id: z.string().min(1),
  // Campos opcionais para enriquecer a notificação se disponíveis
  total: z.number().optional(),
  item_count: z.number().optional(),
  buyer_name: z.string().optional(),
});

export const Route = createFileRoute("/api/public/notifications/trigger")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("Authorization");
        const secret = process.env.NEXOS_N8N_WEBHOOK_SECRET;

        // 1. Autenticação
        if (!secret || authHeader !== `Bearer ${secret}`) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }

        // 2. Parse do Payload
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const result = NotificationPayloadSchema.safeParse(body);
        if (!result.success) {
          return new Response(
            JSON.stringify({ error: "Validation failed", details: result.error.format() }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const data = result.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 3. Proteção contra duplicidade
        // Usamos uma tabela de log de eventos ou similar se existir, ou verificamos se já emitimos este requestId.
        // Como o sistema é stateless no Worker, vamos usar o Supabase para persistir o event_id.
        // Verificamos na tabela `whatsapp_message_events` ou criamos uma específica se necessário.
        // Para seguir o padrão NexOS, vamos verificar se já existe um log com este requestId na tabela de auditoria.
        
        const requestId = `n8n-${data.event_id}`;
        
        // Verificação de duplicidade via whatsapp_message_events (reutilizando tabela de eventos)
        const { data: existingEvent } = await supabaseAdmin
          .from("whatsapp_message_events")
          .select("id")
          .eq("wa_message_id", requestId) // Usamos wa_message_id como slot para o requestId/event_id
          .maybeSingle();

        if (existingEvent) {
          return new Response(
            JSON.stringify({ success: true, duplicate: true, event_id: data.event_id }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // 4. Disparo do Evento
        try {
          // Registrar o evento para evitar duplicidade futura
          const { error } = await supabaseAdmin.from("whatsapp_message_events").insert({
            company_id: data.company_id,
            direction: "inbound",
            wa_message_id: requestId,
            status: "processed",
            sent_at: new Date().toISOString(),
          });

          if (error) {
            console.error("[NOTIFICATIONS] Falha ao persistir evento n8n:", error);
            throw error;
          }

          const now = new Date();
          
          await emitAgentEvent({
            type: data.type,
            ctx: {
              companyId: data.company_id,
              userId: "system",
              conversationId: `n8n:${data.event_id}`,
              request: {
                requestId: requestId,
                channel: "automation",
                startedAt: now,
              },
              security: makeSecurityContext(new Set(["*"]), true),
              supabase: supabaseAdmin as any,
            },
            payload: {
              entityId: data.event_id,
              ticketId: data.event_id,
              companyId: data.company_id,
              buyerName: data.buyer_name || "Cliente (n8n)",
              total: data.total || 0,
              itemCount: data.item_count || 0,
              externalSource: data.source,
              message: data.message
            },
            title: data.title,
            description: data.message,
          });

          return new Response(
            JSON.stringify({ 
              success: true, 
              event_id: data.event_id, 
              message: "Notificação de novo pedido disparada" 
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (err) {
          console.error("[n8n-trigger] Erro ao disparar evento:", err);
          return new Response(
            JSON.stringify({ error: "Internal Server Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
