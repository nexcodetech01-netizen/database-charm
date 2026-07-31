import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronRight, ClipboardList, Search, Sparkles } from "lucide-react";
import { PageLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DataScopeFilter } from "@/features/sales/components/data-scope-filter";
import { DateRangePicker } from "../components/date-range-picker";
import { rangeFromPreset } from "../utils/date-range";
import type { DateRange } from "../types";
import { REPORTS, REPORT_CATEGORIES, reportsByCategory } from "./registry";
import type { ReportCategoryId, ReportDefinition } from "./types";
import { ReportViewer } from "./report-viewer";
import { ProductCatalogWorkspace } from "../catalog/product-catalog-workspace";
import { CommercialCatalogWorkspace } from "../catalog/commercial-catalog-workspace";
import { PricingReportWorkspace } from "../pricing/pricing-report-workspace";

const SESSION_KEY = "nx.reports.central.state";

interface PersistedState {
  category: ReportCategoryId;
  range: DateRange;
  reportId?: string | null;
}

function readState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

function writeState(state: PersistedState) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

export function CentralWorkspace({ companyId }: { companyId: string }) {
  const persisted = readState();
  const [category, setCategory] = useState<ReportCategoryId>(persisted?.category ?? "comercial");
  const [range, setRange] = useState<DateRange>(persisted?.range ?? rangeFromPreset("last_30_days"));
  const [reportId, setReportId] = useState<string | null>(persisted?.reportId ?? null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    writeState({ category, range, reportId });
  }, [category, range, reportId]);

  const selectedReport: ReportDefinition | null = useMemo(
    () => (reportId ? REPORTS.find((r) => r.id === reportId) ?? null : null),
    [reportId],
  );

  const categoryReports = useMemo(() => {
    const list = reportsByCategory(category);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
    );
  }, [category, search]);

  return (
    <PageLayout
      icon={BarChart3}
      title="Central de Relatórios"
      description="Todos os relatórios do NexOS em um só lugar."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <DataScopeFilter />
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Sidebar categorias */}
        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Categorias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5 p-2">
              {REPORT_CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = c.id === category;
                const count = reportsByCategory(c.id).length;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCategory(c.id);
                      setReportId(null);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent text-foreground",
                    )}
                  >
                    <div
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-md",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="flex-1 truncate text-left">{c.label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </aside>

        {/* Main */}
        <div className="min-w-0 space-y-4">
          {selectedReport ? (
            selectedReport.id === "catalogo-produtos" ? (
              <ProductCatalogWorkspace
                companyId={companyId}
                onBack={() => setReportId(null)}
              />
            ) : selectedReport.id === "catalogo-comercial" ? (
              <CommercialCatalogWorkspace
                companyId={companyId}
                onBack={() => setReportId(null)}
              />
            ) : selectedReport.id === "precificacao" ? (
              <PricingReportWorkspace
                companyId={companyId}
                onBack={() => setReportId(null)}
              />
            ) : (
              <ReportViewer
                report={selectedReport}
                companyId={companyId}
                range={range}
                onBack={() => setReportId(null)}
              />
            )
          ) : (
            <CategoryGrid
              category={category}
              search={search}
              onSearch={setSearch}
              reports={categoryReports}
              onOpen={setReportId}
            />
          )}
        </div>
      </div>
    </PageLayout>
  );
}

function CategoryGrid({
  category,
  search,
  onSearch,
  reports,
  onOpen,
}: {
  category: ReportCategoryId;
  search: string;
  onSearch: (v: string) => void;
  reports: ReportDefinition[];
  onOpen: (id: string) => void;
}) {
  const cat = REPORT_CATEGORIES.find((c) => c.id === category)!;
  const CatIcon = cat.icon;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <CatIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{cat.label}</h2>
            <p className="text-sm text-muted-foreground">{cat.description}</p>
          </div>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar relatório..."
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum relatório encontrado.
          </CardContent>
        </Card>
      ) : category === "catalogos" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {reports.map((r) => {
            const meta = CATALOG_CARD_META[r.id];
            if (!meta) {
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{r.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              );
            }
            const Icon = meta.icon;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpen(r.id)}
                className={cn(
                  "group relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  meta.borderClass,
                )}
              >
                <span
                  className={cn(
                    "absolute right-4 top-4 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    meta.badgeClass,
                  )}
                >
                  {meta.badge}
                </span>
                <div className="flex items-start gap-3 pr-16">
                  <div
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                      meta.iconClass,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-foreground">{meta.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                </div>
                <ul className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  {meta.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className={cn("mt-1 h-1 w-1 shrink-0 rounded-full", meta.bulletClass)} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-end text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Abrir <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {reports.map((r) => {
            const Icon = r.icon;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpen(r.id)}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{r.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {r.description}
                  </p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const CATALOG_CARD_META: Record<
  string,
  {
    title: string;
    description: string;
    icon: typeof ClipboardList;
    features: string[];
    badge: string;
    badgeClass: string;
    iconClass: string;
    borderClass: string;
    bulletClass: string;
  }
> = {
  "catalogo-produtos": {
    title: "📊 Tabela de Precificação (Interno)",
    description: "Conferência gerencial de custo, margem, lucro e preço.",
    icon: ClipboardList,
    features: [
      "Layout em tabela • ideal para impressão",
      "Foto 50x50, Produto, SKU, Estoque",
      "Custo, Margem (%), Lucro (R$) e Preço",
    ],
    badge: "Interno",
    badgeClass: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    iconClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200",
    borderClass: "border-border hover:border-slate-400/60",
    bulletClass: "bg-slate-500",
  },

  "catalogo-comercial": {
    title: "✨ Catálogo Comercial",
    description: "Ideal para apresentar produtos aos clientes.",
    icon: Sparkles,
    features: ["Fotos maiores", "Layout premium", "Pronto para WhatsApp e impressão"],
    badge: "Clientes",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    iconClass:
      "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm",
    borderClass: "border-amber-200/60 hover:border-amber-400 dark:border-amber-500/30",
    bulletClass: "bg-amber-500",
  },
};
