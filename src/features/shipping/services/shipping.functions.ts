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

    console.log("FUNCTIONS_DEBUG: Calling endpoint with data:", JSON.stringify(data));
    const response = await fetch(`${baseUrl}/api/public/shipping/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    console.log("FUNCTIONS_DEBUG: Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("FUNCTIONS_DEBUG: Error response body:", errorText);
      let errorData = {};
      try { errorData = JSON.parse(errorText); } catch(e) {}
      throw new Error((errorData as any).error || "Erro ao calcular frete");
    }

    const result = await response.json();
    console.log("FUNCTIONS_DEBUG: Success result:", result);
    return result as ShippingOption[];
  });

export const generateLabel = createServerFn({ method: "POST" })
  .validator((data: unknown) => GenerateLabelSchema.parse(data))
  .handler(async ({ data }) => {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `https://${process.env.VERCEL_URL || 'nexos.nexxcode.com.br'}` 
      : 'http://localhost:8080';

    const response = await fetch(`${baseUrl}/api/public/shipping/labels`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Erro ao emitir etiqueta");
    }

    return (await response.json()) as LabelResult;
  });
