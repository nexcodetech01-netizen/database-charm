import { useEffect, useState, useMemo } from "react";
import { bellaEventRegistry } from "../events";
import {
  buildDashboardSnapshot,
  type BellaDashboardSnapshot,
} from "../dashboard";

/**
 * Hook React que expõe o snapshot da Home da Bella.
 *
 * - Escuta o `BellaEventRegistry` e recomputa quando o estado muda.
 * - Toda derivação vem da camada de eventos — sem chamadas a services.
 * - Memoiza por `tenantId` e um contador de versão do registry.
 */
export function useBellaHomeSnapshot(tenantId: string): BellaDashboardSnapshot {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    bellaEventRegistry.start();
    const unsubscribe = bellaEventRegistry.subscribe(() => {
      setVersion((v) => v + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return useMemo(
    () => buildDashboardSnapshot({ tenantId }),
    // `version` invalida quando o registry muda; `tenantId` isola o snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantId, version],
  );
}
