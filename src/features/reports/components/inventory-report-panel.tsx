import { AlertTriangle, Boxes, PackageX, Repeat } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useInventoryReport } from "../hooks/use-reports";
import type { DateRange } from "../types";
import { MetricCard } from "./metric-card";
import { ChartCard } from "./chart-card";
import { ExportButtons } from "./export-buttons";

export function InventoryReportPanel({ companyId, range }: { companyId: string; range: DateRange }) {
  const { data, isLoading } = useInventoryReport(companyId, range);
  const m = data?.metrics;

  const rows =
    data?.lowStock.map((p) => ({
      Produto: p.name,
      SKU: p.sku ?? "-",
      Estoque: p.stock,
      Mínimo: p.min_stock,
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Estoque</h2>
          <p className="text-sm text-muted-foreground">Giro, alertas de mínimo e valor total.</p>
        </div>
        <ExportButtons filename="relatorio-estoque" title="Relatório de estoque" rows={rows} disabled={!data} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Valor em estoque" value={m ? formatCurrency(m.inventoryValue) : undefined} icon={Boxes} loading={isLoading} />
        <MetricCard label="Giro (saída/estoque)" value={m ? `${(m.turnover * 100).toFixed(1)}%` : undefined} icon={Repeat} loading={isLoading} />
        <MetricCard label="Estoque mínimo" value={m ? formatNumber(m.lowStockCount) : undefined} icon={AlertTriangle} tone="text-warning" loading={isLoading} />
        <MetricCard label="Sem estoque" value={m ? formatNumber(m.outOfStockCount) : undefined} icon={PackageX} tone="text-destructive" loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Alertas de estoque mínimo" description="Produtos abaixo do mínimo">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 text-left">Produto</th>
                  <th className="py-2 pr-3 text-left">SKU</th>
                  <th className="py-2 text-right">Estoque</th>
                  <th className="py-2 text-right">Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {(data?.lowStock ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">{p.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{p.sku ?? "-"}</td>
                    <td className="py-2 text-right font-medium text-warning">{formatNumber(p.stock)}</td>
                    <td className="py-2 text-right text-muted-foreground">{formatNumber(p.min_stock)}</td>
                  </tr>
                ))}
                {data && data.lowStock.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Nenhum alerta.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard title="Produtos sem movimentação" description="Estoque parado no período">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 text-left">Produto</th>
                  <th className="py-2 pr-3 text-left">SKU</th>
                  <th className="py-2 text-right">Estoque</th>
                </tr>
              </thead>
              <tbody>
                {(data?.stagnant ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">{p.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{p.sku ?? "-"}</td>
                    <td className="py-2 text-right">{formatNumber(p.stock)}</td>
                  </tr>
                ))}
                {data && data.stagnant.length === 0 && (
                  <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Todos os produtos tiveram movimentação.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
