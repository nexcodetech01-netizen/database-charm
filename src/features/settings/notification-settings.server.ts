import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

export type NotificationPreference = {
  sound: boolean;
  browser: boolean;
};

export type NotificationSettings = Record<string, NotificationPreference>;

export async function getNotificationSettings(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("notification_settings")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("[Settings] Erro ao buscar configurações:", error);
    return null;
  }

  return data?.notification_settings as NotificationSettings;
}

export async function updateNotificationSettings(
  supabase: SupabaseClient<Database>,
  userId: string,
  settings: NotificationSettings
) {
  const { error } = await supabase
    .from("profiles")
    .update({ notification_settings: settings })
    .eq("id", userId);

  if (error) {
    console.error("[Settings] Erro ao atualizar configurações:", error);
    throw error;
  }

  return { success: true };
}
