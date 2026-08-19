import { createServerFn } from "@tanstack/react-start";
import {
  getRequestHost,
  getRequestProtocol,
} from "@tanstack/react-start/server";
import { z } from "zod";
import type { PublicCollection } from "@/features/catalog/types";
import { loadCollectionPagePayload } from "@/features/catalog/lib/load-collection-page.server";

const inputSchema = z.object({
  slug: z.string(),
  preview: z.boolean().optional().default(false),
});

export type PublicCollectionLoaderResult = {
  collection: PublicCollection | null;
  origin: string;
};

export const loadPublicCollection = createServerFn({ method: "GET" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<PublicCollectionLoaderResult> => {
    const proto = getRequestProtocol({ xForwardedProto: true });
    const host = getRequestHost({ xForwardedHost: true });
    const origin = `${proto}://${host}`;

    try {
      // Chama a lógica direto (mesmo processo), sem fazer HTTP pra si
      // mesmo — mesma correção aplicada na SuperFrete em 2026-08-18.
      // O preview continua exigindo o bearer do usuário, só que agora
      // resolvido dentro de `authorizePreview` via header em vez de
      // reencaminhado por uma requisição HTTP própria.
      const result = await loadCollectionPagePayload({
        slug: data.slug,
        isPreview: data.preview,
      });
      if (!result.ok) return { collection: null, origin };
      return { collection: result.payload as unknown as PublicCollection, origin };
    } catch {
      return { collection: null, origin };
    }
  });
