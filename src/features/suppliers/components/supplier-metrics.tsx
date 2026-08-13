import { Truck, CheckCircle2, Sparkles, ShoppingCart } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupplierMetrics } from "../hooks/use-suppliers";

export function SupplierMetrics({ companyId }: { companyId: string }) {
  const { data, isLoading } = useSupplierMetrics(companyId);
  const items: { label: string; value: number | undefined; icon: typeof Truck; tone?: string; hint?: string }[] = [
    { label: "Total de fornecedores", value: data?.total, icon: Truck },
    {
      label: "Fornecedores ativos",
      value: data?.active,
      icon: CheckCircle2,
      tone: "text-success",
    },
    { label: "Novos este mês", value: data?.newThisMonth, icon: Sparkles },
    {
      label: "Compras vinculadas",
      value: data?.purchasesLinked,
      icon: ShoppingCart,
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
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tracking-tight">
                    {it.value !== undefined ? formatNumber(it.value) : "—"}
                  </span>
                  {it.hint ? (
                    <span className="text-[11px] text-muted-foreground">{it.hint}</span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
