import { Badge } from "@/components/ui/badge";
import type { NfeStatus } from "../functions/fiscal.functions";

const LABEL: Record<NfeStatus, string> = {
  draft: "Rascunho",
  validating: "Validando",
  signing: "Assinando",
  sending: "Enviando à SEFAZ",
  authorized: "Autorizada",
  rejected: "Rejeitada",
  cancelling: "Cancelando…",
  cancelled: "Cancelada",
  error: "Erro",
  discarded: "Descartada",
};

const TONE: Record<NfeStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  validating: "bg-primary/10 text-primary border-primary/20",
  signing: "bg-primary/10 text-primary border-primary/20",
  sending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  authorized: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  cancelling: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  cancelled: "bg-muted text-muted-foreground border-border line-through",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  discarded: "bg-muted text-muted-foreground border-border line-through",
};

/**
 * Badge do documento fiscal.
 *
 * Quando a chave/protocolo forem informados, "autorizada" só é exibida com
 * prova de autorização (chave + protocolo) — a mesma regra do helper
 * central `getFiscalStatusBadge()`.
 */
export function FiscalStatusBadge({
  status,
  accessKey,
  protocol,
}: {
  status: NfeStatus;
  accessKey?: string | null;
  protocol?: string | null;
}) {
  const proofProvided = accessKey !== undefined || protocol !== undefined;
  const effective: NfeStatus =
    status === "authorized" && proofProvided && (!accessKey || !protocol)
      ? "sending"
      : status;
  return (
    <Badge variant="outline" className={TONE[effective]}>
      {LABEL[effective]}
    </Badge>
  );
}

export function fiscalStatusLabel(status: NfeStatus): string {
  return LABEL[status];
}
