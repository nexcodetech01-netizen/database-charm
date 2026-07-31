/**
 * PWA cleanup helpers — browser-only, framework-agnostic, unit-testable.
 *
 * Responsabilidade: enumerar / desregistrar Service Workers e limpar Cache
 * Storage do NexOS. Preserva caches de terceiros (Firebase Messaging,
 * OneSignal, etc.) filtrando por nome.
 */

export interface ServiceWorkerSnapshot {
  scope: string;
  scriptURL: string | null;
  state: "installing" | "waiting" | "active" | "none";
  updateViaCache?: string;
}

export interface PwaStateSnapshot {
  supported: boolean;
  hostname: string;
  displayMode: "standalone" | "browser" | "unknown";
  serviceWorkers: ServiceWorkerSnapshot[];
  caches: string[];
  buildId: string | null;
  storedBuildId: string | null;
  capturedAt: string;
}

const APP_CACHE_RE =
  /^nexos[-_]|(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-|(^|-)workbox-/i;

export function isAppCacheName(name: string): boolean {
  return APP_CACHE_RE.test(name);
}

function detectDisplayMode(): PwaStateSnapshot["displayMode"] {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "unknown";
  }
  if (window.matchMedia("(display-mode: standalone)").matches) return "standalone";
  return "browser";
}

function pickState(reg: ServiceWorkerRegistration): ServiceWorkerSnapshot {
  const worker = reg.active ?? reg.waiting ?? reg.installing;
  const state: ServiceWorkerSnapshot["state"] = reg.installing
    ? "installing"
    : reg.waiting
      ? "waiting"
      : reg.active
        ? "active"
        : "none";
  return {
    scope: reg.scope,
    scriptURL: worker?.scriptURL ?? null,
    state,
    updateViaCache: (reg as unknown as { updateViaCache?: string }).updateViaCache,
  };
}

export async function snapshotPwaState(params: {
  buildId: string | null;
  storedBuildId: string | null;
}): Promise<PwaStateSnapshot> {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const supported =
    typeof navigator !== "undefined" && "serviceWorker" in navigator;

  const serviceWorkers: ServiceWorkerSnapshot[] = [];
  if (supported) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) serviceWorkers.push(pickState(r));
    } catch {
      /* ignore — some browsers throw in private mode */
    }
  }

  let cacheNames: string[] = [];
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      cacheNames = await caches.keys();
    } catch {
      /* ignore */
    }
  }

  return {
    supported,
    hostname,
    displayMode: detectDisplayMode(),
    serviceWorkers,
    caches: cacheNames,
    buildId: params.buildId,
    storedBuildId: params.storedBuildId,
    capturedAt: new Date().toISOString(),
  };
}

export interface PwaNukeResult {
  serviceWorkersUnregistered: number;
  serviceWorkersFailed: number;
  cachesDeleted: string[];
  cachesFailed: string[];
  errors: string[];
}

/**
 * Full cleanup: unregister EVERY Service Worker in this origin and delete
 * every NexOS/Workbox cache. Third-party caches (Firebase, OneSignal) are
 * preserved. Never throws — collects errors and returns a report.
 */
export async function nukePwaState(): Promise<PwaNukeResult> {
  const result: PwaNukeResult = {
    serviceWorkersUnregistered: 0,
    serviceWorkersFailed: 0,
    cachesDeleted: [],
    cachesFailed: [],
    errors: [],
  };

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      const outcomes = await Promise.allSettled(
        regs.map((r) => Promise.resolve(r.unregister())),
      );
      for (const o of outcomes) {
        if (o.status === "fulfilled" && o.value) result.serviceWorkersUnregistered += 1;
        else {
          result.serviceWorkersFailed += 1;
          if (o.status === "rejected") result.errors.push(`sw: ${String(o.reason)}`);
        }
      }
    } catch (err) {
      result.errors.push(
        `sw-list: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const names = await caches.keys();
      const targets = names.filter(isAppCacheName);
      const outcomes = await Promise.allSettled(
        targets.map(async (n) => {
          const ok = await caches.delete(n);
          return { n, ok };
        }),
      );
      for (const o of outcomes) {
        if (o.status === "fulfilled" && o.value.ok) result.cachesDeleted.push(o.value.n);
        else if (o.status === "fulfilled") result.cachesFailed.push(o.value.n);
        else result.errors.push(`cache: ${String(o.reason)}`);
      }
    } catch (err) {
      result.errors.push(
        `cache-list: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
