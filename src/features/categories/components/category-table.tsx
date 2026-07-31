import { MoreHorizontal, Pencil, Archive, ArchiveRestore, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryWithMeta } from "../types";
import { CategoryIconGlyph } from "./icon-picker";
import { CategoryStatusBadge } from "./category-status-badge";

interface Props {
  rows: CategoryWithMeta[];
  isLoading: boolean;
  onEdit: (c: CategoryWithMeta) => void;
  onArchive: (c: CategoryWithMeta) => void;
  onRestore: (c: CategoryWithMeta) => void;
}

/** Renderiza uma árvore rasa (2 níveis): pais e seus filhos aninhados visualmente. */
export function CategoryTable({ rows, isLoading, onEdit, onArchive, onRestore }: Props) {
  const roots = rows.filter((r) => !r.parent_id);
  const childrenOf = (id: string) => rows.filter((r) => r.parent_id === id);
  // Também exibe categorias filhas cujo pai não está na lista atual (ex: filtro por busca)
  const rootIds = new Set(roots.map((r) => r.id));
  const orphans = rows.filter((r) => r.parent_id && !rootIds.has(r.parent_id));
  const displayRoots = [...roots, ...orphans];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[45%]">Categoria</TableHead>
            <TableHead>Produtos</TableHead>
            <TableHead>Subcategorias</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={5}>
                  <Skeleton className="h-9 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : displayRoots.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                Nenhuma categoria encontrada.
              </TableCell>
            </TableRow>
          ) : (
            displayRoots.flatMap((cat) => {
              const kids = childrenOf(cat.id);
              return [
                <Row
                  key={cat.id}
                  cat={cat}
                  childrenCount={kids.length}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onRestore={onRestore}
                />,
                ...kids.map((k) => (
                  <Row
                    key={k.id}
                    cat={k}
                    childrenCount={0}
                    nested
                    onEdit={onEdit}
                    onArchive={onArchive}
                    onRestore={onRestore}
                  />
                )),
              ];
            })
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

function Row({
  cat,
  childrenCount,
  nested,
  onEdit,
  onArchive,
  onRestore,
}: {
  cat: CategoryWithMeta;
  childrenCount: number;
  nested?: boolean;
  onEdit: (c: CategoryWithMeta) => void;
  onArchive: (c: CategoryWithMeta) => void;
  onRestore: (c: CategoryWithMeta) => void;
}) {
  const isArchived = cat.status === "archived";
  return (
    <TableRow className={isArchived ? "opacity-60" : undefined}>
      <TableCell>
        <div className="flex items-center gap-2.5">
          {nested ? (
            <ChevronRight className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
          ) : null}
          <CategoryIconGlyph name={cat.icon} color={cat.color} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{cat.name}</div>
            {cat.description ? (
              <div className="truncate text-xs text-muted-foreground max-w-md">
                {cat.description}
              </div>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm tabular-nums">{cat.product_count}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm tabular-nums text-muted-foreground">
          {childrenCount}
        </span>
      </TableCell>
      <TableCell>
        <CategoryStatusBadge status={cat.status} />
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Ações</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(cat)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            {isArchived ? (
              <DropdownMenuItem onClick={() => onRestore(cat)}>
                <ArchiveRestore className="mr-2 h-4 w-4" /> Restaurar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onArchive(cat)}>
                <Archive className="mr-2 h-4 w-4" /> Arquivar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
