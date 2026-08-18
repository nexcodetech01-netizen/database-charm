import { createFileRoute } from "@tanstack/react-router";
import { generateSuperfreteLabel } from "@/features/shipping/lib/generate-superfrete-label";
import type { GenerateLabelInput } from "@/features/shipping/types";

/**
 * Rota pública mantida por compatibilidade (ex.: chamadas externas
 * diretas). A tela do NexOS usa a server function `generateLabel`
 * (features/shipping/services/shipping.functions.ts), que chama
 * `generateSuperfreteLabel` diretamente — sem passar por aqui — desde
 * a correção de 2026-08-18 (ver comentário lá para o porquê).
 */
export const Route = createFileRoute("/api/public/shipping/labels")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
