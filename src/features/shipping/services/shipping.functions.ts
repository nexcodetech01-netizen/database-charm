import { createServerFn } from "@tanstack/react-start";
import { ShippingCalculatorSchema, ShippingOption, GenerateLabelSchema, LabelResult } from "../types";

export const calculateShipping = createServerFn({ method: "POST" })
  .validator((data: unknown) => ShippingCalculatorSchema.parse(data))
  .handler(async ({ data }) => {
    // We call our internal API route
    // Note: In TanStack Start, server functions can call external APIs or internal routes via fetch
    
    // Using absolute URL for SSR compatibility
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `https://${process.env.VERCEL_URL || 'nexos.nexxcode.com.br'}` 
      : 'http://localhost:8080';

    const response = await fetch(`${baseUrl}/api/public/shipping/calculate`, {
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
    // Determine the correct base URL based on the current context (SSR vs Client)
    let origin = "";
    if (typeof window !== "undefined") {
      origin = window.location.origin;
    } else {
      // Server-side: use environment variables or fallback
      // In production, VERCEL_URL is often not prefixed with https://
      const vercelUrl = process.env.VERCEL_URL;
      if (vercelUrl) {
        origin = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
      } else {
        // Fallback for different environments
        origin = process.env.NODE_ENV === 'production' 
          ? 'https://nexos.nexxcode.com.br' 
          : 'http://localhost:8080';
      }
    }

    console.log(`[generateLabel] Chamando API em: ${origin}/api/public/shipping/labels`);

    const response = await fetch(`${origin}/api/public/shipping/labels`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let errorMessage = "Erro ao emitir etiqueta";
      let errorDetail = "";
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        errorDetail = errorData.stack || JSON.stringify(errorData);
        console.error(`[generateLabel] Erro da API (${response.status}):`, errorData);
      } catch (e) {
        const text = await response.text();
        console.error(`[generateLabel] Erro da API (${response.status}) e falha no parse JSON. Resposta:`, text);
        errorDetail = text;
      }
      
      const error = new Error(errorMessage);
      (error as any).details = errorDetail;
      throw error;
    }

    return (await response.json()) as LabelResult;
  });

