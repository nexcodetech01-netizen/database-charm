import { DollarSign, ShoppingCart, Users, Package } from "lucide-react";

const KPIS = [
  { label: "Faturamento (mês)", value: "R$ 0,00", icon: DollarSign, tone: "text-primary" },
  { label: "Vendas (mês)", value: "0", icon: ShoppingCart, tone: "text-primary" },
  { label: "Novos clientes", value: "0", icon: Users, tone: "text-primary" },
  { label: "Itens em estoque", value: "0", icon: Package, tone: "text-primary" },
];

export function KpiSection() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {KPIS.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.label}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{kpi.label}</span>
              <div className="grid h-8 w-8 place-items-center rounded-md bg-accent">
                <Icon className={`h-4 w-4 ${kpi.tone}`} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight">{kpi.value}</span>
              <span className="text-xs text-muted-foreground">—</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Sem dados suficientes ainda
            </p>
          </div>
        );
      })}
    </div>
  );
}
