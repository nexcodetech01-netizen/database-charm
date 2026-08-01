import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Archive, Pencil, RotateCcw, Trash2, Eye, Users } from "lucide-react";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  DataTableActions,
  EnterpriseDataTable,
  type DataTableColumn,
} from "@/components/design";
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

  const columns: DataTableColumn<Customer>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Cliente",
        cell: (c) => (
          <>
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
          </>
        ),
      },
      {
        id: "contact",
        header: "Contato",
        className: "text-muted-foreground",
        cell: (c) => (
          <>
            <div className="truncate">{c.email ?? "—"}</div>
            <div className="text-xs">{c.phone ?? c.whatsapp ?? ""}</div>
          </>
        ),
      },
      {
        id: "city",
        header: "Cidade/UF",
        className: "text-muted-foreground",
        hideBelow: "md",
        cell: (c) => (c.city ? `${c.city}${c.state ? ` / ${c.state}` : ""}` : "—"),
      },
      {
        id: "segment",
        header: "Segmento",
        className: "text-muted-foreground",
        hideBelow: "lg",
        cell: (c) => c.segment ?? "—",
      },
      {
        id: "last_interaction",
        header: "Última interação",
        className: "text-muted-foreground",
        hideBelow: "md",
        cell: (c) => fmtDate(c.last_interaction_at),
      },
      {
        id: "status",
        header: "Status",
        cell: (c) => <CustomerStatusBadge status={c.status} />,
      },
    ],
    [],
  );

  return (
    <EnterpriseDataTable<Customer>
      rows={rows}
      columns={columns}
      getRowId={(c) => c.id}
      isLoading={isLoading}
      skeletonRows={6}
      empty={{
        icon: Users,
        title: "Nenhum cliente encontrado",
        description: "Ajuste os filtros ou cadastre um novo cliente.",
      }}
      pagination={{
        page,
        pageSize,
        total,
        onPageChange,
        summary: `${total} cliente${total === 1 ? "" : "s"} · página ${page} de ${totalPages}`,
      }}
      rowActions={(c) => (
        <DataTableActions>
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
        </DataTableActions>
      )}
    />
  );
}
