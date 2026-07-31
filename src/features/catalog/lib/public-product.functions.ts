import { createServerFn } from "@tanstack/react-start";
import {
  getRequestHeader,
  getRequestHost,
  getRequestProtocol,
} from "@tanstack/react-start/server";
import { z } from "zod";
import type { PublicProductDetail } from "@/features/catalog/types";

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
    const qs = data.preview ? "?preview=1" : "";
    const url = `${origin}/api/public/catalog/${encodeURIComponent(
      data.slug,
    )}/product/${encodeURIComponent(data.productId)}${qs}`;

    const headers: Record<string, string> = {};
    if (data.preview) {
      const auth = safeHeader("authorization");
      if (auth) headers.authorization = auth;
    }

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) return { product: null, origin };
      const product = (await res.json()) as PublicProductDetail;
      return { product, origin };
    } catch {
      return { product: null, origin };
    }
  });

function safeHeader(name: string): string | null {
  try {
    return getRequestHeader(name) ?? null;
  } catch {
    return null;
  }
}
