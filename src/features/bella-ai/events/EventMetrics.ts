/**
 * EventMetrics — agregações puras sobre `NexosEvent[]`.
 */
import type { NexosEvent, NexosEventMetrics } from "./types";

export function computeEventMetrics(events: NexosEvent[], queued = 0): NexosEventMetrics {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  let perHour = 0;
  let processed = 0;
  let failures = 0;
  let durationSum = 0;
  let durationCount = 0;

  for (const e of events) {
    const created = new Date(e.createdAt).getTime();
    if (now - created <= HOUR) perHour += 1;
    if (e.status === "success" || e.status === "skipped") processed += 1;
    if (e.status === "error") failures += 1;
    const dur = (e as unknown as { durationMs?: number }).durationMs;
    if (typeof dur === "number") {
      durationSum += dur;
      durationCount += 1;
    }
  }

  return {
    total: events.length,
    perHour,
    processed,
    failures,
    queued,
    avgDurationMs: durationCount ? Math.round(durationSum / durationCount) : 0,
  };
}
