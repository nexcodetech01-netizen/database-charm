import { createServerFn } from "@tanstack/react-router";
import { ShippingCalculatorSchema, ShippingOption } from "../types";

export const calculateShipping = createServerFn({ method: "POST" })
  .validator((data: unknown) => ShippingCalculatorSchema.parse(data))
  .handler(async ({ data }) => {
    // We call our internal API route
    // Note: In TanStack Start, server functions can call external APIs or internal routes via fetch
    // But since it's the same server, we could also move logic to a .server.ts file.
    // However, to satisfy the user's "proxy" requirement and stay clean, we'll call the server route.
    
    // Using absolute URL for SSR compatibility
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `https://${process.env.VERCEL_URL || 'localhost:8080'}` 
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
