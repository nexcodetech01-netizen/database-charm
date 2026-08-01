import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * ActionToolbar (UI.1.4) — barra de ações padrão das telas de entidade.
 *
 * Somente apresentação: dispara callbacks recebidos por props. Não conhece
 * hooks, serviços, rotas, queries ou regras de negócio.
 */
export interface ActionToolbarAction {
  label: string;
  onSelect?: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Intenção destrutiva (usa o token de destaque do menu). */
  destructive?: boolean;
}

export interface ActionToolbarProps {
  onCreate?: () => void;
  createLabel?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  /** Ações extras agrupadas em "Mais ações". */
  moreActions?: ActionToolbarAction[];
  /** Pesquisa opcional (controlada pelo consumidor). */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    id?: string;
  };
  /** Slot livre à direita (dialogs próprios do módulo, filtros…). */
  children?: ReactNode;
  align?: "start" | "end";
  className?: string;
}

export function ActionToolbar({
  onCreate,
  createLabel = "Novo",
  onEdit,
  onDelete,
  onImport,
  onExport,
  moreActions,
  search,
  children,
  align = "end",
  className,
}: ActionToolbarProps) {
  const hasMore = Boolean(moreActions?.length);

  return (
    <div
      data-testid="action-toolbar"
      className={cn(
        "flex flex-wrap items-center gap-2",
        align === "end" ? "justify-end" : "justify-start",
        className,
      )}
    >
      {search ? (
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={search.id}
            data-testid="action-toolbar-search"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder ?? "Pesquisar…"}
            className="h-9 pl-8"
          />
        </div>
      ) : null}

      {children}

      {onImport ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onImport}
          data-testid="action-toolbar-import"
        >
          <Upload className="mr-1.5 h-4 w-4" /> Importar
        </Button>
      ) : null}

      {onExport ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onExport}
          data-testid="action-toolbar-export"
        >
          <Download className="mr-1.5 h-4 w-4" /> Exportar
        </Button>
      ) : null}

      {onEdit ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          data-testid="action-toolbar-edit"
        >
          <Pencil className="mr-1.5 h-4 w-4" /> Editar
        </Button>
      ) : null}

      {onDelete ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          data-testid="action-toolbar-delete"
          className="text-status-danger"
        >
          <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
        </Button>
      ) : null}

      {hasMore ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              aria-label="Mais ações"
              data-testid="action-toolbar-more"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {moreActions?.map((action) => {
              const Icon = action.icon;
              return (
                <DropdownMenuItem
                  key={action.label}
                  disabled={action.disabled}
                  onSelect={action.onSelect}
                  className={cn(action.destructive && "text-status-danger")}
                >
                  {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                  {action.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {onCreate ? (
        <Button size="sm" onClick={onCreate} data-testid="action-toolbar-create">
          <Plus className="mr-1.5 h-4 w-4" /> {createLabel}
        </Button>
      ) : null}
    </div>
  );
}
