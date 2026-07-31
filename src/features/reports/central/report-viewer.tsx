import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiSection, KpiCard } from "@/components/layout";
import { ExportButtons } from "../components/export-buttons";
import type { Row } from "../utils/export";
import { ReportTable } from "./report-table";
import type { ReportDefinition } from "./types";
import type { DateRange } from "../types";

interface Props {
  report: ReportDefinition;
  companyId: string;
  range: DateRange;
  onBack: () => void;
}

export function ReportViewer({ report, companyId, range, onBack }: Props) {
  const query = useQuery({
    queryKey: ["reports-central", report.id, companyId, range.from, range.to],
    queryFn: () => report.load({ companyId, range }),
    enabled: Boolean(companyId),
    staleTime: 60_000,
  });

  const exportRows: Row[] = useMemo(() => {
    if (!query.data) return [];
    return query.data.rows.map((row) => {
      const out: Row = {};
      for (const col of query.data!.columns) {
        const raw = col.value
          ? col.value(row as never)
          : (row as Record<string, unknown>)[col.key];
        out[col.label] = raw == null ? "" : (raw as string | number);
      }
      return out;
    });
  }, [query.data]);

  const Icon = report.icon;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="h-8">
            <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Voltar
          </Button>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{report.title}</h2>
              <p className="text-sm text-muted-foreground">{report.description}</p>
              {query.data?.summary ? (
                <p className="mt-1 text-xs text-muted-foreground">{query.data.summary}</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={() => window.print()}>
            <Printer className="mr-2 h-3.5 w-3.5" /> Imprimir
          </Button>
          <ExportButtons
            filename={report.filename}
            title={report.title}
            rows={exportRows}
            disabled={!query.data || query.data.rows.length === 0}
          />
        </div>
      </div>

      {query.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Falha ao carregar o relatório.
          </CardContent>
        </Card>
      ) : null}

      {query.data?.kpis && query.data.kpis.length > 0 ? (
        <KpiSection columns={(Math.min(4, Math.max(2, query.data.kpis.length)) as 2 | 3 | 4)}>
          {query.data.kpis.map((k) => (
            <KpiCard key={k.label} label={k.label} value={k.value} hint={k.hint} />
          ))}
        </KpiSection>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resultados</CardTitle>
        </CardHeader>
        <CardContent>
          {query.isLoading || !query.data ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <ReportTable
              columns={query.data.columns}
              rows={query.data.rows}
              emptyLabel={query.data.emptyLabel}
              storageKey={report.id}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
