import { useCallback, useEffect, useState } from "react";

/**
 * Hook para gerenciar notificações nativas do navegador.
 */
export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const notify = useCallback((title: string, options?: NotificationOptions) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }

    try {
      // Evita duplicidade visual se a aba estiver em foco
      if (document.visibilityState === "visible") {
        return;
      }

      new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      });
    } catch (e) {
      console.error("[Notification] Erro ao disparar notificação nativa:", e);
    }
  }, []);

  return {
    permission,
    requestPermission,
    notify,
    isSupported: typeof Notification !== "undefined"
  };
}
