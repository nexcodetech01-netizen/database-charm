import { useAuth } from "@/providers/auth-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getNotificationSettingsFn, updateNotificationSettingsFn } from "@/features/settings/notification-settings.functions";

export type NotificationPreference = {
  sound: boolean;
  browser: boolean;
};

export type NotificationSettings = Record<string, NotificationPreference>;

export const DEFAULT_SETTINGS: NotificationSettings = {
  "catalog.order.received": { sound: true, browser: true },
  "whatsapp.message.received": { sound: true, browser: false },
  "sale.created": { sound: false, browser: true },
  "finance.invoice.overdue": { sound: true, browser: true },
  "inventory.min_stock_reached": { sound: false, browser: true },
};

export function useNotificationSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const getSettings = useServerFn(getNotificationSettingsFn);
  const updateSettingsFn = useServerFn(updateNotificationSettingsFn);

  const { data: settings = DEFAULT_SETTINGS, isLoading } = useQuery({
    queryKey: ["notification-settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return DEFAULT_SETTINGS;

      try {
        const dbSettings = await getSettings();
        if (!dbSettings) return DEFAULT_SETTINGS;

        // Mesclagem profunda para garantir que todas as chaves do DEFAULT_SETTINGS existam
        const mergedSettings = { ...DEFAULT_SETTINGS };

        Object.keys(dbSettings).forEach((key) => {
          mergedSettings[key] = {
            ...DEFAULT_SETTINGS[key],
            ...dbSettings[key],
          };
        });

        return mergedSettings;
      } catch (error) {
        console.error("Erro ao buscar configurações de notificação:", error);
        return DEFAULT_SETTINGS;
      }
    },
    enabled: !!user?.id,
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: NotificationSettings) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      await updateSettingsFn({ data: newSettings });
      return newSettings;
    },
    onSuccess: (newSettings) => {
      queryClient.setQueryData(["notification-settings", user?.id], newSettings);
      toast.success("Configurações atualizadas");
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
