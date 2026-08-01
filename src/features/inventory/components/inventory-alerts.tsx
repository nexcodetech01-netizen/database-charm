import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Item {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  min_stock?: number;
}

export function LowStockAlerts({
  items,
  waitingByProduct,
}: {
  items: Item[];
  /** Clientes aguardando (Lista de Interesse) por produto — apenas informativo. */
  waitingByProduct?: Record<string, number>;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-danger" />
          Estoque mínimo
        </CardTitle>
        <Badge variant="danger">{items.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Todos os produtos estão acima do mínimo.
          </p>
        )}
        {items.slice(0, 6).map((p) => (
          <Link
            key={p.id}
            to="/estoque/produto/$productId"
            params={{ productId: p.id }}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2 transition hover:border-primary/40"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.sku ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-danger">
                {Number(p.stock).toLocaleString("pt-BR")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                mín. {Number(p.min_stock).toLocaleString("pt-BR")}
              </p>
              {(waitingByProduct?.[p.id] ?? 0) > 0 && (
                <p className="text-[11px] font-medium text-primary">
                  {waitingByProduct?.[p.id]} aguardando
                </p>
              )}
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function StagnantProducts({ items }: { items: Item[] }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-warning" />
          Sem movimento há +90 dias
        </CardTitle>
        <Badge variant="warning">{items.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum produto parado.
          </p>
        )}
        {items.slice(0, 6).map((p) => (
          <Link
            key={p.id}
            to="/estoque/produto/$productId"
            params={{ productId: p.id }}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2 transition hover:border-primary/40"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.sku ?? "—"}</p>
            </div>
            <p className="text-sm font-medium">
              {Number(p.stock).toLocaleString("pt-BR")}
            </p>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
