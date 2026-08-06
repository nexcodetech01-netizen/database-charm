import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-media";

export const productMediaService = {
  bucket: BUCKET,

  async uploadVideo(companyId: string, productId: string, file: File) {
    const ext = file.name.split(".").pop() || "mp4";
    const path = `${companyId}/${productId}/video-${Date.now()}.${ext}`;
    
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { 
        upsert: true, 
        cacheControl: "3600",
        contentType: file.type || "video/mp4"
      });
      
    if (error) throw error;
    
    // Obter URL pública ou assinada
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return publicUrl;
  },

  async removeVideo(path: string) {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  }
};
