/**
 * Boot-time PWA sanity pass.
 *
 * Roda uma única vez por sessão do navegador. Objetivos:
 *  1. Desregistrar TODOS os Service Workers desta origem (o app atual é
 *     manifest-only — qualquer SW registrado é legado e pode estar servindo
 *     assets antigos do Cache Storage dele).
 *  2. Limpar caches NexOS/Workbox que sobraram.
 *  3. Detectar drift entre o build embutido no bundle (`__NEXOS_BUILD_ID__`,
 *     injetado pelo Vite) e o último build visto pelo dispositivo. Se
 *     divergir, faz um único reload duro após a limpeza.
 *  4. Enviar snapshot para o backend quando encontrar SW/caches suspeitos,
 *     para termos telemetria de aparelhos travados em versão antiga.
 *
 * NUNCA roda em preview/iframe/dev.
 */
import { isPreviewHostname } from "@/hooks/version-check.utils";
import { nukePwaState, snapshotPwaState } from "./pwa-cleanup";
import { reportPwaState } from "./pwa-telemetry.functions";

const RAN_FLAG = "nexos:pwa-boot-ran-v1";
const BUILD_KEY = "nexos:pwa-build-id";
const RELOAD_GUARD = "nexos:pwa-boot-reloaded";

export function getBuildId(): string | null {
  // Vite: `import.meta.env.VITE_BUILD_ID` when configurado; caso contrário
  // caímos no hash de módulo que o bundler injeta em produção.
  const fromEnv =
    typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_BUILD_ID;
  if (fromEnv) return String(fromEnv);
  // Fallback: usa a URL do próprio módulo (contém o hash Vite em prod).
  try {
    return new URL(import.meta.url).pathname;
  } catch {
    return null;
  }
}

function readStoredBuildId(): string | null {
  try {
    return sessionStorage.getItem(BUILD_KEY) ?? localStorage.getItem(BUILD_KEY);
  } catch {
    return null;
  }
}

function writeStoredBuildId(id: string): void {
  try {
    localStorage.setItem(BUILD_KEY, id);
    sessionStorage.setItem(BUILD_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Executa uma vez por carregamento de aba. Seguro para chamar em StrictMode. */
export async function runPwaBoot(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!import.meta.env.PROD) return;
  if (isPreviewHostname(window.location.hostname)) return;
  if (window.self !== window.top) return;
  if (sessionStorage.getItem(RAN_FLAG) === "1") return;
  sessionStorage.setItem(RAN_FLAG, "1");

  const buildId = getBuildId();
  const storedBuildId = readStoredBuildId();

  try {
    const before = await snapshotPwaState({ buildId, storedBuildId });
    const hasLegacySw = before.serviceWorkers.length > 0;
    const hasLegacyCache = before.caches.some((n) =>
      /nexos|workbox|precache|runtime/i.test(n),
    );
    const buildDrift =
      buildId !== null && storedBuildId !== null && buildId !== storedBuildId;

    if (hasLegacySw || hasLegacyCache) {
      // Telemetria antes da limpeza — é aqui que descobrimos os aparelhos travados.
      void reportPwaState({
        data: {
          reason: "boot-suspect",
          hostname: before.hostname,
          displayMode: before.displayMode,
          buildId,
          storedBuildId,
          userAgent: navigator.userAgent,
          serviceWorkers: before.serviceWorkers,
          caches: before.caches,
        },
      }).catch(() => {});

      const nukeResult = await nukePwaState();

      void reportPwaState({
        data: {
          reason: "post-nuke",
          hostname: before.hostname,
          displayMode: before.displayMode,
          buildId,
          storedBuildId,
          userAgent: navigator.userAgent,
          serviceWorkers: before.serviceWorkers,
          caches: before.caches,
          nukeResult,
        },
      }).catch(() => {});

      // Se havia SW legado, o HTML atual pode ter vindo da cache dele. Um
      // único reload duro (guarded) garante que a próxima carga venha da rede.
      const alreadyReloaded = sessionStorage.getItem(RELOAD_GUARD) === "1";
      if ((hasLegacySw || buildDrift) && !alreadyReloaded) {
        sessionStorage.setItem(RELOAD_GUARD, "1");
        if (buildId) writeStoredBuildId(buildId);
        window.location.reload();
        return;
      }
    }

    if (buildId) writeStoredBuildId(buildId);
  } catch (err) {
    // Boot nunca deve derrubar o app.
    console.error("[pwa-boot] falhou", err);
  }
}
