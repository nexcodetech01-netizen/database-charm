import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { useCancelFiscal } from "../hooks/use-fiscal";
import {
  CANCEL_REASON_MAX,
  CANCEL_REASON_MIN,
  evaluateCancelEligibility,
  validateCancelReason,
  type CancelableDocument,
} from "../lib/cancellation";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentId: string;
  /** Documento para validar prazo legal e status antes de enviar à SEFAZ. */
  document?: CancelableDocument;
  onCancelled?: () => void;
}

/**
 * Cancelamento de NF-e. A SEFAZ exige justificativa de 15 a 255 caracteres
 * e só aceita o evento dentro de 24h da autorização.
 */
export function CancelNfeDialog({
  open,
  onOpenChange,
  documentId,
  document,
  onCancelled,
}: Props) {
  const [reason, setReason] = useState("");
  const mutation = useCancelFiscal({
    onSuccess: () => {
      onOpenChange(false);
      setReason("");
      onCancelled?.();
    },
  });

  const eligibility = document ? evaluateCancelEligibility(document) : null;
  const blocked = eligibility ? !eligibility.allowed : false;
  const reasonError = validateCancelReason(reason);
  const trimmed = reason.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar NF-e</DialogTitle>
          <DialogDescription>
            O cancelamento é irreversível. Informe uma justificativa (entre{" "}
            {CANCEL_REASON_MIN} e {CANCEL_REASON_MAX} caracteres) conforme
            exigido pela SEFAZ.
          </DialogDescription>
        </DialogHeader>

        {blocked ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{eligibility?.reason}</span>
          </div>
        ) : eligibility?.deadline ? (
          <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            Prazo legal para cancelamento: até{" "}
            <strong>{formatDateTime(eligibility.deadline)}</strong> (
            {Math.max(0, Math.floor(eligibility.hoursLeft ?? 0))}h restantes).
          </p>
        ) : null}

        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex: emissão em duplicidade / erro no valor unitário do item…"
          rows={4}
          maxLength={CANCEL_REASON_MAX}
          disabled={blocked}
        />
        <p className="text-xs text-muted-foreground">
          {trimmed.length}/{CANCEL_REASON_MAX}
          {reasonError && trimmed.length > 0 ? ` · ${reasonError}` : ""}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={blocked || Boolean(reasonError) || mutation.isPending}
            onClick={() => mutation.mutate({ documentId, reason: trimmed })}
          >
            {mutation.isPending ? "Cancelando…" : "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
