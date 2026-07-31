import { Link } from "@tanstack/react-router";
import { Truck, MoreHorizontal, Pencil, Archive, RotateCcw, Trash2 } from "lucide-react";
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
import { formatCurrency, formatDate } from "@/lib/format";
import { SupplierStatusBadge } from "./supplier-status-badge";
import type { SupplierWithMeta } from "../types";

function formatDoc(doc: string | null | undefined) {
  if (!doc) return "—";
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

function formatPhone(phone: string | null | undefined) {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone;
}




interface Props {
  rows: SupplierWithMeta[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onArchive: (s: SupplierWithMeta) => void;
  onRestore: (s: SupplierWithMeta) => void;
  onDelete: (s: SupplierWithMeta) => void;
}

export function SupplierTable({
  rows,
  isLoading,
  total,
  page,
  pageSize,
  onPageChange,
  onArchive,
  onRestore,
  onDelete,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Última compra</TableHead>
              <TableHead className="text-right">Total comprado</TableHead>
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
                    <Truck className="h-8 w-8" />
                    <p className="font-medium text-foreground">
                      Nenhum fornecedor encontrado
                    </p>
                    <p className="text-sm">
                      Ajuste os filtros ou cadastre um novo fornecedor.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      to="/fornecedores/$supplierId"
                      params={{ supplierId: s.id }}
                      className="font-medium hover:text-primary"
                    >
                      {s.name}
                    </Link>
                    {s.legal_name ? (
                      <p className="text-xs text-muted-foreground">{s.legal_name}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatDoc(s.document)}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {formatPhone(s.phone) || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.city ? `${s.city}${s.state ? `/${s.state}` : ""}` : "—"}
                  </TableCell>
                  <TableCell>
                    <SupplierStatusBadge status={s.status} />
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {s.last_purchase_at ? formatDate(s.last_purchase_at) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.total_purchased > 0 ? formatCurrency(s.total_purchased) : "—"}
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
                            to="/fornecedores/$supplierId/editar"
                            params={{ supplierId: s.id }}
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </Link>
                        </DropdownMenuItem>
                        {s.status === "archived" ? (
                          <DropdownMenuItem onClick={() => onRestore(s)}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Restaurar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => onArchive(s)}>
                            <Archive className="mr-2 h-4 w-4" /> Arquivar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDelete(s)}
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
