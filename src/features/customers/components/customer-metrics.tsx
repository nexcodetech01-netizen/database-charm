import { Users, UserCheck, UserPlus, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useCustomerMetrics } from "../hooks/use-customers";

export function CustomerMetrics({ companyId }: { companyId: string }) {
  const { data, isLoading } = useCustomerMetrics(companyId);

  const items = [
    { label: "Total de clientes", value: data?.total ?? 0, icon: Users, tone: "text-foreground", placeholder: false },
    { label: "Ativos", value: data?.active ?? 0, icon: UserCheck, tone: "text-success", placeholder: false },
    { label: "Novos no mês", value: data?.newThisMonth ?? 0, icon: UserPlus, tone: "text-primary", placeholder: false },
    { label: "Sem compras", value: "—", icon: ShoppingBag, tone: "text-muted-foreground", placeholder: true },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} >
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {it.label}
              </p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight">
                {isLoading && !it.placeholder ? "—" : it.value}
              </p>
              {it.placeholder ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">Aguardando Vendas</p>
              ) : null}
            </div>
            <div className={`rounded-lg bg-muted/60 p-2.5 ${it.tone}`}>
              <it.icon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
