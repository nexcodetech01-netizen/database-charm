/**
 * Deixa a foto leve antes de enviar (lado maior até 1600 px, WebP).
 * Foto do celular/ChatGPT costuma ter 3–8 MB; depois disso fica em ~200–500 KB.
 * Se o navegador não conseguir comprimir, devolve a original.
 */
const MAX_SIDE = 1600;

/** Limite da foto ORIGINAL que a pessoa escolhe (antes de comprimir). */
export const MAX_ORIGINAL_MB = 25;

export async function compressPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.86),
    );
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.webp`, { type: "image/webp", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
