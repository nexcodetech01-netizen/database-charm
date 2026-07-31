/**
 * Metrics Recorder — contadores/timings em memória.
 * Consumidores externos (dashboards) leem via `bella_executions`;
 * este módulo cobre observabilidade in-process (debug/dev).
 */

export interface MetricSample {
  name: string;
  value: number;
  tags?: Record<string, string | number | boolean>;
  ts: number;
}

const BUFFER: MetricSample[] = [];
const MAX_BUFFER = 500;

function push(sample: MetricSample) {
  BUFFER.push(sample);
  if (BUFFER.length > MAX_BUFFER) BUFFER.splice(0, BUFFER.length - MAX_BUFFER);
}

export const metrics = {
  counter(name: string, tags?: MetricSample["tags"], value = 1): void {
    push({ name, value, tags, ts: Date.now() });
  },
  timing(name: string, ms: number, tags?: MetricSample["tags"]): void {
    push({ name, value: ms, tags, ts: Date.now() });
  },
  snapshot(): MetricSample[] {
    return BUFFER.slice(-100);
  },
  reset(): void {
    BUFFER.length = 0;
  },
};

export type Metrics = typeof metrics;
