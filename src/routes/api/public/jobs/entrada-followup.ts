/**
 * Job: Recuperação de entrada não paga ("carrinho abandonado" do catálogo).
 * ...
 */
import { createFileRoute } from "@tanstack/react-router";
import { authorizeJobRequest } from "@/lib/job-auth.server";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import { runJob } from "@/lib/job-runs.server";
import { requireServiceKey } from "@/lib/job-admin.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// REDUZIDO PARA TESTE: 0.01 horas (~36 segundos) em vez de 3 horas
const FOLLOWUP_AFTER_HOURS = 0.01; 
const MAX_PER_RUN = 100;

export const Route = createFileRoute("/api/public/jobs/entrada-followup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ... (resto do código idêntico)
        const rateLimit = enforceRateLimit({
          route: "jobs:entrada-followup",
          windowMs: 60_000,
          max: 10,
        });
        if (rateLimit) return rateLimit;

        const denied = authorizeJobRequest(request);
        if (denied) return denied;

        const noServiceKey = requireServiceKey("entrada-followup");
        if (noServiceKey) return noServiceKey;

        return runJob("entrada-followup", async () => {
          const results = {
            candidates: 0,
            sent: 0,
            skipped_no_phone: 0,
            errors: [] as string[],
          };

          try {
            const cutoff = new Date(Date.now() - FOLLOWUP_AFTER_HOURS * 60 * 60 * 1000).toISOString();

            const { data: charges, error } = await supabaseAdmin
              .from("bella_pay_charges")
              .select(
                "id, company_id, buyer_name, buyer_phone, value, pix_payload, invoice_url, payment_link, description, external_reference, created_at",
              )
              .in("status", ["PENDING", "AWAITING_RISK_ANALYSIS"])
              .is("followup_sent_at", null)
              .not("buyer_phone", "is", null)
              .like("external_reference", "catalog:%")
              .lt("created_at", cutoff)
              .order("created_at", { ascending: true })
              .limit(MAX_PER_RUN);

            if (error) throw error;

            results.candidates = charges?.length ?? 0;

            const { sendWhatsAppTemplateRaw, recordWhatsAppOutboundEvent } =
              await import("@/lib/whatsapp.server");
            const { getRequestHost } = await import("@tanstack/react-start/server");

            let host = "";
            try {
              host = getRequestHost();
            } catch {
              host = "";
            }

            for (const charge of charges ?? []) {
              try {
                if (!charge.buyer_phone) {
                  results.skipped_no_phone++;
                  continue;
                }

                const valorFmt = new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(Number(charge.value) || 0);

                const linkPix = charge.pix_payload ?? charge.payment_link ?? charge.invoice_url ?? "";

                let headerImageUrl: string | undefined;
                if (charge.pix_payload && host) {
                  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
                  headerImageUrl = `${proto}://${host}/api/public/bella-pay/qr/${charge.id}.png`;
                }

                const sendResult = await sendWhatsAppTemplateRaw({
                  to: charge.buyer_phone,
                  templateName: "cobranca_criada_v2",
                  languageCode: "pt_BR",
                  variables: [
                    charge.buyer_name ?? "cliente",
                    charge.description ?? "Pedido",
                    valorFmt,
                    linkPix,
                  ],
                  headerImageUrl,
                });

                await recordWhatsAppOutboundEvent(supabaseAdmin as any, {
                  companyId: charge.company_id,
                  waMessageId: sendResult.waMessageId,
                  status: sendResult.ok ? "sent" : "failed",
                });

                if (sendResult.ok) {
                  await supabaseAdmin
                    .from("bella_pay_charges")
                    .update({ followup_sent_at: new Date().toISOString() })
                    .eq("id", charge.id);
                  results.sent++;
                } else {
                  results.errors.push(`Charge ${charge.id}: ${sendResult.error ?? "envio falhou"}`);
                }
              } catch (err: any) {
                results.errors.push(`Charge ${charge.id}: ${err.message}`);
              }
            }

            return Response.json({ ok: true, results });
          } catch (err: any) {
            console.error("[entrada-followup] Fatal error:", err);
            return Response.json({ ok: false, error: err.message }, { status: 500 });
          }
        });
      },
    },
  },
});
