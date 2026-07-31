import { formatAccessKey } from "../lib/access-key";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Ban, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { FiscalStatusBadge } from "./fiscal-status-badge";
import { FiscalTimeline } from "./fiscal-timeline";
import {
  XmlDownloadButton,
  XmlViewButton,
  DanfeDownloadButton,
} from "./artifact-download-button";
import { CancelNfeDialog } from "./cancel-nfe-dialog";
import { ArtifactPendingAlert } from "./artifact-pending-alert";
import { evaluateCancelEligibility } from "../lib/cancellation";
import {
  useDiscardFiscalDocument,
  useFiscalDocumentContext,
  useRefreshFiscalStatus,
} from "../hooks/use-fiscal";
import type { FiscalDocumentDto, FiscalEventDto } from "../functions/fiscal.functions";

interface Props {
  document: FiscalDocumentDto;
  events: FiscalEventDto[];
}

const CAN_CANCEL: FiscalDocumentDto["status"][] = ["authorized"];
const CAN_REFRESH: FiscalDocumentDto["status"][] = ["sending", "cancelling"];

export function FiscalDetails({ document: doc, events }: Props) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const refresh = useRefreshFiscalStatus();
  const discard = useDiscardFiscalDocument();
  // Descarte só para tentativas que nunca chegaram à SEFAZ.
  const canDiscard =
    (doc.status === "error" || doc.status === "rejected") &&
    !doc.accessKey &&
    !doc.protocol;
  const ctx = useFiscalDocumentContext(doc.id);
  const cancelEligibility = evaluateCancelEligibility(doc);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-3">
              NF-e {doc.number ?? "—"} / série {doc.series ?? 1}
              <FiscalStatusBadge
                status={doc.status}
                accessKey={doc.accessKey}
                protocol={doc.protocol}
              />
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Criada em{" "}
              {format(new Date(doc.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              {" · "}
              Ambiente:{" "}
              {doc.environment === "production" ? "Produção" : "Homologação"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {doc.status === "cancelling" ? (
              <span className="self-center text-xs text-amber-600 dark:text-amber-400">
                Cancelamento enviado — aguardando confirmação da SEFAZ.
              </span>
            ) : null}
            {CAN_REFRESH.includes(doc.status) ? (
              <Button
                size="sm"
                variant="outline"
                disabled={refresh.isPending}
                onClick={() => refresh.mutate(doc.id)}
              >
                <RefreshCw className="mr-1.5 h-4 w-4" />
                {doc.status === "cancelling"
                  ? "Atualizar status do cancelamento"
                  : "Consultar SEFAZ"}
              </Button>
            ) : null}
            <XmlViewButton path={doc.xmlAuthorizedPath ?? doc.xmlSignedPath} doc={doc} />
            <XmlDownloadButton
              path={doc.xmlAuthorizedPath ?? doc.xmlSignedPath}
              doc={doc}
            />
            <DanfeDownloadButton path={doc.danfePath} doc={doc} />
            {canDiscard ? (
              <Button
                size="sm"
                variant="outline"
                disabled={discard.isPending}
                onClick={() => discard.mutate({ documentId: doc.id, reason: "Reemissão" })}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" /> Descartar tentativa e emitir
                novamente
              </Button>
            ) : null}
            {doc.status === "discarded" ? (
              <span className="self-center text-xs text-muted-foreground">
                Tentativa descartada
                {doc.discardedAt
                  ? ` em ${format(new Date(doc.discardedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}`
                  : ""}
                {doc.discardReason ? ` · ${doc.discardReason}` : ""}
              </span>
            ) : null}
            {CAN_CANCEL.includes(doc.status) ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={!cancelEligibility.allowed}
                title={cancelEligibility.reason}
                onClick={() => setCancelOpen(true)}
              >
                <Ban className="mr-1.5 h-4 w-4" /> Cancelar NF-e
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <ArtifactPendingAlert document={doc} />
          <div className="grid gap-3 md:grid-cols-3">
          <Info
            label="Destinatário"
            value={
              ctx.data?.customerName
                ? `${ctx.data.customerName}${
                    ctx.data.customerDocument ? " · " + ctx.data.customerDocument : ""
                  }`
                : "Consumidor não identificado"
            }
          />
          <Info label="Itens" value={String(ctx.data?.itemCount ?? "—")} />
          <Info label="CFOP / Natureza" value={`${ctx.data?.cfop ?? "—"} · ${ctx.data?.natureza ?? "—"}`} />
          <Info label="Chave de acesso" value={formatAccessKey(doc.accessKey)} mono />
          <Info label="Protocolo" value={doc.protocol ?? "—"} mono />
          <Info label="Valor total" value={formatCurrency(doc.totalAmount)} />
          {ctx.data?.saleNumber ? (
            <Info label="Venda de origem" value={`VD-${String(ctx.data.saleNumber).padStart(4, "0")}`} />
          ) : null}
          {doc.status === "cancelling" ? (
            <div className="md:col-span-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400">
                Cancelamento em processamento na SEFAZ
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Protocolo, XML do evento e histórico só são gravados após a
                confirmação oficial. A nota ainda não deve ser considerada
                cancelada.
              </p>
              {doc.cancellationReason ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Justificativa: {doc.cancellationReason}
                </p>
              ) : null}
            </div>
          ) : null}
          {doc.status === "cancelled" ? (
            <div className="md:col-span-3 grid gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 md:grid-cols-3">
              <Info
                label="Protocolo de cancelamento"
                value={doc.cancellationProtocol ?? "—"}
                mono
              />
              <Info
                label="Cancelada em"
                value={
                  doc.cancelledAt
                    ? format(new Date(doc.cancelledAt), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })
                    : "—"
                }
              />
              <Info label="Justificativa" value={doc.cancellationReason ?? "—"} />
              {doc.xmlCancellationPath ? (
                <div className="md:col-span-3">
                  <XmlDownloadButton
                    path={doc.xmlCancellationPath}
                    doc={{ ...doc, number: `cancelamento-${doc.number ?? ""}` }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {doc.rejectionReason ? (
            <div className="md:col-span-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {doc.rejectionReason}
            </div>
          ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linha do tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <FiscalTimeline events={events} />
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">
            Eventos são registrados automaticamente pelo motor fiscal a cada
            transição de estado.
          </p>
        </CardContent>
      </Card>

      <CancelNfeDialog
        document={doc}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        documentId={doc.id}
      />
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className={mono ? "break-all font-mono text-sm" : "text-sm"}>{value}</p>
    </div>
  );
}
