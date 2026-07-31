/**
 * EventFilter — utilitário puro para filtrar `NexosEvent[]`.
 * Sem I/O, sem estado — usado por hooks/UI e pelo Registry.
 */
import type { NexosEvent, NexosEventFilter } from "./types";

function asArray<T>(v: T | T[] | undefined): T[] | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v : [v];
}

export function matchesFilter(evt: NexosEvent, f: NexosEventFilter): boolean {
  if (f.companyId && evt.companyId !== f.companyId) return false;
  if (f.userId !== undefined && evt.userId !== f.userId) return false;
  if (f.module && evt.module !== f.module) return false;
  const types = asArray(f.type);
  if (types && !types.includes(evt.type)) return false;
  const priorities = asArray(f.priority);
  if (priorities && !priorities.includes(evt.priority)) return false;
  const statuses = asArray(f.status);
  if (statuses && evt.status && !statuses.includes(evt.status)) return false;
  if (f.since && new Date(evt.createdAt).getTime() < new Date(f.since).getTime()) return false;
  return true;
}

export function applyFilter(events: NexosEvent[], f: NexosEventFilter): NexosEvent[] {
  const filtered = events.filter((e) => matchesFilter(e, f));
  return typeof f.limit === "number" ? filtered.slice(0, f.limit) : filtered;
}
