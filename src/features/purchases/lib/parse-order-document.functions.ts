/**
 * Extração de itens de pedido a partir de PDF ou imagem via Lovable AI Gateway.
 * Ignora o SKU do fornecedor — retorna apenas descrição, cor, quantidade e
 * preço unitário. O SKU interno é gerado no cliente com generateNextSku.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type FileKind = "pdf" | "image";

interface Input {
  kind: FileKind;
  /** Data URL: `data:<mime>;base64,<payload>`. */
  dataUrl: string;
  filename?: string;
}

const ItemSchema = z.object({
  description: z.string(),
  color: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
});
const OutputSchema = z.object({ items: z.array(ItemSchema) });

export type ParsedOrderItem = z.infer<typeof ItemSchema>;

export const parseOrderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    const kind = input?.kind === "image" ? "image" : "pdf";
    const dataUrl = String(input?.dataUrl ?? "");
    if (!dataUrl.startsWith("data:"))
      throw new Error("Arquivo inválido — envie um data URL base64.");
    return {
      kind,
      dataUrl,
      filename: input.filename?.toString().slice(0, 120) || "pedido",
    } as Input;
  })
  .handler(async ({ data }): Promise<{ items: ParsedOrderItem[]; error?: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey)
      return { items: [], error: "Serviço de leitura por IA não está configurado." };

    const system = [
      "Você extrai itens de pedidos de compra a partir de PDFs, imagens ou notas.",
      "Regras estritas:",
      "- IGNORE totalmente qualquer SKU/código do fornecedor (ex.: 'SKU: kmavibg', 'REF 123').",
      "- Para cada item retorne APENAS: description (nome do produto), color (cor/variação, string vazia se não houver), quantity (número), unit_price (preço unitário em reais como número, sem 'R$').",
      "- Se o documento listar variações de cor por linha, gere uma linha por cor.",
      "- Números em português: converta '1.299,90' para 1299.90.",
      "- Se um valor não estiver presente, use 0 para números e string vazia para textos.",
      "- Não invente itens. Não retorne totais, frete ou impostos como itens.",
      "Devolva SOMENTE JSON no formato { items: [...] }.",
    ].join("\n");

    const match = /^data:([^;]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) return { items: [], error: "Arquivo inválido — não foi possível ler o conteúdo." };
    const mediaType = match[1];
    const base64 = match[2];

    const userContent =
      data.kind === "pdf"
        ? [
            { type: "text" as const, text: "Extraia os itens deste pedido:" },
            {
              type: "file" as const,
              mediaType,
              data: base64,
              filename: data.filename ?? "pedido.pdf",
            },
          ]
        : [
            { type: "text" as const, text: "Extraia os itens desta imagem de pedido:" },
            { type: "image" as const, image: data.dataUrl },
          ];

    // Timeout de servidor: nunca deixa a requisição pendurada sem resposta.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);

    try {
      const gateway = createLovableAiGatewayProvider(apiKey);
      const model = gateway("google/gemini-2.5-flash");
      const { output } = await generateText({
        model,
        system,
        messages: [{ role: "user", content: userContent }],
        temperature: 0.1,
        output: Output.object({ schema: OutputSchema }),
        abortSignal: controller.signal,
      });
      return { items: sanitize(output.items) };
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        try {
          const parsed = JSON.parse(err.text ?? "{}");
          if (parsed?.items && Array.isArray(parsed.items))
            return { items: sanitize(parsed.items) };
        } catch {
          /* ignore */
        }
      }
      console.error("[parseOrderDocument] falha na leitura por IA", err);
      const aborted =
        controller.signal.aborted ||
        (err instanceof Error && /abort|timeout/i.test(err.name + err.message));
      return {
        items: [],
        error: aborted
          ? "A leitura demorou demais e foi cancelada. Tente uma imagem menor ou mais nítida."
          : "Não foi possível ler o arquivo agora. Tente novamente em instantes.",
      };
    } finally {
      clearTimeout(timer);
    }
  });

/** Timeout do lado servidor (menor que o do cliente, para responder JSON válido). */
const SERVER_TIMEOUT_MS = 45_000;


function sanitize(items: unknown[]): ParsedOrderItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        description: String(r?.description ?? "").trim().slice(0, 200),
        color: String(r?.color ?? "").trim().slice(0, 60),
        quantity: toNumber(r?.quantity) || 1,
        unit_price: Math.max(0, toNumber(r?.unit_price)),
      };
    })
    .filter((it) => it.description.length > 0);
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const clean = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(clean);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
