/**
 * Pure helpers used by `useVersionCheck`. Extracted to keep the hook thin and
 * make the version-detection / update-cleanup logic unit-testable in Node.
 */

export function isPreviewHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname.endsWith(".lovableproject.com") ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

/**
 * Format a raw ETag / Last-Modified value into a short, user-friendly label
 * such as `a1b2c3d4`. Keeps only alphanumerics and returns the last 8 chars
 * so both weak ETags (`W/"abc"`) and Last-Modified dates render consistently.
 */
export function formatVersionTag(tag: string | null | undefined): string {
  if (!tag) return "—";
  const cleaned = tag.replace(/[^a-zA-Z0-9]/g, "");
  if (cleaned.length === 0) return "—";
  return cleaned.slice(-8).toLowerCase();
}

/**
 * Decides whether a freshly fetched tag should trigger a new update banner.
 *
 * Contract:
 * - Never notify when we haven't captured the baseline yet.
 * - Never notify when the tag equals the initial (boot-time) baseline.
 * - Never notify twice for the same new tag — even across many polls,
 *   visibility changes or focus events.
 */
export function shouldNotifyForTag(params: {
  initialTag: string | null;
  lastNotifiedTag: string | null;
  incomingTag: string | null;
}): boolean {
  const { initialTag, lastNotifiedTag, incomingTag } = params;
  if (!incomingTag) return false;
  if (!initialTag) return false;
  if (incomingTag === initialTag) return false;
  if (incomingTag === lastNotifiedTag) return false;
  return true;
}

export interface UpdateCleanupDeps {
  getServiceWorkerRegistrations?: () => Promise<
    ReadonlyArray<{ unregister: () => Promise<boolean> | boolean }>
  >;
  getCacheKeys?: () => Promise<string[]>;
  deleteCache?: (name: string) => Promise<boolean> | boolean;
  reload: () => void;
}

export interface UpdateCleanupResult {
  serviceWorkersCleared: boolean;
  cachesCleared: boolean;
  reloaded: boolean;
  errors: string[];
}

/**
 * Runs the "Atualizar agora" cleanup pipeline in a fault-tolerant way:
 * every step is best-effort, failures are collected, and the reload still
 * runs so the user is never left stuck on a stale build. Returns the outcome
 * so the caller can decide whether to surface an error toast.
 */
export async function runUpdateCleanup(
  deps: UpdateCleanupDeps,
): Promise<UpdateCleanupResult> {
  const result: UpdateCleanupResult = {
    serviceWorkersCleared: false,
    cachesCleared: false,
    reloaded: false,
    errors: [],
  };

  if (deps.getServiceWorkerRegistrations) {
    try {
      const regs = await deps.getServiceWorkerRegistrations();
      await Promise.all(regs.map((r) => Promise.resolve(r.unregister())));
      result.serviceWorkersCleared = true;
    } catch (err) {
      result.errors.push(
        `sw-unregister: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    result.serviceWorkersCleared = true;
  }

  if (deps.getCacheKeys && deps.deleteCache) {
    try {
      const names = await deps.getCacheKeys();
      const settled = await Promise.allSettled(
        names.map((n) => Promise.resolve(deps.deleteCache!(n))),
      );
      result.cachesCleared = settled.every((s) => s.status === "fulfilled");
      if (!result.cachesCleared) {
        result.errors.push("cache-delete: one or more caches failed to delete");
      }
    } catch (err) {
      result.errors.push(
        `cache-keys: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    result.cachesCleared = true;
  }

  try {
    deps.reload();
    result.reloaded = true;
  } catch (err) {
    result.errors.push(
      `reload: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return result;
}
