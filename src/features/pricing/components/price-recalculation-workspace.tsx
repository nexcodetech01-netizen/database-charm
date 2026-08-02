/**
 * PriceRecalculationWorkspace — Ferramenta "Recalcular Preços"
 * ============================================================
 * - Lista TODOS os produtos com preço atual vs preço calculado pelo
 *   Pricing Engine novo.
 * - Permite aplicar em lote com confirmação explícita do usuário.
 * - Atualiza apenas products.price (via applyProductSuggestedPrice).
 * - NÃO altera SKU, custo, estoque ou histórico.
 * - Registra auditoria de cada preço aplicado (RegisterPricingDecision).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  Info,
  RefreshCw,
  Search,
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
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getPriceRecalculationList,
  type RecalculationItemDTO,
  type RecalculationMarginKind,
} from "@/features/pricing/lib/price-recalculation.functions";
import { applyProductSuggestedPrice } from "@/features/pricing/lib/product-pricing.functions";

const MARGIN_TARGET_LABEL: Record<RecalculationMarginKind, string> = {
  min: "Mínima",
  ideal: "Ideal",
  premium: "Premium",
};

const cents = (n: number | null | undefined) => formatCurrency(((n ?? 0) as number) / 100);

interface AppliedItem {
  readonly productId: string;
  readonly name: string;
  readonly previousPriceCents: number;
  readonly appliedPriceCents: number;
  readonly explainId: string;
  readonly decisionId: string;
}
interface FailedItem {
  readonly productId: string;
  readonly name: string;
  readonly error: string;
}
interface BulkState {
  readonly running: boolean;
  readonly total: number;
  readonly done: number;
  readonly currentName: string | null;
  readonly canceled: boolean;
  readonly applied: readonly AppliedItem[];
  readonly failed: readonly FailedItem[];
}

type FilterMode = "divergent" | "all" | "up" | "down" | "below_margin";

interface Props {
  companyId: string;
}

export function PriceRecalculationWorkspace({ companyId }: Props) {
  const queryClient = useQueryClient();
  const [marginTarget, setMarginTarget] = useState<RecalculationMarginKind>("ideal");
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["price-recalculation-list", companyId, marginTarget],
    queryFn: () => getPriceRecalculationList({ data: { companyId, marginTarget } }),
    staleTime: 30_000,
  });

  const items = useMemo<readonly RecalculationItemDTO[]>(() => data?.items ?? [], [data]);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [mode, setMode] = useState<FilterMode>("all");

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of items)
      if (r.categoryId && r.categoryName) map.set(r.categoryId, r.categoryName);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (categoryId !== "all" && r.categoryId !== categoryId) return false;
      if (mode === "divergent" && (r.skipped || r.differenceCents === 0)) return false;
      if (mode === "up" && (r.skipped || r.differenceCents <= 0)) return false;
      if (mode === "down" && (r.skipped || r.differenceCents >= 0)) return false;
      if (mode === "below_margin" && !r.belowMinMargin) return false;
      if (q) {
        const hay = `${r.name} ${r.sku ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, categoryId, mode]);

  // ─── Split em dois grupos (aumento vs redução)
  const increases = useMemo(
    () => filtered.filter((r) => !r.skipped && r.differenceCents > 0),
    [filtered],
  );
  const reductions = useMemo(
    () => filtered.filter((r) => !r.skipped && r.differenceCents < 0),
    [filtered],
  );
  const neutrals = useMemo(
    () => filtered.filter((r) => r.skipped || r.differenceCents === 0),
    [filtered],
  );

  // ─── Seleção — SOMENTE aumentos são selecionáveis/aplicáveis em lote.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const applicableIds = useMemo(() => increases.map((r) => r.productId), [increases]);

  // Modo auditoria: nenhum produto é selecionado automaticamente.
  // Se o conjunto de aumentos mudar, apenas descartamos IDs que não existem mais.
  const autoSelectKey = useMemo(() => applicableIds.join("|"), [applicableIds]);
  useEffect(() => {
    setSelected((prev) => {
      const allow = new Set(applicableIds);
      const next = new Set<string>();
      prev.forEach((id) => {
        if (allow.has(id)) next.add(id);
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectKey]);

  const pageSelectedCount = applicableIds.filter((id) => selected.has(id)).length;
  const pageAllSelected = applicableIds.length > 0 && pageSelectedCount === applicableIds.length;
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
      if (checked) applicableIds.forEach((id) => next.add(id));
      else applicableIds.forEach((id) => next.delete(id));
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const selectedItems = useMemo(() => {
    const byId = new Map(increases.map((r) => [r.productId, r] as const));
    return Array.from(selected)
      .map((id) => byId.get(id))
      .filter((r): r is RecalculationItemDTO => !!r);
  }, [increases, selected]);

  const selectedSummary = useMemo(() => {
    const cur = selectedItems.reduce((s, r) => s + r.currentPriceCents, 0);
    const rec = selectedItems.reduce((s, r) => s + r.recommendedPriceCents, 0);
    return { count: selectedItems.length, cur, rec, impact: rec - cur };
  }, [selectedItems]);

  // ─── Aplicação individual
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
        queryKey: ["price-recalculation-list", companyId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["commercial-dashboard", companyId],
      });
    },
    onError: (err: Error) => {
      toast.error("Falha ao aplicar preço", {
        description: err.message ?? "Tente novamente.",
      });
    },
  });

  // ─── Bulk apply com confirmação
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkState, setBulkState] = useState<BulkState | null>(null);
  const cancelRef = useRef(false);

  const runBulkApply = async () => {
    cancelRef.current = false;
    const initial: BulkState = {
      running: true,
      total: selectedItems.length,
      done: 0,
      applied: [],
      failed: [],
      currentName: null,
      canceled: false,
    };
    setBulkState(initial);

    for (let i = 0; i < selectedItems.length; i++) {
      if (cancelRef.current) {
        setBulkState((s) => (s ? { ...s, canceled: true, running: false, currentName: null } : s));
        break;
      }
      const it = selectedItems[i];
      setBulkState((s) => (s ? { ...s, currentName: it.name } : s));
      try {
        const res = await applyProductSuggestedPrice({
          data: { companyId, productId: it.productId, strategy: "final" },
        });
        setBulkState((s) =>
          s
            ? {
                ...s,
                done: s.done + 1,
                applied: [
                  ...s.applied,
                  {
                    productId: it.productId,
                    name: it.name,
                    previousPriceCents: it.currentPriceCents,
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
                    productId: it.productId,
                    name: it.name,
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
      queryKey: ["price-recalculation-list", companyId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["commercial-dashboard", companyId],
    });
    clearSelection();
  };

  const summary = useMemo(() => {
    const total = data?.totalProducts ?? 0;
    const divergent = data?.totalDivergent ?? 0;
    const skipped = data?.totalSkipped ?? 0;
    const totalImpact = (data?.recommendedSumCents ?? 0) - (data?.currentSumCents ?? 0);
    return { total, divergent, skipped, totalImpact };
  }, [data]);

  return (
    <PageLayout
      icon={Calculator}
      title="Recalcular Preços"
      description="Relatório de auditoria: compara o preço atual com o preço calculado pelo Pricing Engine. Nenhum preço é alterado automaticamente e nenhum produto vem pré-selecionado — a aplicação (individual ou em lote) só ocorre por ação manual sua."
      meta={
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="gap-1">
            <Calculator className="h-3 w-3" />
            {summary.total} produtos analisados
          </Badge>
          <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
            Alvo: {MARGIN_TARGET_LABEL[marginTarget]}
          </Badge>
          {summary.divergent > 0 ? (
            <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
              {summary.divergent} divergentes
            </Badge>
          ) : null}
          {summary.skipped > 0 ? (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400"
            >
              {summary.skipped} sem custo / sem política
            </Badge>
          ) : null}
          {summary.totalImpact !== 0 ? (
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                summary.totalImpact > 0
                  ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                  : "border-red-500/40 text-red-600 dark:text-red-400",
              )}
            >
              Impacto total {summary.totalImpact > 0 ? "+" : ""}
              {cents(summary.totalImpact)}
            </Badge>
          ) : null}
        </div>
      }
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("mr-1 h-4 w-4", isFetching && "animate-spin")} />
          Recalcular
        </Button>
      }
      toolbar={
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome ou SKU..."
              className="pl-9"
            />
          </div>
          <Select
            value={marginTarget}
            onValueChange={(v) => setMarginTarget(v as RecalculationMarginKind)}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Alvo de margem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="min">Margem mínima</SelectItem>
              <SelectItem value="ideal">Margem ideal (padrão)</SelectItem>
              <SelectItem value="premium">Margem premium</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full sm:w-[200px]">
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
          <Select value={mode} onValueChange={(v) => setMode(v as FilterMode)}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Exibir" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              <SelectItem value="divergent">Somente com divergência</SelectItem>
              <SelectItem value="up">Preço deve subir</SelectItem>
              <SelectItem value="down">Preço deve cair</SelectItem>
              <SelectItem value="below_margin">Abaixo da margem mínima</SelectItem>
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
          title="Erro ao carregar produtos"
          description="Não foi possível calcular os preços. Tente novamente."
          action={<Button onClick={() => refetch()}>Tentar novamente</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nenhum produto para recalcular"
          description="Todos os produtos estão dentro do critério selecionado ou já refletem o preço calculado."
        />
      ) : (
        <div className="space-y-3">
          {/* Barra de seleção */}
          {selected.size > 0 ? (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <strong>{selectedSummary.count}</strong> selecionado(s) · Atual{" "}
                {cents(selectedSummary.cur)} → Novo <strong>{cents(selectedSummary.rec)}</strong>
                <span
                  className={cn(
                    "ml-2 font-medium",
                    selectedSummary.impact > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : selectedSummary.impact < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                  )}
                >
                  ({selectedSummary.impact > 0 ? "+" : ""}
                  {cents(selectedSummary.impact)})
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Limpar seleção
                </Button>
                <Button
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={selectedSummary.count === 0}
                >
                  Aplicar preços em lote
                </Button>
              </div>
            </div>
          ) : null}

          <GroupedRecalcTable
            title="Produtos com aumento de preço"
            description="Nenhum produto é selecionado automaticamente. Marque manualmente os que deseja recalcular — o botão “Aplicar em lote” aparece somente quando há seleção."
            tone="up"
            rows={increases}
            selectable
            selected={selected}
            onToggleRow={toggleRow}
            onTogglePage={togglePage}
            pageAllSelected={pageAllSelected}
            pageSomeSelected={pageSomeSelected}
            onApplyRow={(id) => applyMutation.mutate(id)}
            applyPending={applyMutation.isPending}
          />

          <GroupedRecalcTable
            title="Produtos com redução de preço"
            description="Exibidos apenas para conferência. Não são selecionados nem aplicados em lote."
            tone="down"
            rows={reductions}
            selectable={false}
            selected={selected}
            onToggleRow={toggleRow}
            onTogglePage={togglePage}
            pageAllSelected={false}
            pageSomeSelected={false}
            onApplyRow={() => {}}
            applyPending={false}
          />

          {neutrals.length > 0 && mode === "all" ? (
            <GroupedRecalcTable
              title="Sem divergência ou sem dados"
              description="Produtos já alinhados ou sem custo/política."
              tone="neutral"
              rows={neutrals}
              selectable={false}
              selected={selected}
              onToggleRow={toggleRow}
              onTogglePage={togglePage}
              pageAllSelected={false}
              pageSomeSelected={false}
              onApplyRow={() => {}}
              applyPending={false}
            />
          ) : null}
        </div>
      )}

      {/* Confirmação de aplicação em lote */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(v) => {
          if (bulkState?.running) return;
          setConfirmOpen(v);
          if (!v) setBulkState(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar aplicação em lote</DialogTitle>
            <DialogDescription>
              Esta ação vai atualizar o preço de venda de <strong>{selectedSummary.count}</strong>{" "}
              produto(s) <strong>com aumento de preço</strong>. Nenhum produto com redução será
              alterado. SKU, custo, estoque e histórico permanecem intactos. Cada preço aplicado é
              registrado em auditoria.
            </DialogDescription>
          </DialogHeader>

          {!bulkState ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Soma atual</span>
                <span className="tabular-nums">{cents(selectedSummary.cur)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Soma nova</span>
                <span className="tabular-nums font-medium">{cents(selectedSummary.rec)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Impacto</span>
                <span
                  className={cn(
                    "tabular-nums font-medium",
                    selectedSummary.impact > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : selectedSummary.impact < 0
                        ? "text-red-600 dark:text-red-400"
                        : "",
                  )}
                >
                  {selectedSummary.impact > 0 ? "+" : ""}
                  {cents(selectedSummary.impact)}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Progress
                value={bulkState.total > 0 ? (bulkState.done / bulkState.total) * 100 : 0}
              />
              <div className="text-sm text-muted-foreground">
                {bulkState.running
                  ? `Aplicando ${bulkState.done + 1}/${bulkState.total}: ${bulkState.currentName ?? ""}`
                  : bulkState.canceled
                    ? "Aplicação cancelada."
                    : "Aplicação concluída."}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                >
                  {bulkState.applied.length} aplicados
                </Badge>
                {bulkState.failed.length > 0 ? (
                  <Badge
                    variant="outline"
                    className="border-red-500/40 text-red-600 dark:text-red-400"
                  >
                    {bulkState.failed.length} falharam
                  </Badge>
                ) : null}
              </div>
              {!bulkState.running && bulkState.applied.length > 0
                ? (() => {
                    const changed = bulkState.applied.filter(
                      (a) => a.appliedPriceCents !== a.previousPriceCents,
                    );
                    const unchanged = bulkState.applied.length - changed.length;
                    const diffs = changed.map((a) => ({
                      name: a.name,
                      diff: a.appliedPriceCents - a.previousPriceCents,
                    }));
                    const biggestUp = diffs.reduce(
                      (m, x) => (x.diff > (m?.diff ?? -Infinity) ? x : m),
                      null as { name: string; diff: number } | null,
                    );
                    const biggestDown = diffs.reduce(
                      (m, x) => (x.diff < (m?.diff ?? Infinity) ? x : m),
                      null as { name: string; diff: number } | null,
                    );
                    return (
                      <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Recalculados</span>
                          <span className="tabular-nums font-medium">
                            {bulkState.applied.length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Alterados</span>
                          <span className="tabular-nums font-medium">{changed.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Permaneceram iguais</span>
                          <span className="tabular-nums">{unchanged}</span>
                        </div>
                        {biggestUp && biggestUp.diff > 0 ? (
                          <div className="flex justify-between border-t border-border pt-1.5">
                            <span className="text-muted-foreground">Maior aumento</span>
                            <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                              +{cents(biggestUp.diff)} · {biggestUp.name}
                            </span>
                          </div>
                        ) : null}
                        {biggestDown && biggestDown.diff < 0 ? (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Maior redução</span>
                            <span className="tabular-nums text-red-600 dark:text-red-400">
                              {cents(biggestDown.diff)} · {biggestDown.name}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })()
                : null}
              {bulkState.failed.length > 0 ? (
                <div className="max-h-40 overflow-auto rounded-lg border border-border bg-muted/40 p-2 text-xs">
                  {bulkState.failed.map((f) => (
                    <div key={f.productId} className="py-0.5">
                      <span className="font-medium">{f.name}:</span>{" "}
                      <span className="text-muted-foreground">{f.error}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            {!bulkState ? (
              <>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={runBulkApply} disabled={selectedSummary.count === 0}>
                  Confirmar e aplicar
                </Button>
              </>
            ) : bulkState.running ? (
              <Button
                variant="outline"
                onClick={() => {
                  cancelRef.current = true;
                }}
              >
                Cancelar restantes
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setConfirmOpen(false);
                  setBulkState(null);
                }}
              >
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

interface GroupedRecalcTableProps {
  readonly title: string;
  readonly description: string;
  readonly tone: "up" | "down" | "neutral";
  readonly rows: readonly RecalculationItemDTO[];
  readonly selectable: boolean;
  readonly selected: Set<string>;
  readonly onToggleRow: (id: string, checked: boolean) => void;
  readonly onTogglePage: (checked: boolean) => void;
  readonly pageAllSelected: boolean;
  readonly pageSomeSelected: boolean;
  readonly onApplyRow: (id: string) => void;
  readonly applyPending: boolean;
}

function GroupedRecalcTable({
  title,
  description,
  tone,
  rows,
  selectable,
  selected,
  onToggleRow,
  onTogglePage,
  pageAllSelected,
  pageSomeSelected,
  onApplyRow,
  applyPending,
}: GroupedRecalcTableProps) {
  if (rows.length === 0) return null;
  const toneBadge =
    tone === "up"
      ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
      : tone === "down"
        ? "border-red-500/40 text-red-600 dark:text-red-400"
        : "border-border text-muted-foreground";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-1 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            {tone === "up" ? (
              <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : tone === "down" ? (
              <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />
            ) : null}
            {title}
            <Badge variant="outline" className={cn("ml-1", toneBadge)}>
              {rows.length}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              {selectable ? (
                <Checkbox
                  checked={pageAllSelected}
                  onCheckedChange={(v) => onTogglePage(!!v)}
                  aria-label="Selecionar todos"
                  data-state={pageSomeSelected ? "indeterminate" : undefined}
                />
              ) : null}
            </TableHead>
            <TableHead>Produto</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Preço atual</TableHead>
            <TableHead className="text-right">Preço calculado</TableHead>
            <TableHead className="text-right">Diferença</TableHead>
            <TableHead className="text-right">Margem de Lucro atual</TableHead>
            <TableHead className="text-right">Margem alvo</TableHead>
            <TableHead className="text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const isChecked = selected.has(r.productId);
            return (
              <TableRow key={r.productId} className={cn(r.skipped && "opacity-60")}>
                <TableCell>
                  {selectable ? (
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(v) => onToggleRow(r.productId, !!v)}
                      aria-label={`Selecionar ${r.name}`}
                    />
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.sku ? `SKU ${r.sku}` : "Sem SKU"}
                    {r.belowMinMargin ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        Abaixo da margem
                      </span>
                    ) : null}
                    {r.skipped ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <XCircle className="h-3 w-3" />
                        {r.skipReason === "missing_cost"
                          ? "Sem custo cadastrado"
                          : "Sem política da empresa"}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <RowStatusBadge row={r} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.categoryName ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {cents(r.currentPriceCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {r.skipped ? "—" : cents(r.recommendedPriceCents)}
                </TableCell>
                <TableCell className="text-right">
                  {r.skipped ? (
                    "—"
                  ) : r.differenceCents === 0 ? (
                    <span className="text-muted-foreground">R$ 0,00</span>
                  ) : (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 tabular-nums",
                        r.differenceCents > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {r.differenceCents > 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {r.differenceCents > 0 ? "+" : ""}
                      {cents(r.differenceCents)}
                      <span className="text-xs text-muted-foreground">
                        ({r.differencePct > 0 ? "+" : ""}
                        {r.differencePct.toFixed(1)}%)
                      </span>
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {r.skipped ? "—" : `${r.currentMarginPct.toFixed(1)}%`}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {r.skipped ? "—" : `${r.targetMarginPct.toFixed(1)}%`}
                </TableCell>
                <TableCell className="text-right">
                  {selectable ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={applyPending}
                      onClick={() => onApplyRow(r.productId)}
                    >
                      Aplicar
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function RowStatusBadge({ row }: { row: RecalculationItemDTO }) {
  if (row.skipped) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400"
      >
        <XCircle className="h-3 w-3" />
        Sem dados
      </Badge>
    );
  }
  if (row.differenceCents === 0) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
      >
        <CheckCircle2 className="h-3 w-3" />
        Já alinhado
      </Badge>
    );
  }
  if (row.differenceCents > 0) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400"
      >
        <ArrowUpRight className="h-3 w-3" />
        Precisa de aumento
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-red-500/40 text-red-600 dark:text-red-400">
      <ArrowDownRight className="h-3 w-3" />
      Precisa de redução
    </Badge>
  );
}
