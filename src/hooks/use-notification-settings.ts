import { useAuth } from "@/providers/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type NotificationPreference = {
  sound: boolean;
  browser: boolean;
};

export type NotificationSettings = Record<string, NotificationPreference>;

export const DEFAULT_SETTINGS: NotificationSettings = {
  "catalog.order.received": { sound: true, browser: true },
  "sale.created": { sound: false, browser: true },
  "finance.invoice.overdue": { sound: true, browser: true },
  "inventory.min_stock_reached": { sound: false, browser: true },
};

export function useNotificationSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings = DEFAULT_SETTINGS, isLoading } = useQuery({
    queryKey: ["notification-settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return DEFAULT_SETTINGS;

      const { data, error } = await supabase
        .from("profiles")
        .select("notification_settings")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Erro ao buscar configurações de notificação:", error);
        return DEFAULT_SETTINGS;
      }

      return (data?.notification_settings as NotificationSettings) || DEFAULT_SETTINGS;
    },
    enabled: !!user?.id,
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: NotificationSettings) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("profiles")
        .update({ notification_settings: newSettings })
        .eq("id", user.id);

      if (error) throw error;
      return newSettings;
    },
    onSuccess: (newSettings) => {
      queryClient.setQueryData(["notification-settings", user?.id], newSettings);
      toast.success("Configurações atualizadas com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao atualizar configurações:", error);
      toast.error("Falha ao salvar configurações");
    },
  });

  const toggleSetting = (eventType: string, key: keyof NotificationPreference) => {
    const current = settings[eventType] || { sound: false, browser: false };
    const newSettings = {
      ...settings,
      [eventType]: {
        ...current,
        [key]: !current[key],
      },
    };
    updateSettings.mutate(newSettings);
  };

  return {
    settings,
    isLoading,
    toggleSetting,
    updateSettings: updateSettings.mutate,
    isUpdating: updateSettings.isPending,
  };
}
