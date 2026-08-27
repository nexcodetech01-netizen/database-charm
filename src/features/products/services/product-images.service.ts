import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-images";

export const productImagesService = {
  bucket: BUCKET,

  async upload(companyId: string, productId: string, file: File) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${companyId}/${productId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, cacheControl: "3600" });
    if (error) throw error;
    return path;
  },

  async createRecord(companyId: string, productId: string, path: string, position: number) {
    const { data, error } = await supabase
      .from("product_images")
      .insert({ company_id: companyId, product_id: productId, path, position })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateFraming(
    id: string,
    framing: { focal_x: number; focal_y: number; zoom: number },
  ) {
    const { data, error } = await supabase
      .from("product_images")
      .update({
        focal_x: framing.focal_x,
        focal_y: framing.focal_y,
        zoom: framing.zoom,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },


  async list(productId: string) {
    const { data, error } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("position");
    if (error) throw error;
    return data ?? [];
  },

  async remove(id: string, path: string) {
    await supabase.storage.from(BUCKET).remove([path]);
    const { error } = await supabase.from("product_images").delete().eq("id", id);
    if (error) throw error;
  },

  async signedUrl(path: string, expiresIn = 3600, width?: number): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error) throw error;
    return width ? withImageTransform(data.signedUrl, width) : data.signedUrl;
  },

  /**
   * Assina URLs em lote. Quando `width` é informado, a URL aponta para o
   * endpoint de transformação do Storage (redimensionamento + WebP automático
   * conforme o Accept do navegador) — reduz drasticamente o egress em listagens.
   */
  async signedUrls(
    paths: string[],
    expiresIn = 3600,
    width?: number,
  ): Promise<{ path: string; signedUrl: string }[]> {
    if (paths.length === 0) return [];
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, expiresIn);
    if (error) throw error;
    return (data ?? [])
      .filter((d) => d.signedUrl)
      .map((d) => ({
        path: d.path ?? "",
        signedUrl: width
          ? withImageTransform(d.signedUrl as string, width)
          : (d.signedUrl as string),
      }));
  },
};
