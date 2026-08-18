import { createServerFn } from "@tanstack/react-start";
import { ShippingCalculatorSchema, ShippingOption, GenerateLabelSchema, LabelResult } from "../types";
import { generateSuperfreteLabel } from "../lib/generate-superfrete-label";
import { calculateSuperfreteShipping, type ShippingCalculationResult } from "../lib/calculate-superfrete-shipping";

export const calculateShipping = createServerFn({ method: "POST" })
  .validator((data: unknown) => ShippingCalculatorSchema.parse(data))
  .handler(async ({ data }): Promise<ShippingCalculationResult> => {
    // FIX (2026-08-18): antes fazia um fetch HTTP da própria aplicação
    // pra ela mesma — mesmo motivo/correção documentado em
    // `generate-superfrete-label.ts`. Chama a lógica direto agora.
    try {
      return await calculateSuperfreteShipping(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao calcular frete";
      console.error("[calculateShipping] Erro ao calcular frete:", error);
      throw new Error(message);
    }
  });


export const generateLabel = createServerFn({ method: "POST" })
  .validator((data: unknown) => GenerateLabelSchema.parse(data))
  .handler(async ({ data }) => {
    // FIX (2026-08-18): antes fazia um fetch HTTP da própria aplicação
    // pra ela mesma (`/api/public/shipping/labels`), resolvendo a URL
    // com uma lógica pensada pro NAVEGADOR (`typeof window !==
    // "undefined"`) — mas esta é uma server function, que SEMPRE roda
    // no servidor, onde `window` nunca existe. O fetch sempre caía num
    // fallback frágil, e qualquer falha de rede nessa auto-chamada
    // virava um "Internal Server Error" genérico, escondendo o erro
    // real do Superfrete. Agora chama a lógica direto, sem HTTP no meio.
    try {
      return await generateSuperfreteLabel(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao emitir etiqueta";
      console.error("[generateLabel] Erro ao gerar etiqueta:", error);
      throw new Error(message);
    }
  });

