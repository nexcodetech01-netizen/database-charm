import { useEffect, useState } from "react";
import {
  Smartphone,
  RefreshCw,
  Trash2,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  nukePwaState,
  snapshotPwaState,
  type PwaStateSnapshot,
} from "@/lib/pwa-cleanup";
import { getBuildId } from "@/lib/pwa-boot";
import { reportPwaState } from "@/lib/pwa-telemetry.functions";

export function PwaSection() {
  const [snapshot, setSnapshot] = useState<PwaStateSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const buildId = getBuildId();
      const storedBuildId =
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("nexos:pwa-build-id")) ||
        null;
      const snap = await snapshotPwaState({ buildId, storedBuildId });
      setSnapshot(snap);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleNuke = async () => {
    setBusy(true);
    try {
      const before = snapshot;
      const result = await nukePwaState();

      // Telemetria da ação manual (best-effort).
      if (before) {
        void reportPwaState({
          data: {
            reason: "manual-nuke",
            hostname: before.hostname,
            displayMode: before.displayMode,
            buildId: before.buildId,
            storedBuildId: before.storedBuildId,
            userAgent:
              typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            serviceWorkers: before.serviceWorkers,
            caches: before.caches,
            nukeResult: result,
          },
        }).catch(() => {});
      }

      toast.success("Cache do PWA limpo.", {
        description: `Service Workers removidos: ${result.serviceWorkersUnregistered}. Caches apagados: ${result.cachesDeleted.length}. Recarregando…`,
        duration: 4000,
      });

      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      toast.error("Não foi possível limpar o cache.", {
        description: err instanceof Error ? err.message : String(err),
      });
      setBusy(false);
    }
  };

  const hasLegacySw = (snapshot?.serviceWorkers.length ?? 0) > 0;
  const hasCaches = (snapshot?.caches.length ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4 text-primary" />
          Aplicativo Instalado (PWA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Use esta área quando o NexOS instalado no seu celular ou computador
          insistir em abrir uma versão antiga. A limpeza remove Service Workers
          registrados e caches do próprio app — não afeta seus dados nem sua
          sessão de login.
        </p>

        {loading || !snapshot ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analisando estado do PWA…
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                Modo: {snapshot.displayMode === "standalone" ? "Instalado" : "Navegador"}
              </Badge>
              <Badge variant="outline">
                Build atual: {formatBuild(snapshot.buildId)}
              </Badge>
              {snapshot.storedBuildId &&
                snapshot.storedBuildId !== snapshot.buildId && (
                  <Badge variant="destructive">
                    Build salvo diverge: {formatBuild(snapshot.storedBuildId)}
                  </Badge>
                )}
            </div>

            <Separator />

            <div>
              <div className="flex items-center gap-2 font-medium">
                {hasLegacySw ? (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                )}
                Service Workers registrados: {snapshot.serviceWorkers.length}
              </div>
              {snapshot.serviceWorkers.map((sw, i) => (
                <div
                  key={i}
                  className="mt-1 pl-6 text-xs text-muted-foreground break-all"
                >
                  <span className="font-mono">{sw.state}</span> — {sw.scriptURL ?? "(sem script)"}
                  <div className="opacity-70">escopo: {sw.scope}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center gap-2 font-medium">
                {hasCaches ? (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                )}
                Cache Storage: {snapshot.caches.length}
              </div>
              {snapshot.caches.map((n) => (
                <div key={n} className="mt-1 pl-6 text-xs text-muted-foreground font-mono break-all">
                  {n}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading || busy}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar diagnóstico
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void handleNuke()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Limpar cache do PWA e recarregar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatBuild(id: string | null): string {
  if (!id) return "—";
  const clean = id.replace(/[^a-zA-Z0-9]/g, "");
  return clean.slice(-8).toLowerCase() || "—";
}
