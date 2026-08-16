import { useCallback, useEffect, useState, useRef, useMemo } from "react";

/**
 * Hook para gerenciar notificações nativas do navegador com Throttling e Histórico.
 */
export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [history, setHistory] = useState<{ id: string; title: string; body: string; at: number; ticketId?: string; type?: string; read?: boolean }[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("nexos:notification-history");
    return saved ? JSON.parse(saved) : [];
  });
  
  const lastNotifyTimeRef = useRef<number>(0);
  const pendingNotificationsRef = useRef<Map<string, { title: string; options?: NotificationOptions }>>(new Map());
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estados de filtros e paginação
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRead, setFilterRead] = useState<boolean | "all">("all");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;


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
      const type = (options as any)?.type || "unknown";

      setHistory(prev => {
        const newItem = {
          id: Math.random().toString(36).substr(2, 9),
          title,
          body: options?.body || "",
          at: Date.now(),
          ticketId,
          type,
          read: false
        };
        const newHistory = [newItem, ...prev].slice(0, 200); // Aumentado para 200
        return newHistory;
      });

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

  const markAsRead = useCallback((id: string) => {
    setHistory(prev => prev.map(item => item.id === id ? { ...item, read: true } : item));
  }, []);

  const markAllAsRead = useCallback(() => {
    setHistory(prev => prev.map(item => ({ ...item, read: true })));
  }, []);

  // Lógica de filtragem e paginação calculada via useMemo
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const typeMatch = filterType === "all" || item.type === filterType;
      const readMatch = filterRead === "all" || item.read === filterRead;
      return typeMatch && readMatch;
    });
  }, [history, filterType, filterRead]);

  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredHistory.slice(start, start + itemsPerPage);
  }, [filteredHistory, page]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  return {
    permission,
    requestPermission,
    notify,
    history: paginatedHistory,
    fullHistoryCount: history.length,
    filteredCount: filteredHistory.length,
    clearHistory,
    markAsRead,
    markAllAsRead,
    filterType,
    setFilterType,
    filterRead,
    setFilterRead,
    page,
    setPage,
    totalPages,
    isSupported: typeof Notification !== "undefined"
  };
}


