import { Link } from "@tanstack/react-router";
import { Archive, MoreHorizontal, Pencil, RotateCcw, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerStatusBadge } from "./customer-status-badge";
import type { Customer } from "../types";

interface Props {
  rows: Customer[];
  total: number;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onArchive: (c: Customer) => void;
  onRestore: (c: Customer) => void;
  onDelete: (c: Customer) => void;
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR");
}

export function CustomerTable({
  rows,
  total,
  isLoading,
  page,
  pageSize,
  onPageChange,
  onArchive,
  onRestore,
  onDelete,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Cliente</th>
              <th className="px-4 py-3 text-left font-medium">Contato</th>
              <th className="px-4 py-3 text-left font-medium">Cidade/UF</th>
              <th className="px-4 py-3 text-left font-medium">Segmento</th>
              <th className="px-4 py-3 text-left font-medium">Última interação</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td colSpan={7} className="px-4 py-3">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center text-muted-foreground">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      to="/clientes/$customerId"
                      params={{ customerId: c.id }}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {c.name}
                    </Link>
                    {c.document ? (
                      <div className="text-xs text-muted-foreground">{c.document}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="truncate">{c.email ?? "—"}</div>
                    <div className="text-xs">{c.phone ?? c.whatsapp ?? ""}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.city ? `${c.city}${c.state ? ` / ${c.state}` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.segment ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {fmtDate(c.last_interaction_at)}
                  </td>
                  <td className="px-4 py-3">
                    <CustomerStatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to="/clientes/$customerId" params={{ customerId: c.id }}>
                            <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/clientes/$customerId/editar" params={{ customerId: c.id }}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {c.status === "archived" ? (
                          <DropdownMenuItem onClick={() => onRestore(c)}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Restaurar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => onArchive(c)}>
                            <Archive className="mr-2 h-4 w-4" /> Arquivar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => onDelete(c)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
        <span>
          {total} cliente{total === 1 ? "" : "s"} · página {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </Button>
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
