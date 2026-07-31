import { supabase } from "@/integrations/supabase/client";

/**
 * File storage helpers on top of Supabase Storage.
 * Keep bucket names in feature-level constants, not here.
 */
export const storageService = {
  async upload(bucket: string, path: string, file: File, upsert = true) {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert });
    if (error) throw error;
    return data;
  },

  async remove(bucket: string, paths: string[]) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw error;
  },

  getPublicUrl(bucket: string, path: string) {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  },
};
