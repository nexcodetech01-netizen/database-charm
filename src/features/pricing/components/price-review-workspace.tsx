/**
 * PriceReviewWorkspace — UX-006 · Central de Revisão de Preços
 * ============================================================
 *
 * REGRAS (idênticas às demais UX de Pricing):
 *   - Zero cálculo aqui. Zero regra de negócio.
 *   - Toda leitura vem de `getCommercialDashboard` (reviewList).
 *   - Explain vem de `getProductPricingIntelligence` (CalculateSuggestedPrice + explain()).
 *   - Aplicação vem de `applyProductSuggestedPrice`
 *     (ApplySuggestedPrice + RegisterPricingDecision).
 *   - Nada de acesso direto a Pricing Engine, Repositories ou Supabase.
 */
import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpRight,
  ArrowDownRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  Info,
  Layers,
  Package,
  Search,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLayout, EmptyState, ListSkeleton } from "@/components/layout";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/config/routes";
import {
  getCommercialDashboard,
  PRICE_REVIEW_REASON_LABEL,
  type PriceReviewItemDTO,
  type PriceReviewReason,
} from "@/features/pricing/lib/commercial-dashboard.functions";
import {
  applyProductSuggestedPrice,
  getProductPricingIntelligence,
  type ApplyProductPriceResultDTO,
  type ProductPricingIntelligenceDTO,
} from "@/features/pricing/lib/product-pricing.functions";
import type { PolicyLayerName } from "@/features/pricing/resolver/types";

const cents = (n: number | null | undefined) => formatCurrency(((n ?? 0) as number) / 100);

const ORIGIN_ICON: Record<PolicyLayerName, typeof Package> = {
  product: Package,
  category: Layers,
  company: Building2,
  context: Sparkles,
  system: Sparkles,
};

const REASON_TONE: Record<PriceReviewReason, string> = {
  below_min_margin: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  cost_changed: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  price_differs: "border-primary/40 bg-primary/10 text-primary dark:text-primary",
  pending_suggestion: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  no_policy: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

interface BulkAppliedItem {
  readonly productId: string;
  readonly name: string;
  readonly previousPriceCents: number;
  readonly appliedPriceCents: number;
  readonly explainId: string;
  readonly decisionId: string;
}
interface BulkSkippedItem {
  readonly productId: string;
  readonly name: string;
  readonly reason: string;
}
interface BulkFailedItem {
  readonly productId: string;
  readonly name: string;
  readonly error: string;
}
interface BulkRunState {
  readonly running: boolean;
  readonly total: number;
  readonly done: number;
  readonly currentName: string | null;
  readonly canceled: boolean;
  readonly applied: readonly BulkAppliedItem[];
  readonly skipped: readonly BulkSkippedItem[];
  readonly failed: readonly BulkFailedItem[];
}

interface Props {
  companyId: string;
}

export function PriceReviewWorkspace({ companyId }: Props) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["commercial-dashboard", companyId],
    queryFn: () => getCommercialDashboard({ data: { companyId } }),
    staleTime: 30_000,
  });

  const reviewList = useMemo<readonly PriceReviewItemDTO[]>(() => data?.reviewList ?? [], [data]);

  // ─── Filtros
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [supplierId, setSupplierId] = useState<string>("all");
  const [reason, setReason] = useState<string>("all");
  const [origin, setOrigin] = useState<string>("all");

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reviewList)
      if (r.categoryId && r.categoryName) map.set(r.categoryId, r.categoryName);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [reviewList]);

  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reviewList)
      if (r.supplierId && r.supplierName) map.set(r.supplierId, r.supplierName);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [reviewList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviewList.filter((r) => {
      if (categoryId !== "all" && r.categoryId !== categoryId) return false;
      if (supplierId !== "all" && r.supplierId !== supplierId) return false;
      if (reason !== "all" && r.primaryReason !== reason) return false;
      if (origin !== "all" && r.originLayer !== origin) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [reviewList, search, categoryId, supplierId, reason, origin]);

  // ─── Explain dialog
  const [explainProductId, setExplainProductId] = useState<string | null>(null);
  const explainQuery = useQuery({
    queryKey: ["product-pricing-intelligence", companyId, explainProductId],
    queryFn: () =>
      getProductPricingIntelligence({
        data: { companyId, productId: explainProductId! },
      }),
    enabled: !!explainProductId,
    staleTime: 15_000,
  });

  // ─── Aplicar preço (individual)
  const applyMutation = useMutation({
    mutationFn: (productId: string) =>
      applyProductSuggestedPrice({
        data: { companyId, productId, strategy: "final" },
      }),
    onSuccess: async (res) => {
      toast.success("Preço aplicado", {
        description: `Novo preço: ${cents(res.appliedPriceCents)}`,
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      await queryClient.invalidateQueries({
        queryKey: ["commercial-dashboard", companyId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["product-pricing-intelligence", companyId, res.productId],
      });
    },
    onError: (err: Error) => {
      toast.error("Falha ao aplicar preço", {
        description: err.message ?? "Tente novamente.",
      });
    },
  });

  // ─── Seleção em lote
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filteredIds = useMemo(() => filtered.map((r) => r.productId), [filtered]);
  const allResultIds = useMemo(() => reviewList.map((r) => r.productId), [reviewList]);
  const pageSelectedCount = filteredIds.filter((id) => selected.has(id)).length;
  const pageAllSelected = filteredIds.length > 0 && pageSelectedCount === filteredIds.length;
  const pageSomeSelected = pageSelectedCount > 0 && !pageAllSelected;

  const toggleRow = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const togglePage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) filteredIds.forEach((id) => next.add(id));
      else filteredIds.forEach((id) => next.delete(id));
      return next;
    });
  };
  const selectAllResults = () => setSelected(new Set(allResultIds));
  const clearSelection = () => setSelected(new Set());

  // ─── Bulk apply
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkState, setBulkState] = useState<BulkRunState | null>(null);
  const cancelRef = useRef(false);

  const selectedItems = useMemo(() => {
    const byId = new Map(reviewList.map((r) => [r.productId, r] as const));
    return Array.from(selected)
      .map((id) => byId.get(id))
      .filter((r): r is PriceReviewItemDTO => !!r);
  }, [reviewList, selected]);

  const bulkPreview = useMemo(() => {
    const applicable = selectedItems.filter((r) => r.differenceCents !== 0);
    const skipped = selectedItems.length - applicable.length;
    const currentSum = applicable.reduce((s, r) => s + (r.currentPriceCents ?? 0), 0);
    const newSum = applicable.reduce((s, r) => s + (r.recommendedPriceCents ?? 0), 0);
    return {
      total: selectedItems.length,
      applicable: applicable.length,
      skipped,
      currentSum,
      newSum,
      impact: newSum - currentSum,
      items: applicable,
    };
  }, [selectedItems]);

  const runBulkApply = async () => {
    cancelRef.current = false;
    const items = bulkPreview.items;
    const initial: BulkRunState = {
      running: true,
      total: items.length,
      done: 0,
      applied: [],
      skipped: selectedItems
        .filter((r) => r.differenceCents === 0)
        .map((r) => ({
          productId: r.productId,
          name: r.name,
          reason: "Sem diferença de preço",
        })),
      failed: [],
      currentName: null,
      canceled: false,
    };
    setBulkState(initial);

    for (let i = 0; i < items.length; i++) {
      if (cancelRef.current) {
        setBulkState((s) => (s ? { ...s, canceled: true, running: false, currentName: null } : s));
        break;
      }
      const item = items[i];
      setBulkState((s) => (s ? { ...s, currentName: item.name } : s));
      try {
        const res = await applyProductSuggestedPrice({
          data: {
            companyId,
            productId: item.productId,
            strategy: "final",
          },
        });
        setBulkState((s) =>
          s
            ? {
                ...s,
                done: s.done + 1,
                applied: [
                  ...s.applied,
                  {
                    productId: item.productId,
                    name: item.name,
                    previousPriceCents: item.currentPriceCents,
                    appliedPriceCents: res.appliedPriceCents,
                    explainId: res.explainId,
                    decisionId: res.decisionId,
                  },
                ],
              }
            : s,
        );
      } catch (err) {
        setBulkState((s) =>
          s
            ? {
                ...s,
                done: s.done + 1,
                failed: [
                  ...s.failed,
                  {
                    productId: item.productId,
                    name: item.name,
                    error: err instanceof Error ? err.message : "Erro desconhecido",
                  },
                ],
              }
            : s,
        );
      }
    }

    setBulkState((s) => (s ? { ...s, running: false, currentName: null } : s));
    await queryClient.invalidateQueries({
      queryKey: ["commercial-dashboard", companyId],
    });
    clearSelection();
  };

  const summaryKpis = useMemo(() => {
    const total = reviewList.length;
    const below = reviewList.filter((r) => r.reasons.includes("below_min_margin")).length;
    const cost = reviewList.filter((r) => r.reasons.includes("cost_changed")).length;
    const noPolicy = reviewList.filter((r) => r.reasons.includes("no_policy")).length;
    return { total, below, cost, noPolicy };
  }, [reviewList]);

  return (
    <PageLayout
      icon={ClipboardCheck}
      title="Central de Revisão de Preços"
      description="Produtos que exigem sua atenção — custo alterado, margem abaixo do mínimo, política pendente ou preço distante do recomendado."
      meta={
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="gap-1">
            <ClipboardCheck className="h-3 w-3" />
            {summaryKpis.total} para revisar
          </Badge>
          {summaryKpis.below > 0 ? (
            <Badge
              variant="outline"
              className="gap-1 border-red-500/40 text-red-600 dark:text-red-400"
            >
              {summaryKpis.below} abaixo da margem
            </Badge>
          ) : null}
          {summaryKpis.cost > 0 ? (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400"
            >
              {summaryKpis.cost} custo alterado
            </Badge>
          ) : null}
          {summaryKpis.noPolicy > 0 ? (
            <Badge variant="outline" className="gap-1">
              {summaryKpis.noPolicy} sem política
            </Badge>
          ) : null}
        </div>
      }
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          Atualizar
        </Button>
      }
      toolbar={
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar produto..."
              className="pl-9"
            />
          </div>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fornecedores</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Motivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os motivos</SelectItem>
              {(Object.keys(PRICE_REVIEW_REASON_LABEL) as PriceReviewReason[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {PRICE_REVIEW_REASON_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={origin} onValueChange={setOrigin}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              <SelectItem value="product">Produto</SelectItem>
              <SelectItem value="category">Categoria</SelectItem>
              <SelectItem value="company">Empresa</SelectItem>
              <SelectItem value="system">Sistema</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <EmptyState
          icon={Info}
          title="Não foi possível carregar a lista"
          description="Tente atualizar novamente em alguns segundos."
          action={
            <Button onClick={() => refetch()} size="sm">
              Tentar novamente
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={
            reviewList.length === 0 ? "Nada a revisar por aqui" : "Nenhum item bate com os filtros"
          }
          description={
            reviewList.length === 0
              ? "Todos os produtos estão alinhados com a política comercial. Vamos manter assim."
              : "Ajuste os filtros para ver mais produtos."
          }
        />
      ) : (
        <div className="space-y-3">
          <BulkSelectionBar
            pageCount={filteredIds.length}
            totalCount={allResultIds.length}
            selectedCount={selected.size}
            onSelectAllResults={selectAllResults}
            onClear={clearSelection}
            onApply={() => setConfirmOpen(true)}
            disabled={!!bulkState?.running}
          />
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Selecionar página"
                      checked={pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false}
                      onCheckedChange={(v) => togglePage(v === true)}
                    />
                  </TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Preço atual</TableHead>
                  <TableHead className="text-right">Recomendado</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <ReviewRow
                    key={r.productId}
                    item={r}
                    selected={selected.has(r.productId)}
                    onToggle={(v) => toggleRow(r.productId, v)}
                    onExplain={() => setExplainProductId(r.productId)}
                    onApply={() => applyMutation.mutate(r.productId)}
                    applying={applyMutation.isPending && applyMutation.variables === r.productId}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <BulkConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        preview={bulkPreview}
        onConfirm={() => {
          setConfirmOpen(false);
          void runBulkApply();
        }}
      />

      <BulkRunDialog
        state={bulkState}
        onCancel={() => {
          cancelRef.current = true;
        }}
        onClose={() => setBulkState(null)}
      />

      <ExplainDialog
        open={!!explainProductId}
        onOpenChange={(v) => !v && setExplainProductId(null)}
        data={explainQuery.data ?? null}
        loading={explainQuery.isLoading}
      />
    </PageLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Linha
// ─────────────────────────────────────────────────────────────────────────────

function ReviewRow({
  item,
  selected,
  onToggle,
  onExplain,
  onApply,
  applying,
}: {
  item: PriceReviewItemDTO;
  selected: boolean;
  onToggle: (v: boolean) => void;
  onExplain: () => void;
  onApply: () => void;
  applying: boolean;
}) {
  const Icon = ORIGIN_ICON[item.originLayer] ?? Sparkles;
  const diff = item.differenceCents;
  const diffTone =
    diff === 0
      ? "text-muted-foreground"
      : diff > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-600 dark:text-red-400";

  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      <TableCell className="w-10">
        <Checkbox
          aria-label={`Selecionar ${item.name}`}
          checked={selected}
          onCheckedChange={(v) => onToggle(v === true)}
        />
      </TableCell>

      <TableCell className="min-w-[220px]">
        <div className="flex flex-col">
          <span className="font-medium">{item.name}</span>
          {item.supplierName ? (
            <span className="text-xs text-muted-foreground">{item.supplierName}</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{item.categoryName ?? "—"}</TableCell>
      <TableCell className="text-right tabular-nums">{cents(item.currentPriceCents)}</TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {cents(item.recommendedPriceCents)}
      </TableCell>
      <TableCell className={cn("text-right tabular-nums", diffTone)}>
        <span className="inline-flex items-center gap-1">
          {diff > 0 ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : diff < 0 ? (
            <ArrowDownRight className="h-3.5 w-3.5" />
          ) : null}
          {diff === 0 ? "—" : `${diff > 0 ? "+" : "−"}${formatCurrency(Math.abs(diff) / 100)}`}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        <div className="flex flex-col items-end leading-tight">
          <span>{item.currentMarginPct.toFixed(1)}%</span>
          <span className="text-[10px] text-muted-foreground">
            alvo {item.targetMarginPct.toFixed(1)}%
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="gap-1 text-xs">
          <Icon className="h-3 w-3" />
          {item.originLabel}
        </Badge>
      </TableCell>
      <TableCell className="min-w-[180px]">
        <div className="flex flex-wrap gap-1">
          {item.reasons.map((r) => (
            <span
              key={r}
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                REASON_TONE[r],
              )}
            >
              {PRICE_REVIEW_REASON_LABEL[r]}
            </span>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatDateTime(item.lastUpdatedAt)}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/produtos/$productId" params={{ productId: item.productId }}>
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              Ver produto
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onExplain}>
            <Info className="mr-1 h-3.5 w-3.5" />
            Explain
          </Button>
          <Button size="sm" onClick={onApply} disabled={applying} className="gap-1">
            <BadgeCheck className="h-3.5 w-3.5" />
            {applying ? "Aplicando..." : "Aplicar"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Explain Dialog — mesmo shape usado em UX-003
// ─────────────────────────────────────────────────────────────────────────────

function ExplainDialog({
  open,
  onOpenChange,
  data,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ProductPricingIntelligenceDTO | null;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Como esse preço foi calculado?
          </DialogTitle>
          <DialogDescription>
            {loading ? "Carregando explicação..." : (data?.summary ?? "Sem detalhes disponíveis.")}
          </DialogDescription>
        </DialogHeader>

        {data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <MiniStat label="Mínimo" value={cents(data.minPriceCents)} />
              <MiniStat label="Recomendado" value={cents(data.recommendedPriceCents)} highlight />
              <MiniStat label="Premium" value={cents(data.premiumPriceCents)} />
            </div>

            <ol className="space-y-2 border-l border-border pl-4">
              {data.steps.map((s, idx) => (
                <li key={`${s.step}-${idx}`} className="relative">
                  <span className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div>
                      <p className="font-medium capitalize">{s.step}</p>
                      <p className="text-xs text-muted-foreground">{s.rule}</p>
                    </div>
                    {s.outputCents != null ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(s.outputCents / 100)}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>

            {data.warnings.length > 0 ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                <p className="mb-1 font-semibold text-amber-700 dark:text-amber-400">Avisos</p>
                <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {data.warnings.map((w, i) => (
                    <li key={i}>
                      <span className="font-mono text-[10px]">{w.code}</span> — {w.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-md border border-border bg-muted/40 p-3 text-[10px] font-mono text-muted-foreground">
              explainId: {data.explainId}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-2",
        highlight ? "border-primary/40 bg-primary/5" : "border-border",
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk components
// ─────────────────────────────────────────────────────────────────────────────

function BulkSelectionBar({
  pageCount,
  totalCount,
  selectedCount,
  onSelectAllResults,
  onClear,
  onApply,
  disabled,
}: {
  pageCount: number;
  totalCount: number;
  selectedCount: number;
  onSelectAllResults: () => void;
  onClear: () => void;
  onApply: () => void;
  disabled: boolean;
}) {
  const hasSelection = selectedCount > 0;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm",
        hasSelection
          ? "border-primary/40 bg-primary/5"
          : "border-dashed border-border bg-card text-muted-foreground",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-foreground">
          {hasSelection
            ? `${selectedCount} selecionado${selectedCount === 1 ? "" : "s"}`
            : "Nenhum produto selecionado"}
        </span>
        {hasSelection && selectedCount < totalCount ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs"
            onClick={onSelectAllResults}
          >
            Selecionar todos os {totalCount} resultados
          </Button>
        ) : null}
        {hasSelection ? (
          <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={onClear}>
            Limpar
          </Button>
        ) : (
          <span className="text-xs">
            Selecione linhas ou marque a página ({pageCount}) para aplicar em lote.
          </span>
        )}
      </div>
      <Button size="sm" onClick={onApply} disabled={!hasSelection || disabled} className="gap-1">
        <BadgeCheck className="h-3.5 w-3.5" />
        Aplicar selecionados
      </Button>
    </div>
  );
}

interface BulkPreview {
  total: number;
  applicable: number;
  skipped: number;
  currentSum: number;
  newSum: number;
  impact: number;
  items: readonly PriceReviewItemDTO[];
}

function BulkConfirmDialog({
  open,
  onOpenChange,
  preview,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preview: BulkPreview;
  onConfirm: () => void;
}) {
  const impactTone =
    preview.impact > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : preview.impact < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";
  const nothingToDo = preview.applicable === 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-primary" />
            Confirmar aplicação em lote
          </DialogTitle>
          <DialogDescription>Revise o impacto antes de continuar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Selecionados" value={String(preview.total)} />
            <MiniStat label="A aplicar" value={String(preview.applicable)} highlight />
            <MiniStat label="Sem mudança" value={String(preview.skipped)} />
            <MiniStat label="Preço atual (soma)" value={cents(preview.currentSum)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Preço novo (soma)" value={cents(preview.newSum)} />
            <div className="rounded-md border border-border p-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Impacto estimado
              </p>
              <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", impactTone)}>
                {preview.impact === 0
                  ? "—"
                  : `${preview.impact > 0 ? "+" : "−"}${formatCurrency(
                      Math.abs(preview.impact) / 100,
                    )}`}
              </p>
            </div>
          </div>

          {preview.applicable > 0 ? (
            <div className="max-h-40 overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-right text-xs">Atual</TableHead>
                    <TableHead className="text-right text-xs">Novo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.items.slice(0, 50).map((r) => (
                    <TableRow key={r.productId}>
                      <TableCell className="text-xs">{r.name}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {cents(r.currentPriceCents)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums font-medium">
                        {cents(r.recommendedPriceCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.items.length > 50 ? (
                <p className="border-t border-border p-2 text-center text-[10px] text-muted-foreground">
                  +{preview.items.length - 50} produto(s) adicionais
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
            <Info className="mr-1 inline h-3 w-3 text-primary" />
            Cada produto será aplicado individualmente e auditado.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={nothingToDo}>
            Confirmar {preview.applicable > 0 ? `(${preview.applicable})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkRunDialog({
  state,
  onCancel,
  onClose,
}: {
  state: BulkRunState | null;
  onCancel: () => void;
  onClose: () => void;
}) {
  const open = !!state;
  const running = !!state?.running;
  const progress = state && state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;

  const exportReport = () => {
    if (!state) return;
    const rows: string[] = [
      "status,productId,name,previousPriceCents,appliedPriceCents,explainId,decisionId,error",
    ];
    for (const a of state.applied) {
      rows.push(
        [
          "applied",
          a.productId,
          csv(a.name),
          a.previousPriceCents,
          a.appliedPriceCents,
          a.explainId,
          a.decisionId,
          "",
        ].join(","),
      );
    }
    for (const s of state.skipped) {
      rows.push(["skipped", s.productId, csv(s.name), "", "", "", "", csv(s.reason)].join(","));
    }
    for (const f of state.failed) {
      rows.push(["failed", f.productId, csv(f.name), "", "", "", "", csv(f.error)].join(","));
    }
    const blob = new Blob([rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revisao-precos-lote-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !running) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {running ? (
              <Sparkles className="h-4 w-4 animate-pulse text-primary" />
            ) : (
              <ClipboardCheck className="h-4 w-4 text-primary" />
            )}
            {running ? "Aplicando preços…" : "Aplicação concluída"}
          </DialogTitle>
          <DialogDescription>
            {running
              ? "Cada produto é processado individualmente e auditado."
              : state?.canceled
                ? "Processamento interrompido antes do fim."
                : "Relatório final do processamento em lote."}
          </DialogDescription>
        </DialogHeader>

        {state ? (
          <div className="space-y-4">
            <div>
              <Progress value={progress} />
              <p className="mt-1 text-xs text-muted-foreground">
                {state.done}/{state.total}
                {running && state.currentName ? ` • ${state.currentName}` : ""}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <StatusTile
                icon={CheckCircle2}
                label="Aplicados"
                value={state.applied.length}
                tone="positive"
              />
              <StatusTile
                icon={Info}
                label="Ignorados"
                value={state.skipped.length}
                tone="neutral"
              />
              <StatusTile
                icon={XCircle}
                label="Falhas"
                value={state.failed.length}
                tone="negative"
              />
            </div>

            {state.failed.length > 0 ? (
              <div className="max-h-32 overflow-auto rounded-md border border-red-500/40 bg-red-500/5 p-2 text-xs">
                <p className="mb-1 font-semibold text-red-700 dark:text-red-400">Falhas</p>
                <ul className="space-y-0.5">
                  {state.failed.map((f) => (
                    <li key={f.productId} className="text-muted-foreground">
                      <span className="font-medium text-foreground">{f.name}</span> — {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          {running ? (
            <Button variant="outline" size="sm" onClick={onCancel}>
              Interromper
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={exportReport}
                disabled={!state || state.total === 0}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Exportar relatório
              </Button>
              <Button size="sm" onClick={onClose}>
                Fechar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : tone === "negative"
        ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
        : "border-border bg-muted/40 text-muted-foreground";
  return (
    <div className={cn("rounded-md border p-2", toneClass)}>
      <p className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function csv(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
