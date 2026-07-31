import { useMemo, useState } from "react";
import { ClipboardList, Download, FileDown, ListChecks } from "lucide-react";

import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { exportCSV, exportPDF } from "@/features/reports/utils/export";
import { formatDate } from "@/lib/format";
import { useKpiCenter } from "../hooks/use-kpi-center";
import { IndicatorCard } from "./indicator-card";
import type {
  Indicator,
  IndicatorOrigin,
  IndicatorPriority,
  KpiCenterFilters,
} from "../types";

interface Props {
  companyId: string;
}

const STORAGE_KEY = "nexos.kpi-center.resolved";

function loadResolved(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveResolved(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

const ORIGIN_OPTIONS: { value: IndicatorOrigin | "all"; label: string }[] = [
  { value: "all", label: "Todas origens" },
  { value: "pricing", label: "Precificação" },
  { value: "inventory", label: "Estoque" },
  { value: "sales", label: "Vendas" },
  { value: "customers", label: "Clientes" },
  { value: "finance", label: "Financeiro" },
  { value: "purchases", label: "Compras" },
];

const PRIORITY_OPTIONS: { value: IndicatorPriority | "all"; label: string }[] = [
  { value: "all", label: "Todas prioridades" },
  { value: "critical", label: "Crítico" },
  { value: "high", label: "Alto" },
  { value: "medium", label: "Médio" },
  { value: "low", label: "Baixo" },
];

const PRIORITY_LABEL: Record<IndicatorPriority, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

export function KpiCenterWorkspace({ companyId }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const [range, setRange] = useState({ from, to: today });
  const [categoryId, setCategoryId] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [priority, setPriority] = useState<IndicatorPriority | "all">("all");
  const [origin, setOrigin] = useState<IndicatorOrigin | "all">("all");
  const [resolved, setResolved] = useState<Set<string>>(() => loadResolved());

  const filters: KpiCenterFilters = useMemo(
    () => ({
      companyId,
      range,
      categoryId: categoryId || null,
      supplierId: supplierId || null,
      priority: priority === "all" ? null : priority,
      origin: origin === "all" ? null : origin,
    }),
    [companyId, range, categoryId, supplierId, priority, origin],
  );

  const { data, isLoading } = useKpiCenter(filters);
  const indicators = data?.indicators ?? [];

  const buckets = useMemo(() => {
    const active = indicators.filter((i) => !resolved.has(i.id));
    const done = indicators.filter((i) => resolved.has(i.id));
    return {
      critical: active.filter((i) => i.priority === "critical"),
      attention: active.filter((i) => i.priority === "high" || i.priority === "medium"),
      opportunities: active.filter((i) => i.priority === "low"),
      done,
    };
  }, [indicators, resolved]);

  const toggleResolve = (id: string) => {
    const next = new Set(resolved);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setResolved(next);
    saveResolved(next);
  };

  const buildRows = (list: Indicator[]) =>
    list.map((i) => ({
      Prioridade: PRIORITY_LABEL[i.priority],
      Título: i.title,
      Descrição: i.description,
      Origem: i.origin,
      Impacto: i.impact,
      Data: i.date ? formatDate(i.date.slice(0, 10)) : "—",
      Ação: i.action.label,
    }));

  const handleExportCsv = () => exportCSV("indicadores-nexos", buildRows(indicators));
  const handleExportPdf = () => {
    void exportPDF("indicadores-nexos", "Centro de Indicadores — NexOS", buildRows(indicators));
  };

  return (
    <PageLayout
      icon={ClipboardList}
      title="Centro de Indicadores"
      description="Fila priorizada de ações operacionais — críticos primeiro."
      meta={
        <span className="text-xs text-muted-foreground">
          {isLoading ? "Carregando…" : `${indicators.length} indicadores`}
        </span>
      }
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportPdf}>
            <FileDown className="mr-1 h-4 w-4" /> PDF
          </Button>
        </div>
      }
    >

      {/* Filtros */}
      <Card className="border-border/70">
        <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-6">
          <div className="md:col-span-1">
            <label className="mb-1 block text-[11px] text-muted-foreground">
              Categoria (ID)
            </label>
            <Input
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="filtro por categoria"
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-[11px] text-muted-foreground">
              Fornecedor (ID)
            </label>
            <Input
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              placeholder="filtro por fornecedor"
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-[11px] text-muted-foreground">
              Prioridade
            </label>
            <Select value={priority} onValueChange={(v) => setPriority(v as IndicatorPriority | "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-[11px] text-muted-foreground">Origem</label>
            <Select value={origin} onValueChange={(v) => setOrigin(v as IndicatorOrigin | "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORIGIN_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-[11px] text-muted-foreground">De</label>
            <Input
              type="date"
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-[11px] text-muted-foreground">Até</label>
            <Input
              type="date"
              value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label="Críticos" value={buckets.critical.length} tone="text-destructive" />
        <SummaryTile label="Atenção" value={buckets.attention.length} tone="text-warning" />
        <SummaryTile label="Oportunidades" value={buckets.opportunities.length} tone="text-primary" />
        <SummaryTile label="Concluídos" value={buckets.done.length} tone="text-success" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="critical" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="critical">
            Críticos ({buckets.critical.length})
          </TabsTrigger>
          <TabsTrigger value="attention">
            Atenção ({buckets.attention.length})
          </TabsTrigger>
          <TabsTrigger value="opportunities">
            Oportunidades ({buckets.opportunities.length})
          </TabsTrigger>
          <TabsTrigger value="done">
            Concluídos ({buckets.done.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="critical">
          <IndicatorList
            items={buckets.critical}
            onResolve={toggleResolve}
            emptyLabel="Nenhum indicador crítico. Excelente."
          />
        </TabsContent>
        <TabsContent value="attention">
          <IndicatorList
            items={buckets.attention}
            onResolve={toggleResolve}
            emptyLabel="Nada em atenção no momento."
          />
        </TabsContent>
        <TabsContent value="opportunities">
          <IndicatorList
            items={buckets.opportunities}
            onResolve={toggleResolve}
            emptyLabel="Nenhuma oportunidade identificada."
          />
        </TabsContent>
        <TabsContent value="done">
          <IndicatorList
            items={buckets.done}
            onResolve={toggleResolve}
            resolved
            emptyLabel="Nenhum indicador marcado como concluído."
          />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="border-border/70">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <ListChecks className={`h-4 w-4 ${tone}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function IndicatorList({
  items,
  onResolve,
  resolved,
  emptyLabel,
}: {
  items: Indicator[];
  onResolve: (id: string) => void;
  resolved?: boolean;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 pt-3 lg:grid-cols-2 xl:grid-cols-3">
      {items.map((i) => (
        <IndicatorCard key={i.id} indicator={i} onResolve={onResolve} resolved={resolved} />
      ))}
    </div>
  );
}
