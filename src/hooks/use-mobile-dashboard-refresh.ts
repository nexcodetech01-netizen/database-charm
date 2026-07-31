import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Força refetch das queries críticas do Dashboard em dispositivos mobile / PWA
 * para evitar exibição de cache stale quando o app é reaberto a partir do ícone
 * na home screen (iOS/Android costumam manter o processo suspenso por horas).
 *
 * - Ao montar (uma vez), invalida em modo "active" para os keys informados.
 * - Ao voltar à aba (visibilitychange -> visible) e ao ganhar foco, invalida
 *   novamente. Ambos os eventos disparam em PWA standalone.
 * - Só executa em viewports < 768px (breakpoint md do design system) para não
 *   duplicar trabalho no desktop, onde já há preload/SWR do router.
 */
export function useMobileDashboardRefresh(keys: readonly (readonly unknown[])[]) {
  const qc = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;

    const refetchAll = () => {
      for (const key of keys) {
        qc.invalidateQueries({ queryKey: key as unknown[], refetchType: "active" });
      }
    };

    // 1) montagem
    refetchAll();

    // 2) volta ao primeiro plano
    const onVisibility = () => {
      if (document.visibilityState === "visible") refetchAll();
    };
    const onFocus = () => refetchAll();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
    // keys é estático por rota; qc é estável.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
