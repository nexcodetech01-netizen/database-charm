import { useEffect, useMemo, useState } from "react";
import { NexosEventEngine } from "../EventEngine";
import { computeEventMetrics } from "../EventMetrics";
import type { NexosEvent, NexosEventFilter } from "../types";

const EMPTY_FILTER: NexosEventFilter = {};

/**
 * useNexosEvents — assina o buffer in-memory do EventEngine e devolve
 * a lista já filtrada. Zero fetch, zero polling.
 */
export function useNexosEvents(filter: NexosEventFilter = EMPTY_FILTER): NexosEvent[] {
  const [version, setVersion] = useState(0);
  useEffect(() => NexosEventEngine.subscribe(() => setVersion((v) => v + 1)), []);

  // Chave por valor: filtros passados inline ({ companyId, limit }) são
  // objetos novos a cada render e, como dependência direta, refaziam a
  // filtragem em todo render.
  const filterKey = JSON.stringify(filter);
  return useMemo(
    () => NexosEventEngine.list(filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, filterKey],
  );
}

export function useNexosEventMetrics(filter: NexosEventFilter = EMPTY_FILTER) {
  const events = useNexosEvents(filter);
  const [queued, setQueued] = useState(() => NexosEventEngine.snapshot().queued);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      // Número primitivo: se não mudou, o React descarta o re-render.
      // Antes, um objeto novo a cada 3s forçava re-render do painel.
      setQueued(NexosEventEngine.snapshot().queued);
    }, 3_000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => computeEventMetrics(events, queued), [events, queued]);
}
