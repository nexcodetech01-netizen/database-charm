import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/layout/empty-state";
import { DOCUMENT_ORIGIN_LABELS } from "../data";
import type { DocumentRecord } from "../types";
import { DocumentTypeBadge } from "./document-type-badge";
import { DocumentStatusBadge } from "./document-status-badge";

export interface DocumentTableProps {
  rows: DocumentRecord[];
  onSelect?: (row: DocumentRecord) => void;
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

export function DocumentTable({ rows, onSelect }: DocumentTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Nenhum documento encontrado"
        description="Todo arquivo gerado pelo NexOS — pedidos, orçamentos, recibos, DANFEs, etiquetas, contratos e relatórios — vai aparecer aqui."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Tamanho</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="min-w-[220px]">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">{row.name}</span>
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {row.format}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DocumentTypeBadge type={row.type} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {DOCUMENT_ORIGIN_LABELS[row.origin]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.customerName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.createdAt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatSize(row.sizeBytes)}
                  </TableCell>
                  <TableCell>
                    <DocumentStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onSelect?.(row)}
                    >
                      Abrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
