import { formatCurrency, formatNumber } from "@/lib/format";
import { useProductsReport } from "../hooks/use-reports";
import type { DateRange } from "../types";
import { ChartCard } from "./chart-card";
import { ExportButtons } from "./export-buttons";

export function ProductsReportPanel({ companyId, range }: { companyId: string; range: DateRange }) {
  const { data } = useProductsReport(companyId, range);

  const rows =
    data?.bestSellers.map((p) => ({
      Produto: p.name,
      SKU: p.sku ?? "-",
      Quantidade: p.quantity,
      Receita: formatCurrency(p.revenue),
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Produtos</h2>
          <p className="text-sm text-muted-foreground">Mais e menos vendidos, itens sem movimentação.</p>
        </div>
        <ExportButtons filename="relatorio-produtos" title="Relatório de produtos" rows={rows} disabled={!data} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Mais vendidos" description="Top 10 por quantidade">
          <ProductTable rows={data?.bestSellers ?? []} />
        </ChartCard>
        <ChartCard title="Menos vendidos" description="10 com menor quantidade">
          <ProductTable rows={data?.worstSellers ?? []} />
        </ChartCard>
      </div>

      <ChartCard title="Sem movimentação" description="Produtos ativos sem venda no período">
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
              {(data?.noMovement ?? []).map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-2 pr-3">{p.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{p.sku ?? "-"}</td>
                  <td className="py-2 text-right">{formatNumber(p.stock)}</td>
                </tr>
              ))}
              {data && data.noMovement.length === 0 && (
                <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Todos os produtos ativos venderam.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

function ProductTable({ rows }: { rows: { id: string; name: string; sku: string | null; quantity: number; revenue: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2 pr-3 text-left">Produto</th>
            <th className="py-2 pr-3 text-right">Qtd</th>
            <th className="py-2 text-right">Receita</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-border/60">
              <td className="py-2 pr-3">
                <div>{p.name}</div>
                {p.sku && <div className="text-xs text-muted-foreground">{p.sku}</div>}
              </td>
              <td className="py-2 pr-3 text-right font-medium">{formatNumber(p.quantity)}</td>
              <td className="py-2 text-right">{formatCurrency(p.revenue)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Sem dados.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
