import { AlertTriangle, FileText, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DanfeDownloadButton } from "@/features/fiscal/v2/components/artifact-download-button";
import { DanfePrintButton } from "@/features/printing";
import {
  PDV_NFCE_FAILURE_MESSAGE,
  type PdvFiscalOutcome,
} from "../lib/fiscal";

type Props = {
  outcome: PdvFiscalOutcome | null;
  isIssuing: boolean;
  onRetry: () => void;
};

/**
 * PDV — status da NFC-e no painel de conclusão (Sprint 2.10).
 * O download do DANFE reutiliza o botão de artefatos do módulo fiscal.
 */
export function PDVFiscalStatus({ outcome, isIssuing, onRetry }: Props) {
  if (isIssuing) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Emitindo NFC-e...
      </p>
    );
  }

  if (!outcome || outcome.status === "disabled") return null;

  if (outcome.status === "issued") {
    const { document } = outcome;
    return (
      <div className="space-y-2 rounded-xl border border-border/60 bg-background/60 p-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4" />
          {document.pending
            ? "NFC-e em processamento na SEFAZ"
            : `NFC-e emitida${document.number ? ` nº ${document.number}` : ""}`}
        </p>
        {document.accessKey && (
          <p className="break-all font-mono text-xs text-muted-foreground">
            {document.accessKey}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <DanfePrintButton path={document.danfePath} />
          <DanfeDownloadButton
            path={document.danfePath}
            doc={{
              number: document.number ? Number(document.number) : null,
              accessKey: document.accessKey,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-amber-700">
        <AlertTriangle className="h-4 w-4" /> {PDV_NFCE_FAILURE_MESSAGE}
      </p>
      <p className="text-xs text-muted-foreground">
        {outcome.reason === "unavailable"
          ? "SEFAZ indisponível no momento. A venda foi preservada."
          : outcome.message}
      </p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        <RotateCcw className="mr-1.5 h-4 w-4" /> Tentar emitir novamente
      </Button>
    </div>
  );
}
