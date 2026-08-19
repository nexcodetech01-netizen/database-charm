import { createServerFn } from "@tanstack/react-start";
import {
  getRequestHost,
  getRequestProtocol,
} from "@tanstack/react-start/server";
import { z } from "zod";
import type { PublicProductDetail } from "@/features/catalog/types";
import { loadProductPagePayload } from "@/features/catalog/lib/load-product-page.server";

const inputSchema = z.object({
  slug: z.string(),
  productId: z.string(),
  preview: z.boolean().optional().default(false),
});

export type PublicProductLoaderResult = {
  product: PublicProductDetail | null;
  origin: string;
};

export const loadPublicProduct = createServerFn({ method: "GET" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<PublicProductLoaderResult> => {
    const proto = getRequestProtocol({ xForwardedProto: true });
    const host = getRequestHost({ xForwardedHost: true });
    const origin = `${proto}://${host}`;

    try {
      // Chama a lógica direto (mesmo processo), sem fazer HTTP pra si
      // mesmo — mesma correção aplicada na SuperFrete em 2026-08-18 e no
      // loadPublicCollection.
      const result = await loadProductPagePayload({
        slug: data.slug,
        productId: data.productId,
        isPreview: data.preview,
      });
      if (!result.ok) return { product: null, origin };
      return { product: result.payload as unknown as PublicProductDetail, origin };
    } catch {
      return { product: null, origin };
    }
  });
