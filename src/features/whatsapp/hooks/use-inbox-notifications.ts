import { useCallback, useEffect, useState } from "react";
2: import { toast } from "sonner";
3: 
4: /**
5:  * Hook para gerenciar notificações nativas do navegador.
6:  */
7: export function useBrowserNotifications() {
8:   const [permission, setPermission] = useState<NotificationPermission>(
9:     typeof Notification !== "undefined" ? Notification.permission : "default"
10:   );
11: 
12:   const requestPermission = useCallback(async () => {
13:     if (typeof Notification === "undefined") return "denied";
14:     const result = await Notification.requestPermission();
15:     setPermission(result);
16:     return result;
17:   }, []);
18: 
19:   const notify = useCallback((title: string, options?: NotificationOptions) => {
20:     if (typeof Notification === "undefined" || Notification.permission !== "granted") {
21:       return;
22:     }
23: 
24:     try {
25:       // Evita duplicidade visual se a aba estiver em foco
26:       if (document.visibilityState === "visible") {
27:         return;
28:       }
29: 
30:       new Notification(title, {
31:         icon: "/favicon.ico",
32:         badge: "/favicon.ico",
33:         ...options,
34:       });
35:     } catch (e) {
36:       console.error("[Notification] Erro ao disparar notificação nativa:", e);
37:     }
38:   }, []);
39: 
40:   return {
41:     permission,
42:     requestPermission,
43:     notify,
44:     isSupported: typeof Notification !== "undefined"
45:   };
46: }
