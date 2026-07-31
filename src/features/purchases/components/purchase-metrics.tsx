import { ShoppingCart, DollarSign, Clock, Truck } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { usePurchaseMetrics } from "../hooks/use-purchases";

export function PurchaseMetrics({ companyId }: { companyId: string }) {
  const { data, isLoading } = usePurchaseMetrics(companyId);
  const items = [
    {
      label: "Compras do mês",
      value: data ? formatNumber(data.monthCount) : undefined,
      icon: ShoppingCart,
    },
    {
      label: "Valor total comprado",
      value: data ? formatCurrency(data.monthTotal) : undefined,
      icon: DollarSign,
      tone: "text-success",
    },
    {
      label: "Pedidos pendentes",
      value: data ? formatNumber(data.pending) : undefined,
      icon: Clock,
      tone: "text-warning",
    },
    {
      label: "Fornecedores ativos",
      value: data ? formatNumber(data.activeSuppliers) : undefined,
      icon: Truck,
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div
            key={it.label}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{it.label}</span>
              <div className="grid h-8 w-8 place-items-center rounded-md bg-accent">
                <Icon className={`h-4 w-4 ${it.tone ?? "text-primary"}`} />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <span className="text-2xl font-semibold tracking-tight">
                  {it.value ?? "—"}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
