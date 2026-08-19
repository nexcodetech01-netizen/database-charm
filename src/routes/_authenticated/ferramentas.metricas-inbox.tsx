import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { PageLayout, ListSkeleton, EmptyState } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, Database, BarChart3, Clock } from "lucide-react";
import { requirePermission } from "@/features/rbac";

export const Route = createFileRoute("/_authenticated/ferramentas/metricas-inbox")({
  beforeLoad: requirePermission("settings.view"),
  head: () => ({
    meta: [{ title: "Métricas de Egress (Inbox) | NexOS" }],
  }),
  component: MetricsPage,
});

function MetricsPage() {
  const { companyId } = useAuth();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["query-metrics", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      // Buscamos os logs das últimas 24h e últimos 7 dias
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("query_metrics")
        .select("*")
        .eq("company_id", companyId as string)

        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const stats = (() => {
    if (!metrics) return null;

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const calculateStats = (filtered: any[]) => {
      const groups: Record<string, { count: number; totalKb: number; maxKb: number }> = {};

      filtered.forEach((m) => {
        if (!groups[m.query_name]) {
          groups[m.query_name] = { count: 0, totalKb: 0, maxKb: 0 };
        }
        groups[m.query_name].count++;
        groups[m.query_name].totalKb += Number(m.payload_size_kb);
        groups[m.query_name].maxKb = Math.max(groups[m.query_name].maxKb, Number(m.payload_size_kb));
      });

      return Object.entries(groups).map(([name, g]) => ({
        name,
        count: g.count,
        avg: (g.totalKb / g.count).toFixed(2),
        max: g.maxKb.toFixed(2),
      }));
    };

    return {
      last24h: calculateStats(metrics.filter((m) => m.created_at && new Date(m.created_at) >= yesterday)),

      last7d: calculateStats(metrics),
    };
  })();

  return (
    <PageLayout
      title="Métricas de Payload"
      description="Monitoramento do volume de dados trafegado pelo Inbox Comercial."
      icon={BarChart3}
    >
      <div className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chamadas (7 dias)</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.length.toString() || "0"}</div>

            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Médias Recentes</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.last24h.length ? stats.last24h[0].avg : "0.00"} KB
              </div>
              <p className="text-xs text-muted-foreground">inbox_list (24h)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Último Log</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-mono">
                {metrics && metrics[0]?.created_at ? new Date(metrics[0].created_at).toLocaleString() : "—"}

              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Resumo por Query (Últimas 24h)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton />
            ) : !stats || stats.last24h.length === 0 ? (
              <EmptyState
                icon={Database}
                title="Sem dados nas últimas 24h"
                description="As métricas aparecerão conforme as queries do Inbox forem executadas."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead className="text-right">Média (KB)</TableHead>
                    <TableHead className="text-right">Máximo (KB)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.last24h.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium font-mono">{s.name}</TableCell>
                      <TableCell className="text-right">{s.count.toString()}</TableCell>
                      <TableCell className="text-right">{s.avg} KB</TableCell>
                      <TableCell className="text-right">{s.max} KB</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo por Query (Últimos 7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton />
            ) : !stats || stats.last7d.length === 0 ? (
              <EmptyState
                icon={Database}
                title="Sem dados"
                description="Nenhuma métrica registrada nos últimos 7 dias."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead className="text-right">Média (KB)</TableHead>
                    <TableHead className="text-right">Máximo (KB)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.last7d.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium font-mono">{s.name}</TableCell>
                      <TableCell className="text-right">{s.count.toString()}</TableCell>
                      <TableCell className="text-right">{s.avg} KB</TableCell>
                      <TableCell className="text-right">{s.max} KB</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
