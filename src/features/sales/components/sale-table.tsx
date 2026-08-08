import { Link } from "@tanstack/react-router";
import {
  Receipt,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  Ban,
  Clock,
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
import { SaleStatusBadge } from "./sale-status-badge";
import { Badge } from "@/components/ui/badge";
import { TestSaleBadge } from "./test-sale-badge";
import type { SaleWithMeta } from "../types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

interface Props {
  rows: SaleWithMeta[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onMarkPending: (s: SaleWithMeta) => void;
  onMarkPaid: (s: SaleWithMeta) => void;
  onCancel: (s: SaleWithMeta) => void;
  onDelete: (s: SaleWithMeta) => void;
}

export function SaleTable({
  rows,
  isLoading,
  total,
  page,
  pageSize,
  onPageChange,
  onMarkPending,
  onMarkPaid,
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
              <TableHead>Cliente</TableHead>
              <TableHead>Data da venda</TableHead>
              <TableHead>Data do pagamento</TableHead>
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
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16">

                  <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                    <Receipt className="h-8 w-8" />
                    <p className="font-medium text-foreground">
                      Nenhuma venda encontrada
                    </p>
                    <p className="text-sm">
                      Registre uma nova venda ou ajuste os filtros.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      to="/vendas/$saleId"
                      params={{ saleId: s.id }}
                      className="font-mono text-sm font-medium hover:text-primary"
                    >
                      {s.number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.customer_name ?? (
                      <span className="text-muted-foreground">Sem cliente</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(s.sale_date)}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {s.settlement_paid_at ? (
                      formatDateTime(s.settlement_paid_at)
                    ) : (
                      <span className="text-muted-foreground">Pendente</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    {s.items_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCurrency(Number(s.grand_total))}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SaleStatusBadge status={s.status} />
                      {s.is_test ? <TestSaleBadge compact /> : null}
                      {(s.payment_method === "a_receber" || (s.status === "pending" && !s.payment_method)) &&
                      s.status !== "cancelled" &&
                      s.status !== "paid" ? (
                        <Badge
                          variant="outline"
                          className="border-warning/30 bg-warning/10 text-warning"
                        >
                          {s.payment_method === "a_receber" ? "A Receber" : "Pagamento Pendente"}
                        </Badge>
                      ) : null}
                    </div>
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
                            to="/vendas/$saleId/editar"
                            params={{ saleId: s.id }}
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </Link>
                        </DropdownMenuItem>
                        {s.status === "draft" ? (
                          <DropdownMenuItem onClick={() => onMarkPending(s)}>
                            <Clock className="mr-2 h-4 w-4" /> Marcar pendente
                          </DropdownMenuItem>
                        ) : null}
                        {s.status !== "paid" && s.status !== "cancelled" ? (
                          <DropdownMenuItem onClick={() => onMarkPaid(s)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {s.status === "partially_paid" ? "Receber saldo" : "Dar baixa"}
                          </DropdownMenuItem>
                        ) : null}
                        {s.status !== "cancelled" ? (
                          <DropdownMenuItem onClick={() => onCancel(s)}>
                            <Ban className="mr-2 h-4 w-4" /> Cancelar
                          </DropdownMenuItem>
                        ) : null}
                        {s.status !== "paid" && s.status !== "cancelled" ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => onDelete(s)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </>
                        ) : null}
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
