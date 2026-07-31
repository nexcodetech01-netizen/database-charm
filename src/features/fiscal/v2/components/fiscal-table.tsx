import { formatAccessKey } from "../lib/access-key";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, FileX } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState, ListSkeleton } from "@/components/layout";
import { formatCurrency } from "@/lib/format";
import { FiscalStatusBadge } from "./fiscal-status-badge";
import { FiscalEnvironmentBadge } from "./fiscal-environment";
import type { FiscalDocumentDto } from "../functions/fiscal.functions";

interface Props {
  documents: FiscalDocumentDto[] | undefined;
  isLoading: boolean;
  onSelect?: (documentId: string) => void;
}

export function FiscalTable({ documents, isLoading, onSelect }: Props) {
  if (isLoading) return <ListSkeleton rows={6} />;
  if (!documents || documents.length === 0) {
    return (
      <EmptyState
        icon={FileX}
        title="Nenhuma NF-e encontrada"
        description="Emita uma NF-e a partir de uma venda ou ajuste os filtros."
      />
    );
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número / Série</TableHead>
            <TableHead>Chave de acesso</TableHead>
            <TableHead>Emissão</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Ambiente</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((d) => (
            <TableRow
              key={d.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelect?.(d.id)}
            >
              <TableCell className="font-medium">
                {d.number ? `${d.number} / ${d.series ?? 1}` : "—"}
              </TableCell>
              <TableCell className="font-mono text-xs">{formatAccessKey(d.accessKey)}</TableCell>
              <TableCell>
                {format(new Date(d.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </TableCell>
              <TableCell className="text-right">{formatCurrency(d.totalAmount)}</TableCell>
              <TableCell>
                <FiscalEnvironmentBadge environment={d.environment} />
              </TableCell>
              <TableCell>
                <FiscalStatusBadge
                  status={d.status}
                  accessKey={d.accessKey}
                  protocol={d.protocol}
                />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.(d.id);
                  }}
                  aria-label="Abrir detalhes"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
