import { requirePermission } from "@/features/rbac";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  ChevronDown,
  Clock,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FileCheck2,
  Filter,
  HardDrive,
  Package,
  Plus,
  Receipt,
  ScrollText,
  Share2,
  ShoppingBag,
  Tag,
  Wallet,
  FileSignature,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageLayout } from "@/components/layout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DOCUMENT_RECORDS,
  DOCUMENT_TYPE_TO_CATEGORY,
  DocumentDetailDrawer,
  DocumentTable,
  type DocumentCategory,
  type DocumentRecord,
} from "@/features/documents";

export const Route = createFileRoute("/_authenticated/documentos")({
  beforeLoad: requirePermission("reports.view"),
  component: DocumentsPage,
});

type DatePreset = "today" | "7d" | "30d" | "all";

interface BlockDef {
  id: DocumentCategory;
  label: string;
  icon: LucideIcon;
  tone: string;
}

const BLOCKS: BlockDef[] = [
  { id: "orders", label: "Pedidos", icon: FileText, tone: "text-blue-500 bg-blue-500/10" },
  { id: "receipts", label: "Recibos", icon: Receipt, tone: "text-emerald-500 bg-emerald-500/10" },
  {
    id: "quotes",
    label: "Orçamentos",
    icon: FileSpreadsheet,
    tone: "text-amber-500 bg-amber-500/10",
  },
  {
    id: "purchases",
    label: "Compras",
    icon: ShoppingBag,
    tone: "text-orange-500 bg-orange-500/10",
  },
  { id: "finance", label: "Financeiro", icon: Wallet, tone: "text-cyan-500 bg-cyan-500/10" },
  { id: "fiscal", label: "Fiscal", icon: ScrollText, tone: "text-purple-500 bg-purple-500/10" },
  { id: "labels", label: "Etiquetas", icon: Tag, tone: "text-pink-500 bg-pink-500/10" },
  {
    id: "contracts",
    label: "Contratos",
    icon: FileSignature,
    tone: "text-slate-500 bg-slate-500/10",
  },
];

function DocumentsPage() {
  const [category, setCategory] = useState<DocumentCategory>("all");
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const rows = DOCUMENT_RECORDS;

  const filtered = useMemo(() => {
    if (category === "all") return rows;
    return rows.filter((r) => DOCUMENT_TYPE_TO_CATEGORY[r.type] === category);
  }, [rows, category]);

  const totalCount = rows.length;
  const pdfCount = useMemo(() => rows.filter((r) => r.format === "pdf").length, [rows]);
  const sharedCount = useMemo(
    () => rows.filter((r) => r.status === "shared" || (r.shares?.length ?? 0) > 0).length,
    [rows],
  );
  const pendingCount = useMemo(
    () => rows.filter((r) => r.status === "pending" || r.status === "generating").length,
    [rows],
  );

  const countsByCategory = useMemo(() => {
    const base: Partial<Record<DocumentCategory, number>> = {};
    for (const row of rows) {
      const cat = DOCUMENT_TYPE_TO_CATEGORY[row.type];
      base[cat] = (base[cat] ?? 0) + 1;
    }
    return base;
  }, [rows]);

  function handleSelect(row: DocumentRecord) {
    setSelected(row);
    setDrawerOpen(true);
  }

  return (
    <PageLayout
      icon={FileText}
      title="Central de Documentos"
      description="Repositório documental do NexOS."
      actions={
        <>
          <Button variant="outline" size="sm">
            <Filter className="mr-1.5 h-4 w-4" /> Filtros
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-1.5 h-4 w-4" /> Exportar
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem>
                <FileText className="mr-2 h-4 w-4" /> Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar Excel
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileArchive className="mr-2 h-4 w-4" /> Exportar ZIP
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Share2 className="mr-2 h-4 w-4" /> Compartilhar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" /> Novo documento
          </Button>
        </>
      }
      kpis={
        <HeroCard total={totalCount} pdfs={pdfCount} shared={sharedCount} pending={pendingCount} />
      }
      aside={<SummaryPanel />}
    >
      {/* Filtros rápidos */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/50 p-2">
        <div className="flex items-center gap-1">
          {(
            [
              { id: "today", label: "Hoje" },
              { id: "7d", label: "7 dias" },
              { id: "30d", label: "30 dias" },
              { id: "all", label: "Todos" },
            ] as const
          ).map((p) => (
            <Button
              key={p.id}
              variant={datePreset === p.id ? "secondary" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => setDatePreset(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="h-8 w-[150px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="order">Pedido</SelectItem>
            <SelectItem value="quote">Orçamento</SelectItem>
            <SelectItem value="receipt">Recibo</SelectItem>
            <SelectItem value="danfe">DANFE</SelectItem>
            <SelectItem value="contract">Contrato</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ready">Pronto</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="shared">Compartilhado</SelectItem>
            <SelectItem value="signed">Assinado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Blocos de documentos */}
      <section aria-labelledby="documents-blocks-title" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="documents-blocks-title" className="text-sm font-semibold tracking-tight">
            Categorias
          </h2>
          {category !== "all" ? (
            <Button variant="ghost" size="sm" onClick={() => setCategory("all")}>
              Limpar seleção
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {BLOCKS.map((b) => {
            const count = countsByCategory[b.id] ?? 0;
            const isActive = category === b.id;
            const Icon = b.icon;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setCategory(isActive ? "all" : b.id)}
                className={`group flex flex-col rounded-lg border bg-card p-3 text-left transition-colors ${
                  isActive
                    ? "border-primary/60 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/40 hover:bg-accent"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`grid h-9 w-9 place-items-center rounded-md ${b.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-lg font-semibold leading-none tracking-tight">{count}</span>
                </div>
                <p className="mt-3 text-sm font-medium leading-tight">{b.label}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  Nenhum documento ainda
                </p>
                <span className="mt-3 inline-flex items-center text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Ver categoria →
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Documentos recentes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Documentos recentes</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {category === "all"
                ? "Últimos arquivos gerados no sistema"
                : `Filtrando por: ${BLOCKS.find((b) => b.id === category)?.label ?? category}`}
            </p>
          </div>
          <Badge variant="outline" className="text-[11px]">
            {filtered.length} {filtered.length === 1 ? "item" : "itens"}
          </Badge>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              icon={FileCheck2}
              title="Sua Central de Documentos está pronta"
              description="Os documentos gerados pelo NexOS aparecerão automaticamente aqui."
              action={
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" /> Criar documento
                </Button>
              }
              className="py-20"
            />
          ) : (
            <DocumentTable rows={filtered} onSelect={handleSelect} />
          )}
        </CardContent>
      </Card>

      <DocumentDetailDrawer document={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </PageLayout>
  );
}

function HeroCard({
  total,
  pdfs,
  shared,
  pending,
}: {
  total: number;
  pdfs: number;
  shared: number;
  pending: number;
}) {
  const chips = [
    {
      label: "Documentos gerados",
      value: total,
      icon: FileText,
      tone: "text-primary bg-primary/10",
    },
    { label: "PDFs", value: pdfs, icon: Download, tone: "text-blue-500 bg-blue-500/10" },
    {
      label: "Compartilhados",
      value: shared,
      icon: Share2,
      tone: "text-emerald-500 bg-emerald-500/10",
    },
    { label: "Pendentes", value: pending, icon: Clock, tone: "text-amber-500 bg-amber-500/10" },
  ];
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-xl">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
            Repositório documental do NexOS
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os documentos gerados pelo NexOS ficam organizados aqui.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
          {chips.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.label}
                className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 backdrop-blur"
              >
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${c.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] text-muted-foreground">{c.label}</p>
                  <p className="truncate text-sm font-semibold tracking-tight">{c.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryPanel() {
  const items = [
    { label: "Último PDF", value: "—", hint: "Nenhum arquivo ainda", icon: FileText },
    { label: "Último compartilhamento", value: "—", hint: "Nenhum envio registrado", icon: Share2 },
    { label: "Espaço utilizado", value: "0 MB", hint: "de 5 GB disponíveis", icon: HardDrive },
    { label: "Formato mais utilizado", value: "PDF", hint: "Placeholder", icon: Archive },
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Resumo</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">Visão rápida do repositório</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div
              key={it.label}
              className="flex items-start gap-3 rounded-md border border-border/60 bg-card/50 p-2.5"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {it.label}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold tracking-tight">{it.value}</p>
                <p className="truncate text-[11px] text-muted-foreground">{it.hint}</p>
              </div>
            </div>
          );
        })}
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-center">
          <Package className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Placeholder — dados reais após a geração de documentos.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
