import { supabase } from "@/integrations/supabase/client";

// Reutiliza o bucket já existente do projeto — não cria bucket paralelo.
const BUCKET = "product-images";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 dias

function extOf(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["png", "jpg", "jpeg", "webp"].includes(fromName)) return fromName;
  const t = file.type;
  if (t === "image/png") return "png";
  if (t === "image/jpeg") return "jpg";
  if (t === "image/webp") return "webp";
  return "png";
}

export const companyBrandingService = {
  bucket: BUCKET,

  async uploadLogo(companyId: string, file: File): Promise<string> {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("Logo deve ter no máximo 2 MB.");
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      throw new Error("Formato inválido. Envie PNG, JPG ou WEBP.");
    }
    const path = `${companyId}/_brand/logo-${Date.now()}.${extOf(file)}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, cacheControl: "3600", contentType: file.type });
    if (error) throw error;
    return path;
  },

  async removeLogo(path: string): Promise<void> {
    if (!path) return;
    await supabase.storage.from(BUCKET).remove([path]);
  },

  async signedLogoUrl(path: string | null | undefined): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (error) return null;
    return data?.signedUrl ?? null;
  },
};
