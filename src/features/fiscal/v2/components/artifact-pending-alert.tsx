import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ARTIFACT_LABELS, normalizePendingKinds } from "../lib/artifacts";
import { useReprocessFiscalArtifacts } from "../hooks/use-fiscal";
import type { FiscalDocumentDto } from "../functions/fiscal.functions";

interface Props {
  document: FiscalDocumentDto;
  className?: string;
}

/**
 * Aviso de artefatos fiscais que não puderam ser salvos, com ação de
 * reprocessamento (não reenvia NF-e — apenas recupera os arquivos).
 */
export function ArtifactPendingAlert({ document: doc, className }: Props) {
  const pending = normalizePendingKinds(doc.artifactsPending);
  const reprocess = useReprocessFiscalArtifacts();
  if (pending.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 ${className ?? ""}`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1 text-xs">
        <div className="flex flex-wrap gap-x-3 font-medium text-amber-700 dark:text-amber-400">
          {pending.map((kind) => (
            <span key={kind}>⚠ {ARTIFACT_LABELS[kind]} pendente</span>
          ))}
        </div>
        {doc.artifactsLastError ? (
          <p className="mt-0.5 truncate text-muted-foreground">{doc.artifactsLastError}</p>
        ) : null}
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={reprocess.isPending}
        onClick={() => reprocess.mutate(doc.id)}
      >
        <RotateCw className="mr-1.5 h-4 w-4" /> Reprocessar
      </Button>
    </div>
  );
}
