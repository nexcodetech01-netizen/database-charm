import { useCallback, useEffect, useState, useRef } from "react";

/**
 * Hook para gerenciar notificações nativas do navegador com Throttling e Histórico.
 */
export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [history, setHistory] = useState<{ id: string; title: string; body: string; at: number; ticketId?: string }[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("nexos:notification-history");
    return saved ? JSON.parse(saved) : [];
  });
  
  const lastNotifyTimeRef = useRef<number>(0);
  const pendingNotificationsRef = useRef<Map<string, { title: string; options?: NotificationOptions }>>(new Map());
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nexos:notification-history", JSON.stringify(history.slice(0, 50)));
    }
  }, [history]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const showNativeNotification = useCallback((title: string, options?: NotificationOptions) => {
    try {
      if (document.visibilityState === "visible") return;

      const n = new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      });

      // Adiciona ao histórico
      const ticketId = (options as any)?.tag || (options as any)?.ticketId;
      setHistory(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        title,
        body: options?.body || "",
        at: Date.now(),
        ticketId
      }, ...prev].slice(0, 50));

      return n;
    } catch (e) {
      console.error("[Notification] Erro ao disparar notificação nativa:", e);
    }
  }, []);

  const notify = useCallback((title: string, options?: NotificationOptions) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }

    const now = Date.now();
    const throttleMs = 3000; // 3 segundos de throttling

    // Se o último disparo foi recente, agrupa
    if (now - lastNotifyTimeRef.current < throttleMs) {
      const key = (options as any)?.tag || title;
      pendingNotificationsRef.current.set(key, { title, options });

      if (!throttleTimerRef.current) {
        throttleTimerRef.current = setTimeout(() => {
          const pending = Array.from(pendingNotificationsRef.current.values());
          pendingNotificationsRef.current.clear();
          throttleTimerRef.current = null;

          if (pending.length === 1) {
            showNativeNotification(pending[0].title, pending[0].options);
          } else if (pending.length > 1) {
            showNativeNotification(`${pending.length} novos pedidos`, {
              body: "Vários clientes enviaram novos pedidos agora.",
              tag: "grouped-notifications"
            });
          }
          lastNotifyTimeRef.current = Date.now();
        }, throttleMs);
      }
      return;
    }

    lastNotifyTimeRef.current = now;
    showNativeNotification(title, options);
  }, [showNativeNotification]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    permission,
    requestPermission,
    notify,
    history,
    clearHistory,
    isSupported: typeof Notification !== "undefined"
  };
}
