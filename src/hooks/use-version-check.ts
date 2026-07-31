import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  formatVersionTag,
  isPreviewHostname,
  runUpdateCleanup,
  shouldNotifyForTag,
} from "./version-check.utils";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function normalizeBundleTag(src: string): string | null {
  try {
    return new URL(src, window.location.origin).pathname;
  } catch {
    return null;
  }
}

function getLoadedBundleTag(): string | null {
  const script = document.querySelector<HTMLScriptElement>(
    'script[src*="/assets/"], script[src*="assets/"]',
  );
  return script?.src ? normalizeBundleTag(script.src) : null;
}

async function fetchDeployedBundleTag(): Promise<string | null> {
  try {
    const response = await fetch(`/?v=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "cache-control": "no-cache", pragma: "no-cache" },
    });
    if (!response.ok) return null;

    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const script = parsed.querySelector<HTMLScriptElement>(
      'script[src*="/assets/"], script[src*="assets/"]',
    );
    return script?.getAttribute("src")
      ? normalizeBundleTag(script.getAttribute("src")!)
      : null;
  } catch {
    return null;
  }
}


export interface VersionCheckState {
  /** True quando o backend detectou um novo deploy e o usuário deve atualizar. */
  needRefresh: boolean;
  /** Rótulo curto (8 chars) da versão em execução — ex.: "a1b2c3d4". */
  currentVersion: string;
  /** Rótulo curto da nova versão disponível, ou "—" enquanto não há aviso. */
  newVersion: string;
  /**
   * Dispara o pipeline de atualização: desregistra service workers legados,
   * limpa caches próprios do NexOS e recarrega a página. Segue o mesmo
   * contrato do `updateServiceWorker(reloadPage)` do `vite-plugin-pwa`.
   */
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  /** Fecha o banner sem atualizar (usuário escolheu "Depois"). */
  dismiss: () => void;
}

/**
 * Detecta novos deploys comparando o hash do bundle JavaScript carregado com
 * o bundle referenciado pelo HTML mais recente. Roda **apenas**
 * quando o NexOS está instalado como PWA (modo standalone), em produção,
 * fora de iframes e fora dos hostnames de preview do Lovable.
 *
 * O retorno espelha a API do `useRegisterSW` do `vite-plugin-pwa/react`
 * (`needRefresh` + `updateServiceWorker`) para manter o componente de UI
 * plugável caso o projeto migre para service worker gerado futuramente.
 */
export function useVersionCheck(): VersionCheckState {
  const initialTag = useRef<string | null>(null);
  const notifiedTag = useRef<string | null>(null);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [currentVersion, setCurrentVersion] = useState("—");
  const [newVersion, setNewVersion] = useState("—");

  // Test hook: allow forcing the banner from DevTools via
  // `window.__triggerPwaBanner()` — useful for validating the UI without
  // waiting for a real deploy. Cleaned up on unmount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      __triggerPwaBanner?: (tag?: string) => void;
      __dismissPwaBanner?: () => void;
    };
    w.__triggerPwaBanner = (tag = "testhash") => {
      setNewVersion(formatVersionTag(tag));
      setNeedRefresh(true);
      console.log("[PWA-Check] Banner forçado via __triggerPwaBanner()");
    };
    w.__dismissPwaBanner = () => setNeedRefresh(false);
    return () => {
      delete w.__triggerPwaBanner;
      delete w.__dismissPwaBanner;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (import.meta.env.DEV) {
      console.log("[PWA-Check] Desativado em DEV.");
      return;
    }
    if (isPreviewHostname(window.location.hostname)) {
      console.log("[PWA-Check] Desativado em hostname de preview:", window.location.hostname);
      return;
    }
    if (window.self !== window.top) return;


    const loadedBundleTag = getLoadedBundleTag();
    if (!loadedBundleTag) {
      console.warn("[PWA-Check] Não foi possível identificar o bundle carregado.");
      return;
    }

    initialTag.current = loadedBundleTag;
    setCurrentVersion(formatVersionTag(loadedBundleTag));
    console.log("[PWA-Check] Hash Atual na Memória:", loadedBundleTag);
    let cancelled = false;

    const runCheck = async () => {
      const tag = await fetchDeployedBundleTag();
      if (cancelled) return;
      console.log("[PWA-Check] Hash Retornado da CDN:", tag);

      const shouldNotify = shouldNotifyForTag({
        initialTag: initialTag.current,
        lastNotifiedTag: notifiedTag.current,
        incomingTag: tag,
      });
      console.log("[PWA-Check] Deve exibir banner?", shouldNotify, {
        initial: initialTag.current,
        incoming: tag,
        lastNotified: notifiedTag.current,
      });
      if (!shouldNotify) return;

      notifiedTag.current = tag;
      setNewVersion(formatVersionTag(tag));
      setNeedRefresh(true);
    };

    void runCheck();

    const interval = window.setInterval(() => void runCheck(), CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void runCheck();
    };
    const onFocus = () => void runCheck();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const updateServiceWorker = useCallback(async (reloadPage = true) => {
    const result = await runUpdateCleanup({
      getServiceWorkerRegistrations:
        typeof navigator !== "undefined" && "serviceWorker" in navigator
          ? () => navigator.serviceWorker.getRegistrations()
          : undefined,
      getCacheKeys:
        typeof window !== "undefined" && "caches" in window
          ? () => caches.keys()
          : undefined,
      deleteCache:
        typeof window !== "undefined" && "caches" in window
          ? (n) => caches.delete(n)
          : undefined,
      reload: () => {
        if (reloadPage) {
          (window.location.reload as (forceReload?: boolean) => void)(true);
        }
      },
    });
    if (!result.reloaded && reloadPage) {
      toast.error("Não foi possível atualizar automaticamente.", {
        description:
          "Feche e reabra o NexOS, ou recarregue a página manualmente. Seus dados não foram afetados.",
        duration: 10000,
      });
    }
  }, []);

  const dismiss = useCallback(() => setNeedRefresh(false), []);

  return { needRefresh, currentVersion, newVersion, updateServiceWorker, dismiss };
}
