import { Link } from "@tanstack/react-router";
import {
  ShoppingCart,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  Ban,
  Clock,
  Plus,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PurchaseStatusBadge } from "./purchase-status-badge";
import type { PurchaseWithMeta } from "../types";
import { formatCurrency, formatDate } from "@/lib/format";

interface Props {
  rows: PurchaseWithMeta[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onMarkPending: (p: PurchaseWithMeta) => void;
  onMarkReceived: (p: PurchaseWithMeta) => void;
  onCancel: (p: PurchaseWithMeta) => void;
  onDelete: (p: PurchaseWithMeta) => void;
}

export function PurchaseTable({
  rows,
  isLoading,
  total,
  page,
  pageSize,
  onPageChange,
  onMarkPending,
  onMarkReceived,
  onCancel,
  onDelete,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Itens</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[52px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="rounded-full bg-muted p-4">
                      <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-lg text-foreground">
                        Nenhuma compra encontrada
                      </p>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        Registre suas entradas de mercadorias manualmente ou importe pedidos em PDF para automação.
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button asChild size="sm">
                        <Link to="/compras/novo">
                          <Plus className="mr-1.5 h-4 w-4" /> Nova compra
                        </Link>
                      </Button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      to="/compras/$purchaseId"
                      params={{ purchaseId: p.id }}
                      className="font-mono text-sm font-medium hover:text-primary"
                    >
                      {p.number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.supplier_name ?? (
                      <span className="text-muted-foreground">Sem fornecedor</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(p.purchase_date)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.items_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCurrency(Number(p.grand_total))}
                  </TableCell>
                  <TableCell>
                    <PurchaseStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            to="/compras/$purchaseId/editar"
                            params={{ purchaseId: p.id }}
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </Link>
                        </DropdownMenuItem>
                        {p.status === "draft" ? (
                          <DropdownMenuItem onClick={() => onMarkPending(p)}>
                            <Clock className="mr-2 h-4 w-4" /> Marcar pendente
                          </DropdownMenuItem>
                        ) : null}
                        {p.status !== "received" && p.status !== "cancelled" ? (
                          <DropdownMenuItem onClick={() => onMarkReceived(p)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar recebida
                          </DropdownMenuItem>
                        ) : null}
                        {p.status !== "cancelled" ? (
                          <DropdownMenuItem onClick={() => onCancel(p)}>
                            <Ban className="mr-2 h-4 w-4" /> Cancelar
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDelete(p)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          {total > 0
            ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`
            : "0 resultados"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground">
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
    </div>
  );
}
