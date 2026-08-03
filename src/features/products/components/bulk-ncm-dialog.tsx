/**
 * Preenchimento automático em massa de NCM.
 *
 * Fluxo em 2 etapas: primeiro varre e mostra a prévia (quantos produtos serão
 * atualizados e por qual origem), depois o usuário confirma a gravação.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { bulkNcmService, type BulkNcmScan } from "../lib/bulk-ncm";
import { formatNcm } from "../lib/fiscal-suggestions";

interface Props {
  companyId: string;
  label?: string;
}

type Phase = "idle" | "scanning" | "preview" | "applying" | "done";

export function BulkNcmDialog({ companyId, label }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [scan, setScan] = useState<BulkNcmScan | null>(null);
  const [updated, setUpdated] = useState(0);

  const reset = () => {
    setPhase("idle");
    setProgress({ done: 0, total: 0 });
    setScan(null);
    setUpdated(0);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && (phase === "scanning" || phase === "applying")) return;
    setOpen(next);
    if (!next) reset();
  };

  const runScan = async () => {
    setPhase("scanning");
    setProgress({ done: 0, total: 0 });
    try {
      const result = await bulkNcmService.scan(companyId, (done, total) =>
        setProgress({ done, total }),
      );
      setScan(result);
      setPhase("preview");
    } catch (error) {
      console.error("[bulk-ncm] scan", error);
      toast.error("Não foi possível analisar os produtos.");
      setPhase("idle");
    }
  };

  const runApply = async () => {
    if (!scan) return;
    setPhase("applying");
    setProgress({ done: 0, total: scan.candidates.length });
    try {
      const result = await bulkNcmService.apply(companyId, scan.candidates, (done, total) =>
        setProgress({ done, total }),
      );
      setUpdated(result.updated);
      setPhase("done");
      queryClient.invalidateQueries({ queryKey: ["products"] });

      if (result.updated > 0) {
        toast.success(
          `${result.updated} ${result.updated === 1 ? "produto atualizado" : "produtos atualizados"} com NCM automaticamente.`,
        );
      } else {
        toast.info("Nenhum produto foi atualizado.");
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} produto(s) não puderam ser atualizados.`);
      }
    } catch (error) {
      console.error("[bulk-ncm] apply", error);
      toast.error("Falha ao gravar os NCMs.");
      setPhase("preview");
    }
  };

  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const busy = phase === "scanning" || phase === "applying";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Sparkles className="mr-1.5 h-4 w-4" /> {label || "Preencher NCM"}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Preencher NCM automaticamente</DialogTitle>
          <DialogDescription>
            Varre os produtos sem NCM e sugere o código com base no NCM padrão da categoria
            e no histórico de produtos semelhantes já cadastrados. Nenhum NCM existente é
            sobrescrito.
          </DialogDescription>
        </DialogHeader>

        {phase === "idle" && (
          <p className="text-sm text-muted-foreground">
            A análise é somente leitura. Você verá a prévia antes de confirmar a gravação.
          </p>
        )}

        {busy && (
          <div className="space-y-2 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {phase === "scanning" ? "Analisando produtos..." : "Gravando NCMs..."}
            </div>
            <Progress value={percent} />
            <p className="text-xs text-muted-foreground">
              {progress.done} de {progress.total}
            </p>
          </div>
        )}

        {phase === "preview" && scan && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Sem NCM" value={scan.pending} />
              <Stat label="Serão preenchidos" value={scan.candidates.length} highlight />
              <Stat label="Sem sugestão" value={scan.unresolved} />
            </div>

            {scan.candidates.length > 0 && (
              <ScrollArea className="h-56 rounded-md border">
                <ul className="divide-y">
                  {scan.candidates.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.source === "category" ? "Categoria" : "Similar"}: {c.reference}
                        </p>
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        {formatNcm(c.ncm)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}

            {scan.unresolved > 0 && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {scan.unresolved} produto(s) sem categoria com NCM padrão nem histórico
                semelhante. Defina o NCM padrão da categoria para ampliar a cobertura.
              </p>
            )}
          </div>
        )}

        {phase === "done" && (
          <div className="flex items-center gap-2 py-4 text-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span>
              {updated} {updated === 1 ? "produto atualizado" : "produtos atualizados"} com
              sucesso.
            </span>
          </div>
        )}

        <DialogFooter>
          {phase === "idle" && (
            <Button onClick={runScan}>
              <Sparkles className="mr-1.5 h-4 w-4" /> Analisar produtos
            </Button>
          )}
          {phase === "preview" && scan && (
            <>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={runApply} disabled={scan.candidates.length === 0}>
                Preencher {scan.candidates.length} produto(s)
              </Button>
            </>
          )}
          {phase === "done" && <Button onClick={() => handleOpenChange(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border p-2">
      <p className={`text-lg font-semibold ${highlight ? "text-primary" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
