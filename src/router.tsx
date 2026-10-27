import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RoutePending } from "@/components/layout/route-pending";
import { installNavTelemetry } from "@/lib/nav-telemetry";
import { installChunkRecovery } from "@/lib/chunk-recovery";
import { installImageVariantFallback } from "@/lib/image-variant-fallback";

export const getRouter = () => {
  // Defaults evitam refetch em toda navegação. Sem staleTime,
  // useSuspenseQuery re-suspende ao trocar de rota e a Suspense interna
  // do <Outlet /> mostra um fallback vazio (flash branco/escuro).
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: false,
    defaultPreloadDelay: 50,
    // Query owns freshness; router não invalida preloads.
    defaultPreloadStaleTime: 0,
    // Mantém a rota atual visível enquanto a próxima carrega — sem tela em branco.
    defaultPendingMs: 1500,
    defaultPendingMinMs: 0,
    // Skeleton mínimo (renderizado dentro do <main>) para rotas que ultrapassam
    // defaultPendingMs. Substitui qualquer fallback vazio/branco.
    defaultPendingComponent: RoutePending,
  });

  // Telemetria de navegação — mede tempo até resolver e detecta fallback.
  if (typeof window !== "undefined") {
    installNavTelemetry(router);

    // Sistema aberto antes de um Publish: ao trocar de menu, a tela nova
    // não existe mais com o nome antigo. Recarrega direto no destino.
    let pendingHref: string | undefined;
    router.subscribe("onBeforeLoad", (ev) => {
      pendingHref = ev?.toLocation?.href
        ? `${window.location.origin}${ev.toLocation.href}`
        : undefined;
    });
    router.subscribe("onResolved", () => {
      pendingHref = undefined;
    });
    installChunkRecovery(() => pendingHref);
    installImageVariantFallback();
  }

  return router;
};
