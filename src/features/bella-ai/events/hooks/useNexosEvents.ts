import { useEffect, useMemo, useState } from "react";
import { NexosEventEngine } from "../EventEngine";
import { computeEventMetrics } from "../EventMetrics";
import type { NexosEvent, NexosEventFilter } from "../types";

/**
 * useNexosEvents — assina o buffer in-memory do EventEngine e devolve
 * a lista já filtrada. Zero fetch, zero polling.
 */
export function useNexosEvents(filter: NexosEventFilter = {}): NexosEvent[] {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    return NexosEventEngine.subscribe(() => setTick((t) => t + 1));
  }, []);
  return useMemo(() => {
    void tick;
    return NexosEventEngine.list(filter);
  }, [tick, filter]);
}

export function useNexosEventMetrics(filter: NexosEventFilter = {}) {
  const events = useNexosEvents(filter);
  const [snap, setSnap] = useState(() => NexosEventEngine.snapshot());
  useEffect(() => {
    const id = setInterval(() => setSnap(NexosEventEngine.snapshot()), 3000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => computeEventMetrics(events, snap.queued), [events, snap.queued]);
}
