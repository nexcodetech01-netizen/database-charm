import { createServerFn } from "@tanstack/react-start";
import {
  getRequestHeader,
  getRequestHost,
  getRequestProtocol,
} from "@tanstack/react-start/server";
import { z } from "zod";
import type { PublicCollection } from "@/features/catalog/types";

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
    const qs = data.preview ? "?preview=1" : "";
    const url = `${origin}/api/public/catalog/${encodeURIComponent(
      data.slug,
    )}${qs}`;

    const headers: Record<string, string> = {};
    if (data.preview) {
      // Encaminha o bearer do usuário para autorizar preview de coleção agendada.
      const auth = safeHeader("authorization");
      if (auth) headers.authorization = auth;
    }

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) return { collection: null, origin };
      const collection = (await res.json()) as PublicCollection;
      return { collection, origin };
    } catch {
      return { collection: null, origin };
    }
  });

function safeHeader(name: string): string | null {
  try {
    return getRequestHeader(name) ?? null;
  } catch {
    return null;
  }
}
