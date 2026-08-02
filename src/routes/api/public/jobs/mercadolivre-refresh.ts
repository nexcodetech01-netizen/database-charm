/**
 * Job: refresh proativo dos tokens OAuth do Mercado Livre.
 *
 * Autenticação: header `Authorization: Bearer <CRON_JOB_SECRET>`.
 *
 * Agendar via pg_cron (a cada 6h):
 *   select net.http_post(
 *     url := 'https://project--1a3b33ac-26b1-4f6f-8e9e-b06330eaf4a3.lovable.app/api/public/jobs/mercadolivre-refresh',
 *     headers := '{"Content-Type":"application/json","Authorization":"Bearer <CRON_JOB_SECRET>"}'::jsonb,
 *     body := '{}'::jsonb);
 */

import { createFileRoute } from "@tanstack/react-router";
import { authorizeJobRequest } from "@/lib/job-auth.server";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import { runJob } from "@/lib/job-runs.server";
import { requireServiceKey } from "@/lib/job-admin.server";

export const Route = createFileRoute("/api/public/jobs/mercadolivre-refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Hardening: throttle por IP antes mesmo da checagem do segredo.
        const limited = enforceRateLimit({ route: "jobs:mercadolivre-refresh", windowMs: 60_000, max: 12 });
        if (limited) return limited;

        const denied = authorizeJobRequest(request);
        if (denied) return denied;

        const noServiceKey = requireServiceKey("mercadolivre-refresh");
        if (noServiceKey) return noServiceKey;

        return runJob("mercadolivre-refresh", async () => {

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { ensureFreshAccessToken } = await import("@/lib/mercadolivre.server");

          const { data, error } = await supabaseAdmin
            .from("mercadolivre_integrations")
            .select("company_id, connected_by")
            .not("refresh_token_encrypted", "is", null);

          if (error) {
            return Response.json({ ok: false, error: error.message }, { status: 500 });
          }

          const rows = (data ?? []) as Array<{
            company_id: string;
            connected_by: string | null;
          }>;

          let refreshed = 0;
          const failures: Array<{ companyId: string; error: string }> = [];

          for (const row of rows) {
            try {
              await ensureFreshAccessToken(
                supabaseAdmin as never,
                row.company_id,
                row.connected_by ?? "",
              );
              refreshed += 1;
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              failures.push({ companyId: row.company_id, error: message });
              const { recordDeadLetter } = await import("@/lib/dead-letter.server");
              await recordDeadLetter({
                companyId: row.company_id,
                source: "mercadolivre",
                topic: "token_refresh",
                reference: row.company_id,
                payload: { companyId: row.company_id },
                errorMessage: message,
              });
            }
          }

          return Response.json({
            ok: true,
            integrations: rows.length,
            refreshed,
            failures,
          });
        });
      },
    },
  },
});
