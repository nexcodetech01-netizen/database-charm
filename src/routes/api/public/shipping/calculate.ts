import { createFileRoute } from "@tanstack/react-router";
import { calculateSuperfreteShipping } from "@/features/shipping/lib/calculate-superfrete-shipping";
import type { ShippingCalculatorInput } from "@/features/shipping/types";

/**
 * Rota pública mantida por compatibilidade (ex.: chamadas externas
 * diretas). A tela do NexOS usa a server function `calculateShipping`
 * (features/shipping/services/shipping.functions.ts), que chama
 * `calculateSuperfreteShipping` diretamente — sem passar por aqui —
 * desde a correção de 2026-08-18.
 */
export const Route = createFileRoute("/api/public/shipping/calculate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
