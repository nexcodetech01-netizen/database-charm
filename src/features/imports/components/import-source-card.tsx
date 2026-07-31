import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { IMPORT_SOURCE_ICON } from "../icons";
import type { ImportSource } from "../types";

/**
 * Card visual (sem lógica) que representa uma fonte de importação no
 * dashboard do módulo Importações.
 */
export function ImportSourceCard({
  source,
  onImport,
  className,
}: {
  source: ImportSource;
  onImport: (source: ImportSource) => void;
  className?: string;
}) {
  const Icon = IMPORT_SOURCE_ICON[source.id];
  const disabled = source.status === "coming_soon";

  return (
    <Card
      className={cn(
        "group flex flex-col overflow-hidden transition-colors hover:border-primary/40",
        className,
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <SourceStatusBadge status={source.status} />
        </div>

        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {source.title}
          </h3>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {source.description}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-[11px] text-muted-foreground">
          <span className="truncate">
            {source.lastImportAt
              ? `Última: ${new Date(source.lastImportAt).toLocaleDateString("pt-BR")}`
              : "Nenhuma importação"}
          </span>
          <Button
            size="sm"
            variant={disabled ? "outline" : "default"}
            className="h-7 px-3 text-xs"
            onClick={() => onImport(source)}
          >
            Importar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceStatusBadge({ status }: { status: ImportSource["status"] }) {
  if (status === "ready") {
    return (
      <Badge
        variant="secondary"
        className="h-5 border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400"
      >
        Disponível
      </Badge>
    );
  }
  if (status === "beta") {
    return (
      <Badge
        variant="secondary"
        className="h-5 border-warning/20 bg-warning/10 px-1.5 text-[10px] font-medium uppercase tracking-wide text-warning"
      >
        Beta
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="h-5 bg-muted px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
    >
      Em breve
    </Badge>
  );
}
