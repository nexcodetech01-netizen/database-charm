/**
 * Server-side sink for PWA telemetry reports. Records suspected "stuck update"
 * scenarios in server logs so the team can inspect them via
 * `server-function-logs`. Read-only: no DB writes required.
 */
import { createServerFn } from "@tanstack/react-start";

export interface PwaReportInput {
  reason: "boot-suspect" | "manual-nuke" | "post-nuke";
  hostname: string;
  displayMode: string;
  buildId: string | null;
  storedBuildId: string | null;
  userAgent?: string;
  serviceWorkers: Array<{
    scope: string;
    scriptURL: string | null;
    state: string;
  }>;
  caches: string[];
  nukeResult?: {
    serviceWorkersUnregistered: number;
    serviceWorkersFailed: number;
    cachesDeleted: string[];
    cachesFailed: string[];
    errors: string[];
  };
}

function safeParse(raw: unknown): PwaReportInput {
  const input = raw as Partial<PwaReportInput> | undefined;
  return {
    reason: (input?.reason ?? "boot-suspect") as PwaReportInput["reason"],
    hostname: String(input?.hostname ?? ""),
    displayMode: String(input?.displayMode ?? "unknown"),
    buildId: input?.buildId ?? null,
    storedBuildId: input?.storedBuildId ?? null,
    userAgent: input?.userAgent ? String(input.userAgent).slice(0, 300) : undefined,
    serviceWorkers: Array.isArray(input?.serviceWorkers)
      ? input!.serviceWorkers.slice(0, 20).map((s) => ({
          scope: String(s?.scope ?? ""),
          scriptURL: s?.scriptURL ? String(s.scriptURL) : null,
          state: String(s?.state ?? ""),
        }))
      : [],
    caches: Array.isArray(input?.caches)
      ? input!.caches.slice(0, 50).map(String)
      : [],
    nukeResult: input?.nukeResult,
  };
}

/**
 * Público (sem middleware de auth) porque o objetivo é capturar exatamente os
 * casos em que o app está preso — e nesses casos pode não haver sessão viva.
 * Sem escrita em banco; apenas structured logging.
 */
export const reportPwaState = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => safeParse(input))
  .handler(async ({ data }) => {
    console.warn(
      "[pwa-telemetry]",
      JSON.stringify({
        reason: data.reason,
        hostname: data.hostname,
        displayMode: data.displayMode,
        buildId: data.buildId,
        storedBuildId: data.storedBuildId,
        userAgent: data.userAgent,
        swCount: data.serviceWorkers.length,
        serviceWorkers: data.serviceWorkers,
        cacheCount: data.caches.length,
        caches: data.caches,
        nukeResult: data.nukeResult,
        at: new Date().toISOString(),
      }),
    );
    return { ok: true };
  });
