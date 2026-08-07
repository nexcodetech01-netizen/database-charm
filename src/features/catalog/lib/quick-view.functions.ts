import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadPublicProduct } from "@/features/catalog/lib/public-product.functions";

export const getQuickViewProduct = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        slug: z.string(),
        productId: z.string(),
        preview: z.boolean().optional().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return loadPublicProduct({ data });
  });
