import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileSignature,
  Info,
  Mail,
  MessageCircle,
  Copy,
  Archive,
  Share2,
  Eye,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_FORMAT_LABELS,
  DOCUMENT_ORIGIN_LABELS,
} from "../data";
import type {
  DocumentHistoryEvent,
  DocumentRecord,
  DocumentShare,
} from "../types";
import { DocumentTypeBadge } from "./document-type-badge";
import { DocumentStatusBadge } from "./document-status-badge";

export interface DocumentDetailDrawerProps {
  document: DocumentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function formatSize(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentDetailDrawer({
  document,
  open,
  onOpenChange,
}: DocumentDetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {document ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="space-y-3 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <DocumentTypeBadge type={document.type} />
                <DocumentStatusBadge status={document.status} />
                <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {DOCUMENT_FORMAT_LABELS[document.format]}
                </span>
              </div>
              <SheetTitle className="text-lg">{document.name}</SheetTitle>
              <SheetDescription>
                {DOCUMENT_ORIGIN_LABELS[document.origin]}
                {document.customerName ? ` · ${document.customerName}` : ""}
              </SheetDescription>
            </SheetHeader>

            <Separator />

            <ScrollArea className="flex-1">
              <div className="space-y-6 py-4 pr-2">
                <PreviewBlock />
                <ActionsBlock />
                <MetadataBlock document={document} />
                <HistoryBlock history={document.history ?? []} />
                <SharesBlock shares={document.shares ?? []} />
              </div>
            </ScrollArea>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PreviewBlock() {
  return (
    <section aria-labelledby="detail-preview" className="space-y-3">
      <h3
        id="detail-preview"
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        <Eye className="h-3.5 w-3.5" /> Preview
      </h3>
      <div className="grid h-48 place-items-center rounded-md border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
        Pré-visualização aparecerá aqui
      </div>
    </section>
  );
}

function ActionsBlock() {
  const items = [
    { label: "Baixar", icon: Download },
    { label: "Compartilhar", icon: Share2 },
    { label: "WhatsApp", icon: MessageCircle },
    { label: "Email", icon: Mail },
    { label: "Assinar", icon: FileSignature },
    { label: "Duplicar", icon: Copy },
    { label: "Arquivar", icon: Archive },
  ];
  return (
    <section aria-labelledby="detail-actions" className="space-y-3">
      <h3
        id="detail-actions"
        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Ações
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map(({ label, icon: Icon }) => (
          <Button
            key={label}
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
      </div>
    </section>
  );
}

function MetadataBlock({ document }: { document: DocumentRecord }) {
  return (
    <section aria-labelledby="detail-metadata" className="space-y-3">
      <h3
        id="detail-metadata"
        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Metadados
      </h3>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Criado em" value={formatDate(document.createdAt)} />
        <Field label="Autor" value={document.createdByName} />
        <Field label="Tamanho" value={formatSize(document.sizeBytes)} />
        <Field
          label="Formato"
          value={DOCUMENT_FORMAT_LABELS[document.format]}
        />
        <Field label="Origem" value={DOCUMENT_ORIGIN_LABELS[document.origin]} />
        <Field
          label="Downloads"
          value={(document.downloads ?? 0).toLocaleString("pt-BR")}
        />
        <Field
          label="ID"
          value={<span className="font-mono text-xs">{document.id}</span>}
        />
      </dl>
      {document.summary ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {document.summary}
        </p>
      ) : null}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function HistoryBlock({ history }: { history: DocumentHistoryEvent[] }) {
  return (
    <section aria-labelledby="detail-history" className="space-y-3">
      <h3
        id="detail-history"
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        <Clock className="h-3.5 w-3.5" /> Histórico
      </h3>
      {history.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Nenhum evento registrado ainda.
        </p>
      ) : (
        <ol className="space-y-3 border-l border-border pl-4">
          {history.map((event) => {
            const Icon =
              event.intent === "success"
                ? CheckCircle2
                : event.intent === "error"
                  ? AlertCircle
                  : Info;
            return (
              <li key={event.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[22px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-background",
                    event.intent === "success" && "text-emerald-500",
                    event.intent === "error" && "text-red-500",
                    event.intent === "warning" && "text-amber-500",
                    (!event.intent || event.intent === "info") && "text-primary",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <p className="text-sm font-medium text-foreground">{event.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(event.at)}
                </p>
                {event.detail ? (
                  <p className="mt-1 text-xs text-muted-foreground">{event.detail}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function SharesBlock({ shares }: { shares: DocumentShare[] }) {
  return (
    <section aria-labelledby="detail-shares" className="space-y-3">
      <h3
        id="detail-shares"
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        <Share2 className="h-3.5 w-3.5" /> Compartilhamentos
      </h3>
      {shares.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Nenhum compartilhamento registrado.
        </p>
      ) : (
        <ul className="space-y-2">
          {shares.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-xs"
            >
              <span className="flex items-center gap-2 text-foreground">
                {s.channel === "whatsapp" ? (
                  <MessageCircle className="h-3.5 w-3.5" />
                ) : s.channel === "email" ? (
                  <Mail className="h-3.5 w-3.5" />
                ) : (
                  <Share2 className="h-3.5 w-3.5" />
                )}
                {s.target}
              </span>
              <span className="text-muted-foreground">{formatDate(s.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
