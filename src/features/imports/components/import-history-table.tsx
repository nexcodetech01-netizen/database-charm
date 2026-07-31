import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { IMPORT_STATUS_LABELS } from "../data";
import type { ImportHistoryEntry, ImportStatus } from "../types";

/**
 * Tabela visual do histórico de importações. Sem lógica: recebe as linhas
 * já formatadas pela página.
 */
export function ImportHistoryTable({
  rows,
}: {
  rows: ImportHistoryEntry[];
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nenhuma importação registrada"
        description="Quando você importar um arquivo, o histórico completo com arquivo, tipo, usuário e status aparecerá aqui."
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
                <TableHead>Arquivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.fileName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.sourceLabel}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(row.date).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.userName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.totalRecords.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
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

function StatusBadge({ status }: { status: ImportStatus }) {
  const label = IMPORT_STATUS_LABELS[status];
  const tone =
    status === "completed"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : status === "failed"
        ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
        : status === "cancelled"
          ? "bg-muted text-muted-foreground"
          : "border-primary/20 bg-primary/10 text-primary";

  return (
    <Badge
      variant="secondary"
      className={`h-5 px-1.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}
    >
      {label}
    </Badge>
  );
}
