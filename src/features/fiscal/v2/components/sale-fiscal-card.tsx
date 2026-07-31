import { formatAccessKey } from "../lib/access-key";
import { useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Mail,
  RefreshCw,
  RotateCcw,
  Eye,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateTime } from "@/lib/format";
import { FiscalStatusBadge } from "./fiscal-status-badge";
import { CancelNfeDialog } from "./cancel-nfe-dialog";
import { evaluateCancelEligibility } from "../lib/cancellation";
import {
  useDiscardFiscalDocument,
  useFiscalArtifact,
  useRefreshFiscalStatus,
  useSaleFiscalDocument,
} from "../hooks/use-fiscal";
import { buildXmlFileName, downloadFile } from "../lib/xml-file";
import { XmlViewerDialog } from "./xml-viewer-dialog";

interface Props {
  saleId: string;
  saleNumber?: number | string | null;
  customerName?: string | null;
  customerEmail?: string | null;
}

/**
 * Card "Documento Fiscal" da tela de detalhes da venda.
 *
 * Reflete em tempo real o estado da NF-e vinculada à venda (o hook
 * `useSaleFiscalDocument` escuta `fiscal_documents` por `sale_id`), de modo
 * que a autorização atualiza a venda automaticamente, sem refresh manual.
 */
export function SaleFiscalCard({
  saleId,
  saleNumber,
  customerName,
  customerEmail,
}: Props) {
  const { data: doc, isLoading } = useSaleFiscalDocument(saleId);
  const artifact = useFiscalArtifact();
  const refresh = useRefreshFiscalStatus();
  const discard = useDiscardFiscalDocument();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [xmlOpen, setXmlOpen] = useState(false);

  if (isLoading || !doc) return null;

  // "Autorizada" exige prova: chave de acesso + protocolo.
  const authorized =
    doc.status === "authorized" && Boolean(doc.accessKey) && Boolean(doc.protocol);
  const cancelled = doc.status === "cancelled";
  const inFlight = ["draft", "validating", "signing", "sending"].includes(doc.status);
  const xmlPath = doc.xmlAuthorizedPath ?? doc.xmlSignedPath;
  // Reemissão só é liberada para tentativas que nunca chegaram à SEFAZ.
  const canDiscard =
    (doc.status === "error" || doc.status === "rejected") &&
    !doc.accessKey &&
    !doc.protocol;

  async function openArtifact(path: string | null | undefined) {
    if (!path) {
      toast.error("Arquivo ainda não disponível.");
      return;
    }
    const { url } = await artifact.mutateAsync(path);
    window.open(url, "_blank", "noopener");
  }

  async function downloadXml() {
    if (!xmlPath) {
      toast.error("Arquivo ainda não disponível.");
      return;
    }
    try {
      const { url } = await artifact.mutateAsync(xmlPath);
      await downloadFile(url, buildXmlFileName(doc!));
    } catch {
      toast.error("Não foi possível baixar o XML.");
    }
  }

  const cancelEligibility = evaluateCancelEligibility(doc);

  async function copyKey() {
    if (!doc?.accessKey) return;
    try {
      await navigator.clipboard.writeText(formatAccessKey(doc.accessKey, ""));
      setCopied(true);
      toast.success("Chave de acesso copiada.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar a chave.");
    }
  }

  async function sendByEmail() {
    if (!doc) return;
    let danfeUrl = "";
    try {
      if (doc.danfePath) {
        const { url } = await artifact.mutateAsync(doc.danfePath);
        danfeUrl = url;
      }
    } catch {
      /* segue sem link — o e-mail ainda leva os dados da NF-e */
    }
    const subject = `NF-e ${doc.number ?? ""} — série ${doc.series ?? 1}`;
    const body = [
      `Olá${customerName ? ` ${customerName}` : ""},`,
      "",
      "Segue o documento fiscal referente à sua compra:",
      "",
      `Número: ${doc.number ?? "—"}`,
      `Série: ${doc.series ?? 1}`,
      `Chave de acesso: ${formatAccessKey(doc.accessKey)}`,
      `Protocolo: ${doc.protocol ?? "—"}`,
      doc.protocolAt ? `Autorizada em: ${formatDateTime(doc.protocolAt)}` : "",
      saleNumber ? `Venda: ${saleNumber}` : "",
      danfeUrl ? "" : null,
      danfeUrl ? `DANFE (link temporário): ${danfeUrl}` : null,
    ]
      .filter((l) => l !== null)
      .join("\n");
    window.location.href = `mailto:${customerEmail ?? ""}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Documento Fiscal
            <FiscalStatusBadge
              status={doc.status}
              accessKey={doc.accessKey}
              protocol={doc.protocol}
            />
            {doc.environment === "production" ? (
              <Badge variant="outline" className="text-[10px] uppercase">
                Produção
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-warning/40 bg-warning/10 text-[10px] uppercase text-warning"
              >
                🟠 Homologação
              </Badge>
            )}
          </CardTitle>
          <p className="mt-1 text-sm">
            {authorized ? (
              <span className="font-medium text-success">🟢 NF-e Autorizada</span>
            ) : cancelled ? (
              <span className="font-medium text-destructive">NF-e cancelada</span>
            ) : inFlight ? (
              <span className="text-muted-foreground">
                NF-e em processamento na SEFAZ…
              </span>
            ) : (
              <span className="font-medium text-destructive">
                {doc.rejectionReason ?? "NF-e não autorizada."}
              </span>
            )}
          </p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/fiscal/notas/$documentId" params={{ documentId: doc.id }}>
            <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir NF-e
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {doc.environment === "homologation" ? (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs font-medium text-warning">
            🟠 HOMOLOGAÇÃO — Documento sem validade fiscal. Esta venda é uma
            venda de teste e não entra em caixa, dashboards ou relatórios de
            produção.
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Número" value={doc.number != null ? String(doc.number) : "—"} mono />
          <Info label="Série" value={String(doc.series ?? 1)} mono />
          <Info
            label="Data/Hora"
            value={
              doc.protocolAt
                ? formatDateTime(doc.protocolAt)
                : formatDateTime(doc.createdAt)
            }
          />
          <Info label="Protocolo" value={doc.protocol ?? "—"} mono />
          <div className="sm:col-span-2 lg:col-span-3">
            <Info label="Chave de acesso" value={formatAccessKey(doc.accessKey)} mono />
          </div>
          {cancelled ? (
            <div className="sm:col-span-2 lg:col-span-3 space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <div>
                Protocolo de cancelamento:{" "}
                <span className="font-mono">{doc.cancellationProtocol ?? "—"}</span>
              </div>
              <div>
                Cancelada em:{" "}
                {doc.cancelledAt ? formatDateTime(doc.cancelledAt) : "—"}
              </div>
              {doc.cancellationReason ? (
                <div>Justificativa: {doc.cancellationReason}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!doc.danfePath || artifact.isPending}
            onClick={() => openArtifact(doc.danfePath)}
          >
            <FileText className="mr-1.5 h-4 w-4" /> Visualizar DANFE
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!xmlPath}
            onClick={() => setXmlOpen(true)}
          >
            <Eye className="mr-1.5 h-4 w-4" /> Visualizar XML
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!xmlPath || artifact.isPending}
            onClick={downloadXml}
          >
            <Download className="mr-1.5 h-4 w-4" /> Baixar XML
          </Button>
          <XmlViewerDialog
            open={xmlOpen}
            onOpenChange={setXmlOpen}
            path={xmlPath}
            doc={doc}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!doc.accessKey}
            onClick={copyKey}
          >
            {copied ? (
              <Check className="mr-1.5 h-4 w-4" />
            ) : (
              <Copy className="mr-1.5 h-4 w-4" />
            )}
            Copiar chave
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!authorized || artifact.isPending}
            onClick={sendByEmail}
          >
            <Mail className="mr-1.5 h-4 w-4" /> Enviar por e-mail
          </Button>
          {inFlight ? (
            <Button
              size="sm"
              variant="outline"
              disabled={refresh.isPending}
              onClick={() => refresh.mutate(doc.id)}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" /> Consultar SEFAZ
            </Button>
          ) : null}
          {canDiscard ? (
            <Button
              size="sm"
              variant="outline"
              disabled={discard.isPending}
              onClick={() => setDiscardOpen(true)}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" /> Descartar tentativa e emitir
              novamente
            </Button>
          ) : null}
          {authorized ? (
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
      </CardContent>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar tentativa e emitir novamente?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento atual será marcado como <strong>descartado</strong> e
              permanecerá no histórico fiscal — nada é apagado. A venda ficará
              liberada para gerar uma nova NF-e, com nova referência e o fluxo
              completo executado do início.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discard.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={discard.isPending}
              onClick={(e) => {
                e.preventDefault();
                discard.mutate(
                  { documentId: doc!.id, reason: "Reemissão" },
                  { onSuccess: () => setDiscardOpen(false) },
                );
              }}
            >
              Descartar e liberar reemissão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CancelNfeDialog
        document={doc}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        documentId={doc.id}
      />
    </Card>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={mono ? "break-all font-mono text-sm" : "text-sm"}>{value}</p>
    </div>
  );
}
