/**
 * Navigation telemetry.
 *
 * Mede o tempo entre o início da navegação (`onBeforeLoad`) e o momento em
 * que a rota foi resolvida (`onResolved`) — proxy para "tempo até o conteúdo
 * aparecer". Também detecta quando um `defaultPendingComponent` é exibido,
 * o que sinaliza fallback visível e possível flash de layout.
 *
 * Sem dependências externas: emite `console.debug` + `window` events para
 * que testes E2E (e futuros dashboards) consigam observar as métricas.
 */
import type { Router } from "@tanstack/react-router";

export type NavTelemetryEvent = {
  from: string;
  to: string;
  durationMs: number;
  showedFallback: boolean;
  timestamp: number;
};

const FALLBACK_THRESHOLD_MS = 1500; // deve casar com router.defaultPendingMs

let installed = false;

export function installNavTelemetry(router: Router<any, any>): () => void {
  if (installed || typeof window === "undefined") return () => {};
  installed = true;

  let startedAt = 0;
  let fromPath = window.location.pathname;

  const offStart = router.subscribe("onBeforeLoad", () => {
    try {
      startedAt = performance.now();
    } catch (err) {
      console.error("[nav-telemetry] Error in onBeforeLoad:", err);
    }
  });

  const offEnd = router.subscribe("onResolved", () => {
    try {
      if (!startedAt) return;
      const durationMs = Math.round(performance.now() - startedAt);
      const toPath = window.location.pathname;
      const showedFallback = durationMs > FALLBACK_THRESHOLD_MS;

      const event: NavTelemetryEvent = {
        from: fromPath,
        to: toPath,
        durationMs,
        showedFallback,
        timestamp: Date.now(),
      };

      // Console visível em produção para debugging pontual — barato.
      // eslint-disable-next-line no-console
      console.debug("[nav-telemetry]", event);

      window.dispatchEvent(new CustomEvent<NavTelemetryEvent>("nexos:nav", { detail: event }));

      // Buffer para leitura em testes E2E.
      const w = window as unknown as { __nexosNav?: NavTelemetryEvent[] };
      w.__nexosNav = w.__nexosNav || [];
      w.__nexosNav.push(event);
      if (w.__nexosNav.length > 50) w.__nexosNav.shift();

      fromPath = toPath;
      startedAt = 0;
    } catch (err) {
      console.error("[nav-telemetry] Error in onResolved:", err);
      startedAt = 0;
    }
  });

  return () => {
    offStart();
    offEnd();
    installed = false;
  };
}
