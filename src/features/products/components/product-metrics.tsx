import { Package, CheckCircle2, AlertTriangle, Wallet } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useProductMetrics } from "../hooks/use-products";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  companyId: string;
}

export function ProductMetrics({ companyId }: Props) {
  const { data, isLoading } = useProductMetrics(companyId);

  const items = [
    {
      label: "Total de produtos",
      value: data ? formatNumber(data.total) : "—",
      icon: Package,
    },
    {
      label: "Produtos ativos",
      value: data ? formatNumber(data.active) : "—",
      icon: CheckCircle2,
      tone: "text-success",
    },
    {
      label: "Estoque crítico",
      value: data ? formatNumber(data.critical) : "—",
      icon: AlertTriangle,
      tone: "text-warning",
    },
    {
      label: "Valor em estoque",
      value: data ? formatCurrency(data.inventoryValue) : "—",
      icon: Wallet,
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
                <span className="text-2xl font-semibold tracking-tight">{it.value}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
