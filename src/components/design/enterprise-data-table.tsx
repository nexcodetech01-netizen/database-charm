import type { ReactNode } from "react";
import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, MoreHorizontal, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/layout/empty-state";
import { SectionHeader } from "./section-header";
import { RADIUS_TOKENS, SHADOW_TOKENS, TEXT_TOKENS, MOTION_TOKENS } from "@/design";

/**
 * EnterpriseDataTable (UI.1.3) — tabela padrão do Design System NexOS.
 *
 * 100% apresentação: não busca dados, não conhece hooks, services, queries,
 * filtros nem paginação de negócio. Tudo entra por props/callbacks.
 */

export type DataTableAlign = "left" | "right" | "center";

export interface DataTableColumn<T> {
  /** Identificador estável da coluna. */
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: DataTableAlign;
  /** Largura utilitária (ex.: "w-[64px]"). */
  width?: string;
  className?: string;
  headerClassName?: string;
  /** Habilita o clique de ordenação no cabeçalho (controlado por fora). */
  sortable?: boolean;
  /** Esconde a coluna em telas pequenas (responsividade). */
  hideBelow?: "sm" | "md" | "lg";
}

export interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Texto à esquerda; por padrão "1–20 de 120". */
  summary?: ReactNode;
}

export interface EnterpriseDataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;

  /* Toolbar */
  title?: ReactNode;
  description?: ReactNode;
  toolbarActions?: ReactNode;
  /** Campo de pesquisa visual (controlado por fora). */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  /** Slot de filtros já existentes do módulo. */
  filters?: ReactNode;

  /* Estados */
  isLoading?: boolean;
  skeletonRows?: number;
  error?: ReactNode;
  empty?: {
    icon?: LucideIcon;
    title?: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
  };

  /* Linhas */
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  isRowDisabled?: (row: T) => boolean;
  /** Conteúdo extra renderizado abaixo da linha (dialogs, detalhes). */
  renderRowExtra?: (row: T) => ReactNode;

  /* Ações e paginação */
  rowActions?: (row: T) => ReactNode;
  pagination?: DataTablePaginationProps;

  /** Conteúdo livre após a tabela (dialogs do módulo). */
  children?: ReactNode;
  className?: string;
}

const HIDE_BELOW: Record<NonNullable<DataTableColumn<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

const ALIGN: Record<DataTableAlign, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

function columnClass<T>(col: DataTableColumn<T>, extra?: string) {
  return cn(
    ALIGN[col.align ?? "left"],
    col.width,
    col.hideBelow ? HIDE_BELOW[col.hideBelow] : null,
    extra,
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar                                                             */
/* ------------------------------------------------------------------ */

export interface DataTableToolbarProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  search?: EnterpriseDataTableProps<unknown>["search"];
  filters?: ReactNode;
}

export function DataTableToolbar({
  title,
  description,
  actions,
  search,
  filters,
}: DataTableToolbarProps) {
  if (!title && !description && !actions && !search && !filters) return null;
  return (
    <div
      data-testid="data-table-toolbar"
      className="flex flex-col gap-3 px-0 py-3"
    >
      {title || description || actions ? (
        <SectionHeader title={title ?? ""} description={description} actions={actions} />
      ) : null}
      {search || filters ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {search ? (
            <div className="relative w-full sm:max-w-xs">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                data-testid="data-table-search"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? "Pesquisar…"}
                className="pl-8"
              />
            </div>
          ) : null}
          {filters ? <DataTableFilters>{filters}</DataTableFilters> : null}
        </div>
      ) : null}
    </div>
  );
}

export function DataTableFilters({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="data-table-filters"
      className="flex flex-1 flex-wrap items-center gap-2"
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Estados                                                             */
/* ------------------------------------------------------------------ */

export function DataTableLoading({
  columns,
  rows = 5,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i} data-testid="data-table-loading-row">
          {Array.from({ length: columns }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function DataTableEmpty({
  colSpan,
  icon,
  title,
  description,
  action,
}: {
  colSpan: number;
  icon?: LucideIcon;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="p-0">
        <EmptyState
          className="border-0 bg-transparent"
          icon={icon}
          title={title ?? "Nenhum registro encontrado"}
          description={description}
          action={action}
        />
      </TableCell>
    </TableRow>
  );
}

/* ------------------------------------------------------------------ */
/* Ações                                                               */
/* ------------------------------------------------------------------ */

export function DataTableActions({
  children,
  label = "Mais ações",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={label}
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------ */
/* Paginação                                                           */
/* ------------------------------------------------------------------ */

export function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  summary,
}: DataTablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div
      data-testid="data-table-pagination"
      className={cn(
        "flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        TEXT_TOKENS.sm,
      )}
    >
      <span className="text-muted-foreground">
        {summary ??
          (total > 0
            ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`
            : "0 resultados")}
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
  );
}

/* ------------------------------------------------------------------ */
/* Tabela                                                              */
/* ------------------------------------------------------------------ */

export function EnterpriseDataTable<T>({
  columns,
  rows,
  getRowId,
  title,
  description,
  toolbarActions,
  search,
  filters,
  isLoading = false,
  skeletonRows = 5,
  error,
  empty,
  onRowClick,
  isRowSelected,
  isRowDisabled,
  renderRowExtra,
  rowActions,
  pagination,
  children,
  className,
}: EnterpriseDataTableProps<T>) {
  const allColumns: DataTableColumn<T>[] = rowActions
    ? [
        ...columns,
        {
          id: "__actions",
          header: "Ações",
          align: "right" as const,
          width: "w-24",
          cell: (row: T) => (
            <div className="flex items-center justify-end gap-1">{rowActions(row)}</div>
          ),
        },
      ]
    : columns;

  const colSpan = allColumns.length;

  return (
    <div
      data-testid="enterprise-data-table"
      className={cn(
        "overflow-hidden border-none bg-transparent text-card-foreground shadow-none",
        className,
      )}
    >
      <DataTableToolbar
        title={title}
        description={description}
        actions={toolbarActions}
        search={search as DataTableToolbarProps["search"]}
        filters={filters}
      />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {allColumns.map((col) => (
                <TableHead
                  key={col.id}
                  data-sortable={col.sortable ? "true" : undefined}
                  className={columnClass(col, col.headerClassName)}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <DataTableLoading columns={colSpan} rows={skeletonRows} />
            ) : error ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="p-0">
                  <EmptyState
                    className="border-0 bg-transparent"
                    icon={AlertTriangle}
                    title="Não foi possível carregar os dados"
                    description={error}
                  />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <DataTableEmpty
                colSpan={colSpan}
                icon={empty?.icon}
                title={empty?.title}
                description={empty?.description}
                action={empty?.action}
              />
            ) : (
              rows.map((row) => {
                const disabled = isRowDisabled?.(row) ?? false;
                const selected = isRowSelected?.(row) ?? false;
                const clickable = !!onRowClick && !disabled;
                return (
                  <Fragment key={getRowId(row)}>
                    <TableRow
                      data-selected={selected ? "true" : undefined}
                      data-disabled={disabled ? "true" : undefined}
                      aria-disabled={disabled || undefined}
                      onClick={clickable ? () => onRowClick?.(row) : undefined}
                      className={cn(
                        "transition-colors",
                        MOTION_TOKENS.fast,
                        clickable && "cursor-pointer",
                        selected && "bg-accent/60",
                        disabled && "pointer-events-none opacity-50",
                      )}
                    >
                      {allColumns.map((col) => (
                        <TableCell key={col.id} className={columnClass(col, col.className)}>
                          {col.cell(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                    {renderRowExtra?.(row)}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pagination ? <DataTablePagination {...pagination} /> : null}
      {children}
    </div>
  );
}
