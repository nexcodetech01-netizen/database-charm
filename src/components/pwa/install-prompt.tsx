import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "nexos-pwa-install-dismissed-at";
const DISMISS_DAYS = 7;

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function wasRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari has no beforeinstallprompt — show manual banner.
    if (isIOS()) {
      const t = window.setTimeout(() => setShowIOS(true), 1500);
      return () => {
        window.removeEventListener("beforeinstallprompt", onPrompt);
        window.clearTimeout(t);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    const onInstalled = () => {
      setDeferred(null);
      setShowIOS(false);
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* ignore */
    } finally {
      setDeferred(null);
    }
  };

  if (dismissed) return null;
  if (!deferred && !showIOS) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-border/70 bg-background/95 p-4 shadow-2xl backdrop-blur-md sm:inset-x-auto sm:right-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar"
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Instalar o NexOS
          </p>
          {deferred ? (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Acesse mais rápido direto da tela inicial do seu dispositivo.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={install} className="gap-2">
                  <Download className="h-4 w-4" /> Instalar app
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>
                  Agora não
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-1 space-y-1 text-xs text-muted-foreground">
              <p>Para instalar no iPhone/iPad:</p>
              <p className="flex flex-wrap items-center gap-1">
                <span>1. Toque em</span>
                <Share className="inline h-3.5 w-3.5" />
                <span className="font-medium text-foreground">Compartilhar</span>
                <span>no Safari.</span>
              </p>
              <p className="flex flex-wrap items-center gap-1">
                <span>2. Escolha</span>
                <Plus className="inline h-3.5 w-3.5" />
                <span className="font-medium text-foreground">
                  Adicionar à Tela de Início
                </span>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
