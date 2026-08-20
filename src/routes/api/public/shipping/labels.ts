import { createFileRoute } from "@tanstack/react-router";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import { authorizeJobRequest } from "@/lib/job-auth.server";
import { generateSuperfreteLabel } from "@/features/shipping/lib/generate-superfrete-label";
import type { GenerateLabelInput } from "@/features/shipping/types";

/**
 * Rota pública mantida por compatibilidade (ex.: chamadas externas
 * diretas). A tela do NexOS usa a server function `generateLabel`
 * (features/shipping/services/shipping.functions.ts), que chama
 * `generateSuperfreteLabel` diretamente — sem passar por aqui — desde
 * a correção de 2026-08-18 (ver comentário lá para o porquê).
 *
 * SEGURANÇA (2026-08-20): essa rota GERA E PAGA etiquetas de verdade
 * usando o saldo real da conta SuperFrete — e estava totalmente
 * pública, sem autenticação nem limite de taxa. Qualquer pessoa que
 * descobrisse esse endereço podia gastar o saldo da SuperFrete gerando
 * etiquetas arbitrárias, sem nenhuma barreira. Adicionada exigência de
 * credencial (mesmo mecanismo `CRON_JOB_SECRET` usado nos jobs
 * internos — `Authorization: Bearer <segredo>`) + limite de taxa.
 *
 * IMPORTANTE: se você tiver algum sistema externo de verdade chamando
 * essa rota hoje, ele vai passar a receber 401 até ser configurado
 * pra mandar o header de autorização com o CRON_JOB_SECRET. Se
 * ninguém externo usa essa rota (o mais provável, já que o próprio
 * NexOS não usa mais desde 18/08), essa mudança é só redução de risco,
 * sem efeito colateral nenhum.
 */
export const Route = createFileRoute("/api/public/shipping/labels")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = enforceRateLimit({
          route: "shipping:labels-legacy",
          max: 10,
          windowMs: 60_000,
        });
        if (limited) return limited;

        const denied = authorizeJobRequest(request);
        if (denied) return denied;

        try {
          const body = (await request.json()) as GenerateLabelInput;
          const result = await generateSuperfreteLabel(body);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error: any) {
          console.error("[SHIPPING_LABELS] Erro:", error);
          return new Response(
            JSON.stringify({ error: error?.message || "Erro interno inesperado" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
