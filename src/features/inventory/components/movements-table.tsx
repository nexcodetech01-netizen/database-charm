import { Link } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MovementTypeBadge } from "./movement-type-badge";
import { formatDateTime } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { InventoryMovement } from "../types";

type Row = InventoryMovement & {
  product: { id: string; name: string; sku: string | null; unit: string } | null;
};

import { MOVEMENT_SOURCE_LABEL } from "../types";
import type { MovementSource } from "../types";

interface Props {
  rows: Row[];
  total: number;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  compact?: boolean;
}

export function MovementsTable({
  rows,
  total,
  isLoading,
  page,
  pageSize,
  onPageChange,
  compact,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="rounded-xl border border-border/60 bg-card">
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Quantidade</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Referência</TableHead>
            <TableHead>Data</TableHead>
            {!compact && <TableHead>Observações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={compact ? 6 : 7}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={compact ? 6 : 7}
                className="py-12 text-center text-sm text-muted-foreground"
              >
                Nenhuma movimentação encontrada.
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            rows.map((r) => {
              const isNegative =
                r.type === "out" || (r.type === "adjustment" && Number(r.quantity) < 0);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.product ? (
                      <Link
                        to="/estoque/produto/$productId"
                        params={{ productId: r.product.id }}
                        className="font-medium hover:text-primary"
                      >
                        {r.product.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {r.product?.sku && (
                      <p className="text-xs text-muted-foreground">{r.product.sku}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <MovementTypeBadge type={r.type} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span
                      className={
                        isNegative ? "text-danger" : r.type === "in" ? "text-success" : ""
                      }
                    >
                      {isNegative ? (
                        <ArrowDownRight className="mr-1 inline h-3.5 w-3.5" />
                      ) : r.type === "in" ? (
                        <ArrowUpRight className="mr-1 inline h-3.5 w-3.5" />
                      ) : null}
                      {Number(r.quantity).toLocaleString("pt-BR")}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        {r.product?.unit ?? ""}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.source ? MOVEMENT_SOURCE_LABEL[r.source as MovementSource] ?? r.source : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.reference_number ?? r.reason ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{formatDateTime(r.movement_date)}</TableCell>
                  {!compact && (
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                      {r.notes ?? "—"}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
      </div>


      {!compact && total > 0 && (
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {total.toLocaleString("pt-BR")} movimentação(ões)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
