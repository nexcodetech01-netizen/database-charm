import { Activity } from "lucide-react";
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
import type { ProcessRecord } from "../types";
import { ProcessCategoryBadge } from "./process-category-badge";
import { ProcessStatusBadge } from "./process-status-badge";

export interface ProcessTableProps {
  rows: ProcessRecord[];
  onSelect?: (row: ProcessRecord) => void;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

function formatDuration(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}m ${rest.toString().padStart(2, "0")}s`;
}

export function ProcessTable({ rows, onSelect }: ProcessTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Nenhum processamento encontrado"
        description="Toda tarefa executada em background pelo NexOS aparecerá aqui: importações, exportações, integrações, IA, notificações e mais."
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
                <TableHead>Origem</TableHead>
                <TableHead>Iniciado</TableHead>
                <TableHead>Finalizado</TableHead>
                <TableHead className="text-right">Tempo</TableHead>
                <TableHead>Usuário</TableHead>
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
                      <ProcessCategoryBadge category={row.category} />
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.origin}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.startedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.finishedAt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatDuration(row.durationMs)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.userName}</TableCell>
                  <TableCell>
                    <ProcessStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onSelect?.(row)}
                    >
                      Detalhes
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
