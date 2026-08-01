import { useEffect, useState } from "react";
import { RefreshCw, X, Bug } from "lucide-react";
import { useVersionCheck } from "@/hooks/use-version-check";
import { Button } from "@/components/ui/button";

/**
 * Banner flutuante de atualização do PWA.
 *
 * Aparece somente quando o NexOS está instalado como aplicativo e um novo
 * deploy foi detectado (`needRefresh === true`). Em abas normais do
 * navegador, dev, iframe ou hostnames de preview, o hook subjacente
 * (`useVersionCheck`) nem inicia o polling — então este componente
 * simplesmente não renderiza nada.
 *
 * DEV/PREVIEW: expõe `window.__triggerPwaUpdate()` e um botão flutuante
 * de teste para validar layout, animação e clique em "Atualizar agora"
 * sem precisar aguardar um deploy real.
 */
export function PWAUpdateNotification() {
  const { needRefresh, currentVersion, newVersion, updateServiceWorker, dismiss } =
    useVersionCheck();

  // Override local para preview do banner via botão/console de teste.
  const [forceShow, setForceShow] = useState(false);
  // Evita mismatch de hidratação: o botão de teste depende de `window`.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDevOrPreview =
    mounted &&
    (import.meta.env.DEV ||
      /localhost|127\.0\.0\.1|preview--|id-preview--|lovableproject|beta\.lovable\.dev/.test(
        window.location.hostname,
      ));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __triggerPwaUpdate?: () => void };
    w.__triggerPwaUpdate = () => {
      console.log("[PWA-Audit] __triggerPwaUpdate() chamado — forçando banner.");
      setForceShow(true);
    };
    return () => {
      delete w.__triggerPwaUpdate;
    };
  }, []);

  const visible = needRefresh || forceShow;

  const handleDismiss = () => {
    setForceShow(false);
    dismiss();
  };

  return (
    <>
      {visible && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-4 z-[100] mx-auto flex max-w-md items-start gap-3 rounded-xl border border-border/60 bg-background/95 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 fade-in sm:inset-x-auto sm:right-4"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Uma nova atualização está disponível!
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Versão {currentVersion} → {forceShow && !needRefresh ? "teste" : newVersion}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => void updateServiceWorker(true)}
                className="h-8"
              >
                Atualizar agora
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="h-8 text-muted-foreground"
              >
                Depois
              </Button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Fechar aviso de atualização"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {isDevOrPreview && !visible && (
        <button
          type="button"
          onClick={() => setForceShow(true)}
          className="fixed bottom-4 right-4 z-[99] flex items-center gap-1.5 rounded-full border border-dashed border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-md hover:text-foreground"
          title="Testar banner de atualização do PWA (visível apenas em dev/preview)"
        >
          <Bug className="h-3.5 w-3.5" aria-hidden="true" />
          Testar PWA update
        </button>
      )}
    </>
  );
}
