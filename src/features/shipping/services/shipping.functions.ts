import { createServerFn } from "@tanstack/react-start";
import { ShippingCalculatorSchema, ShippingOption, GenerateLabelSchema, LabelResult } from "../types";
import { generateSuperfreteLabel } from "../lib/generate-superfrete-label";

export const calculateShipping = createServerFn({ method: "POST" })
  .validator((data: unknown) => ShippingCalculatorSchema.parse(data))
  .handler(async ({ data }) => {
    let origin = "";
    if (typeof window !== "undefined") {
      origin = window.location.origin;
    } else {
      const vercelUrl = process.env.VERCEL_URL;
      if (vercelUrl) {
        origin = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
      } else {
        origin = process.env.NODE_ENV === 'production' 
          ? 'https://nexos.nexxcode.com.br' 
          : 'http://localhost:8080';
      }
    }

    const response = await fetch(`${origin}/api/public/shipping/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Erro ao calcular frete");
    }

    return (await response.json()) as ShippingOption[];
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

