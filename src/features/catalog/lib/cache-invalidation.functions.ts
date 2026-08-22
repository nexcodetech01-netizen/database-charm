import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const invalidateCatalogCache = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ slug: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    // In a real CDN environment (like Cloudflare), we would call a Purge API here.
    // In our current TanStack Start + Supabase environment, we rely on 
    // Cache-Control headers and client-side invalidation.
    // By returning success, we allow the client to trigger a refetch.
    
    console.log(`[CatalogCache] Invalidation requested for slug: ${data.slug || 'all'}`);
    
    return { success: true, timestamp: new Date().toISOString() };
  });
