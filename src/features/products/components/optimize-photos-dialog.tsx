import { useState } from "react";
import { ImageDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  listPhotosToOptimize,
  optimizePhotos,
  type OptimizeProgress,
} from "../services/optimize-photos.service";

/**
 * Otimiza de uma vez as fotos antigas: cria as versões leves (listas, PDV,
 * catálogo) e recomprime originais pesadas. Pode rodar de novo sem
 * problema — só mexe no que falta.
 */
export function OptimizePhotosDialog({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"idle" | "counting" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState<OptimizeProgress | null>(null);
  const [message, setMessage] = useState("");

  async function start() {
    setStage("counting");
    setMessage("");
    try {
      const paths = await listPhotosToOptimize(companyId);
      if (paths.length === 0) {
        setProgress({ done: 0, total: 0, optimized: 0, failed: 0 });
        setStage("done");
        return;
      }
      setStage("running");
      const final = await optimizePhotos(paths, setProgress);
      setProgress(final);
      setStage("done");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro desconhecido");
      setStage("error");
    }
  }

  const running = stage === "counting" || stage === "running";
  const pct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !running && setOpen(v)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ImageDown className="mr-1.5 h-4 w-4" /> Otimizar fotos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Otimizar fotos</DialogTitle>
          <DialogDescription>
            Cria versões leves das fotos para as listas, o PDV e o catálogo carregarem rápido e
            gastarem bem menos internet do servidor. Fotos muito pesadas também são reduzidas. Só
            precisa fazer uma vez; fotos novas já entram otimizadas.
          </DialogDescription>
        </DialogHeader>

        {stage === "idle" ? (
          <p className="text-sm text-muted-foreground">
            Deixe esta janela aberta até terminar. Pode levar alguns minutos.
          </p>
        ) : null}
        {stage === "counting" ? (
          <p className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Procurando fotos…
          </p>
        ) : null}
        {stage === "running" && progress ? (
          <div className="space-y-2">
            <Progress value={pct} />
            <p className="text-sm text-muted-foreground">
              {progress.done} de {progress.total} fotos
            </p>
          </div>
        ) : null}
        {stage === "done" && progress ? (
          <p className="text-sm">
            {progress.total === 0
              ? "Todas as fotos já estão otimizadas."
              : `Pronto: ${progress.optimized} foto(s) otimizada(s)${progress.failed ? `, ${progress.failed} com erro (pode tentar de novo)` : ""}.`}
          </p>
        ) : null}
        {stage === "error" ? (
          <p className="text-sm text-destructive">Não foi possível otimizar: {message}</p>
        ) : null}

        <DialogFooter>
          {stage === "done" ? (
            <Button onClick={() => setOpen(false)}>Fechar</Button>
          ) : (
            <Button onClick={start} disabled={running}>
              {running ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {stage === "error" ? "Tentar de novo" : "Otimizar agora"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
