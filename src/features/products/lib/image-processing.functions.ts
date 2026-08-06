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
    console.log(`[AI Image Processor] Processing ${data.images.length} images (Multiview: ${!!data.enableMultiview})...`);
    
    // Simula latência de IA (Remoção de fundo + Upscaling + Otimização de Cores)
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const processed = data.images.map((img) => {
      // Mock de URL processada: adicionamos um parâmetro para simular uma imagem nova/tratada
      // Na vida real, o worker retornaria uma URL de bucket ou CDN com o fundo removido.
      const processedUrl = img.url.includes('?') 
        ? `${img.url}&processed=true&bg=white` 
        : `${img.url}?processed=true&bg=white`;

      return {
        ...img,
        processedUrl,
        status: "success" as const,
        appliedEffect: img.isMain ? "pure_white_background" : "neutral_studio_setting",
        upscaled: true,
        colorOptimized: true,
      };
    });

    // Geração Automática de Ângulos (Multiview Generation)
    // Se tivermos apenas 1 imagem e for a principal, geramos variações para preencher slots 2, 3 e 4.
    if (data.enableMultiview && data.images.length === 1 && data.images[0].isMain) {
      const mainImg = data.images[0];
      const variations = ["perspective_left", "perspective_right", "close_up"].map((angle, idx) => ({
        id: `gen_${mainImg.id}_${idx}`,
        url: mainImg.url, // Referência à imagem base
        processedUrl: `${mainImg.url}${mainImg.url.includes('?') ? '&' : '?'}angle=${angle}&bg=white`, // Simulação da variação gerada
        isMain: false,
        status: "success" as const,
        appliedEffect: "neutral_studio_setting",
        isGenerated: true,
        angle,
        upscaled: true,
        colorOptimized: true,
      }));
      processed.push(...variations);
    }

    return {
      success: true,
      processedImages: processed,
    };
  });
