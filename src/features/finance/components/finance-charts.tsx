import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useTransactions, useFinanceOverview } from "../hooks/use-finance";
import { buildDailyCashFlow, buildMonthlySeries } from "../lib/derive";
import { DEFAULT_COMPANY_TZ } from "../lib/company-time";

function useCompanyTimezone(companyId: string) {
  const { data } = useQuery({
    queryKey: ["company-timezone", companyId],
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("timezone")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data?.timezone?.trim() || DEFAULT_COMPANY_TZ;
    },
  });
  return data ?? DEFAULT_COMPANY_TZ;
}


const WIDE_FILTERS = {
  search: "",
  type: "",
  status: "",
  accountId: "",
  categoryId: "",
  page: 1,
  pageSize: 500,
};

function currencyShort(v: number) {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

export function MonthlyIncomeExpenseChart({ companyId }: { companyId: string }) {
  const { data, isLoading } = useTransactions(companyId, WIDE_FILTERS);
  const companyTz = useCompanyTimezone(companyId);
  const series = useMemo(
    () => buildMonthlySeries(data?.rows ?? [], 6, companyTz),
    [data, companyTz],
  );


  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Receitas x Despesas</h3>
        <p className="text-xs text-muted-foreground">Últimos 6 meses (somente pagas).</p>
      </div>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" tickFormatter={currencyShort} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Receitas" fill="var(--success)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Despesas" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function DailyCashFlowChart({ companyId }: { companyId: string }) {
  const { data: overview } = useFinanceOverview(companyId);
  const { data, isLoading } = useTransactions(companyId, WIDE_FILTERS);
  const companyTz = useCompanyTimezone(companyId);
  const series = useMemo(
    () =>
      buildDailyCashFlow(
        data?.rows ?? [],
        overview?.currentBalance ?? 0,
        7,
        14,
        companyTz,
      ),
    [data, overview?.currentBalance, companyTz],
  );


  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Saldo diário previsto</h3>
        <p className="text-xs text-muted-foreground">
          Realizado dos últimos 7 dias + previsão dos próximos 14 dias.
        </p>
      </div>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" tickFormatter={currencyShort} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Line
                type="monotone"
                dataKey="balance"
                name="Saldo"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
