import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { CAMPAIGN_CHANNEL_OPTIONS, type MarketingCampaign } from "../types";

const channelLabel = (v: string) =>
  CAMPAIGN_CHANNEL_OPTIONS.find((o) => o.value === v)?.label ?? v;

export function CampaignInsights({ campaigns }: { campaigns: MarketingCampaign[] }) {
  const byChannel = useMemo(() => {
    const map = new Map<string, { channel: string; leads: number; conversions: number; revenue: number }>();
    campaigns.forEach((c) => {
      const key = c.channel;
      const entry = map.get(key) ?? { channel: channelLabel(key), leads: 0, conversions: 0, revenue: 0 };
      entry.leads += Number(c.leads_count ?? 0);
      entry.conversions += Number(c.conversions_count ?? 0);
      entry.revenue += Number(c.revenue_generated ?? 0);
      map.set(key, entry);
    });
    return Array.from(map.values());
  }, [campaigns]);

  const topRevenue = useMemo(
    () =>
      [...campaigns]
        .sort((a, b) => Number(b.revenue_generated ?? 0) - Number(a.revenue_generated ?? 0))
        .slice(0, 5),
    [campaigns],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Performance por canal</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {byChannel.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem dados para exibir.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byChannel}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="channel" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="leads" name="Leads" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversions" name="Conversões" fill="var(--success)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top campanhas por receita</CardTitle>
        </CardHeader>
        <CardContent>
          {topRevenue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem campanhas ainda.</p>
          ) : (
            <ul className="space-y-2.5">
              {topRevenue.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {channelLabel(c.channel)} · {c.conversions_count ?? 0} conversões
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatCurrency(Number(c.revenue_generated ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
