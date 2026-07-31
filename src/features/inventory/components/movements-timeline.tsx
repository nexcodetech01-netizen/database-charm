import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MovementTypeBadge } from "./movement-type-badge";
import { formatDateTime } from "@/lib/format";
import type { InventoryMovement } from "../types";

type Row = InventoryMovement & {
  product: { id: string; name: string; sku: string | null; unit: string } | null;
};

export function MovementsTimeline({
  rows,
  isLoading,
  title = "Timeline",
}: {
  rows: Row[];
  isLoading?: boolean;
  title?: string;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {!isLoading && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem movimentações registradas.
          </p>
        )}
        {!isLoading && rows.length > 0 && (
          <ol className="relative space-y-4 border-l border-border/60 pl-5">
            {rows.map((r) => {
              const isNegative =
                r.type === "out" ||
                (r.type === "adjustment" && Number(r.quantity) < 0);
              return (
                <li key={r.id} className="relative">
                  <span
                    className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-background ${
                      r.type === "in"
                        ? "bg-success"
                        : isNegative
                          ? "bg-danger"
                          : r.type === "adjustment"
                            ? "bg-warning"
                            : "bg-muted-foreground"
                    }`}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {r.product?.name ?? "Produto removido"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(r.movement_date)}
                        {r.reason ? ` • ${r.reason}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MovementTypeBadge type={r.type} />
                      <span
                        className={`text-sm font-medium ${
                          isNegative
                            ? "text-danger"
                            : r.type === "in"
                              ? "text-success"
                              : ""
                        }`}
                      >
                        {isNegative ? "" : r.type === "in" ? "+" : ""}
                        {Number(r.quantity).toLocaleString("pt-BR")}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {r.product?.unit ?? ""}
                        </span>
                      </span>
                    </div>
                  </div>
                  {r.notes && (
                    <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
