import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Columns3, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/layout/empty-state";
import { cn } from "@/lib/utils";
import type { ReportColumn } from "./types";

interface Props<T> {
  columns: ReportColumn<T>[];
  rows: T[];
  emptyLabel?: string;
  storageKey: string;
}

const PAGE_SIZES = [10, 25, 50, 100];

function readCol<T>(col: ReportColumn<T>, row: T): string | number | null | undefined {
  if (col.value) return col.value(row);
  const v = (row as Record<string, unknown>)[col.key];
  return v as string | number | null | undefined;
}

export function ReportTable<T>({ columns, rows, emptyLabel, storageKey }: Props<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [hidden, setHidden] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.sessionStorage.getItem(`nx.report.cols.${storageKey}`);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  const persistHidden = (next: Record<string, boolean>) => {
    setHidden(next);
    try {
      window.sessionStorage.setItem(`nx.report.cols.${storageKey}`, JSON.stringify(next));
    } catch {
      /* noop */
    }
  };

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hidden[c.key]),
    [columns, hidden],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((row) =>
      columns.some((c) => {
        const v = readCol(c, row);
        if (v == null) return false;
        return String(v).toLowerCase().includes(q);
      }),
    );
  }, [rows, columns, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = readCol(col, a);
      const bv = readCol(col, b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "pt-BR", { numeric: true }) * dir;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  );

  const toggleSort = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col || col.sortable === false) return;
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Pesquisar..."
            className="h-8 pl-8 text-sm"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Columns3 className="mr-2 h-3.5 w-3.5" /> Colunas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Exibir colunas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.key}
                checked={!hidden[c.key]}
                onCheckedChange={(v) =>
                  persistHidden({ ...hidden, [c.key]: !v })
                }
              >
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto text-xs text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? "registro" : "registros"}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        {paged.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Sem dados"
              description={emptyLabel ?? "Nada para exibir nesse recorte."}
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                {visibleColumns.map((c) => {
                  const active = sortKey === c.key;
                  const canSort = c.sortable !== false;
                  return (
                    <th
                      key={c.key}
                      className={cn(
                        "px-3 py-2 font-medium",
                        c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                      )}
                    >
                      <button
                        type="button"
                        disabled={!canSort}
                        onClick={() => toggleSort(c.key)}
                        className={cn(
                          "inline-flex items-center gap-1",
                          canSort && "cursor-pointer hover:text-foreground",
                        )}
                      >
                        {c.label}
                        {active ? (
                          sortDir === "asc" ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paged.map((row, i) => (
                <tr key={i} className="border-t border-border/60 hover:bg-accent/30">
                  {visibleColumns.map((c) => {
                    const rendered = c.render
                      ? c.render(row as never)
                      : (readCol(c, row) ?? "—");
                    return (
                      <td
                        key={c.key}
                        className={cn(
                          "px-3 py-2 align-middle",
                          c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : "text-left",
                          c.className,
                        )}
                      >
                        {rendered as React.ReactNode}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Página</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} / página
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </Button>
          <span className="px-2 text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
