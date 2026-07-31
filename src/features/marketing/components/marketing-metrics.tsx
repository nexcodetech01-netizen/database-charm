import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/format";
import { DollarSign, Megaphone, TrendingUp, Users } from "lucide-react";

interface Props {
  metrics?: {
    totalCampaigns: number;
    activeCampaigns: number;
    leads: number;
    conversions: number;
    conversionRate: number;
    revenueGenerated: number;
    totalCustomers: number;
  };
  isLoading?: boolean;
}

export function MarketingMetrics({ metrics, isLoading }: Props) {
  const cards = [
    {
      label: "Campanhas",
      value: metrics ? formatNumber(metrics.totalCampaigns) : "—",
      hint: metrics ? `${metrics.activeCampaigns} ativas` : "",
      icon: Megaphone,
      tone: "text-primary",
    },
    {
      label: "Leads",
      value: metrics ? formatNumber(metrics.leads) : "—",
      hint: metrics ? `${formatNumber(metrics.totalCustomers)} clientes na base` : "",
      icon: Users,
      tone: "text-foreground",
    },
    {
      label: "Conversões",
      value: metrics ? formatNumber(metrics.conversions) : "—",
      hint: metrics ? `${metrics.conversionRate.toFixed(1)}% de conversão` : "",
      icon: TrendingUp,
      tone: "text-success",
    },
    {
      label: "Receita gerada",
      value: metrics ? formatCurrency(metrics.revenueGenerated) : "—",
      hint: "Somatório das campanhas",
      icon: DollarSign,
      tone: "text-success",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
              <div className={`rounded-md bg-muted/60 p-1.5 ${c.tone}`}>
                <c.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">
              {isLoading ? "…" : c.value}
            </div>
            {c.hint ? (
              <div className="mt-0.5 text-[11px] text-muted-foreground">{c.hint}</div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
