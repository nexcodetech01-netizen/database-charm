import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Boxes, DollarSign, AlertTriangle, Activity } from "lucide-react";
import { useInventoryMetrics } from "../hooks/use-inventory";
import { formatCurrency } from "@/lib/format";

export function InventoryMetrics({ companyId }: { companyId: string }) {
  const { data, isLoading } = useInventoryMetrics(companyId);

  const cards = [
    {
      label: "Itens em estoque",
      value: data ? data.totalItems.toLocaleString("pt-BR") : "—",
      hint: `${data?.productCount ?? 0} produtos`,
      icon: Boxes,
      tone: "text-primary",
    },
    {
      label: "Valor total em estoque",
      value: data ? formatCurrency(data.inventoryValue) : "—",
      hint: "Custo × quantidade",
      icon: DollarSign,
      tone: "text-success",
    },
    {
      label: "Abaixo do mínimo",
      value: data ? String(data.belowMin.length) : "—",
      hint: "Requer reposição",
      icon: AlertTriangle,
      tone: "text-danger",
    },
    {
      label: "Movimentações do dia",
      value: data ? String(data.todayMovements) : "—",
      hint: "Entradas, saídas e ajustes",
      icon: Activity,
      tone: "text-warning",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    <p className="text-2xl font-semibold tracking-tight">{c.value}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{c.hint}</p>
                </div>
                <div className={`rounded-lg bg-muted/60 p-2 ${c.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
