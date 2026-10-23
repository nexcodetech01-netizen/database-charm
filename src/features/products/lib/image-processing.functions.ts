import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Interface para processamento de imagem por IA (Remoção de fundo, Upscaling e Geração de Ângulos)
 */
export const processProductImages = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        images: z.array(
          z.object({
            id: z.string(),
            url: z.string(),
            isMain: z.boolean(),
          }),
        ),
        enableMultiview: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    // HONESTIDADE (auditoria 2026-10-22): não existe processamento de imagem
    // por IA conectado. A versão anterior devolvia URLs de PLACEHOLDER
    // ("AI Processed Background Removed") como se fossem as fotos tratadas —
    // a tela mostrava "sucesso" e trocava a foto do produto por uma imagem
    // genérica. Até existir um provedor real, a função informa que o recurso
    // não está disponível e nunca altera as fotos.
    void data;
    return {
      success: false as const,
      message: "Tratamento de imagem por IA ainda não está disponível. A foto original foi mantida.",
      processedImages: [] as Array<{
        id: string;
        url: string;
        isMain: boolean;
        processedUrl?: string;
        status: "success";
        isGenerated?: boolean;
      }>,
    };
  });
