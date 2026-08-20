import { createFileRoute } from "@tanstack/react-router";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import { calculateSuperfreteShipping } from "@/features/shipping/lib/calculate-superfrete-shipping";
import type { ShippingCalculatorInput } from "@/features/shipping/types";

/**
 * Rota pública mantida por compatibilidade (ex.: chamadas externas
 * diretas). A tela do NexOS usa a server function `calculateShipping`
 * (features/shipping/services/shipping.functions.ts), que chama
 * `calculateSuperfreteShipping` diretamente — sem passar por aqui —
 * desde a correção de 2026-08-18.
 *
 * SEGURANÇA (2026-08-20): essa rota estava totalmente pública, sem
 * autenticação NEM limite de taxa — qualquer pessoa na internet podia
 * chamar repetidamente, consumindo a cota de chamadas da SuperFrete e
 * potencialmente gerando custo/bloqueio da integração. Adicionado
 * rate limit (mesmo padrão usado em outras rotas públicas do sistema).
 */
export const Route = createFileRoute("/api/public/shipping/calculate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = enforceRateLimit({
          route: "shipping:calculate-legacy",
          max: 20,
          windowMs: 60_000,
        });
        if (limited) return limited;

        try {
          const body = (await request.json()) as ShippingCalculatorInput;
          const result = await calculateSuperfreteShipping(body);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error: any) {
          console.error("[SHIPPING_CALCULATE] Erro:", error);
          return new Response(
            JSON.stringify({ error: error?.message || "Erro interno na cotação" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
