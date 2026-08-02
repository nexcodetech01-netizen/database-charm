/**
 * CategoryPoliciesWorkspace — UX-002 (Commercial Experience)
 * ==========================================================
 * Tela de configuração das Políticas Comerciais por Categoria.
 *
 * REGRAS:
 *  - Zero cálculo aqui. Zero regra de negócio.
 *  - Toda leitura/gravação passa por Use Cases via server functions.
 *  - Nenhum acesso direto a Pricing Engine ou Repositories.
 *  - Origem da política (Empresa herdada vs. Própria) é apenas leitura do backend.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Building2, Layers, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageLayout } from "@/components/layout";
import {
  getCategoryPoliciesOverview,
  saveCategoryPolicy,
  type CategoryPolicyRow,
} from "@/features/pricing/lib/category-policy.functions";
import type { CategoryPolicyInput } from "@/features/pricing/config/category-policy";
import type { CommercialBehaviorSpec } from "@/features/pricing/engine/types";

// ─────────────────────────────────────────────────────────────────────────────
// Estratégia — mesmo mapeamento visual da UX-001
// ─────────────────────────────────────────────────────────────────────────────

type StrategyKey =
  | "inherit"
  | "high_margin"
  | "high_turnover"
  | "premium"
  | "promotion"
  | "stock_burn";

const STRATEGY_LABEL: Record<StrategyKey, string> = {
  inherit: "Herdar da empresa",
  high_margin: "Alta Margem",
  high_turnover: "Alto Giro",
  premium: "Premium",
  promotion: "Promoção",
  stock_burn: "Queima de Estoque",
};

function strategyToBehavior(k: StrategyKey): CommercialBehaviorSpec | undefined {
  switch (k) {
    case "high_turnover":
      return { kind: "high_turnover" };
    case "promotion":
      return { kind: "promotion", discountPct: 10 };
    case "stock_burn":
      return { kind: "stock_burn", maxDiscountPct: 30 };
    case "high_margin":
    case "premium":
      return { kind: "standard" };
    default:
      return undefined;
  }
}

function behaviorToStrategy(
  b: CommercialBehaviorSpec | undefined,
  marginTargetKind: string | undefined,
): StrategyKey {
  if (!b && !marginTargetKind) return "inherit";
  if (b?.kind === "high_turnover") return "high_turnover";
  if (b?.kind === "promotion") return "promotion";
  if (b?.kind === "stock_burn") return "stock_burn";
  if (marginTargetKind === "premium") return "premium";
  return "high_margin";
}

const num = (s: string): number | undefined => {
  const t = String(s).trim();
  if (!t) return undefined;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

// ─────────────────────────────────────────────────────────────────────────────
// Row form state
// ─────────────────────────────────────────────────────────────────────────────

interface EditorState {
  minMargin: string;
  idealMargin: string;
  premiumMargin: string;
  strategy: StrategyKey;
}

const EMPTY_EDITOR: EditorState = {
  minMargin: "",
  idealMargin: "",
  premiumMargin: "",
  strategy: "inherit",
};

function toEditor(row: CategoryPolicyRow): EditorState {
  const p = row.policy?.entity;
  if (!p) return EMPTY_EDITOR;
  return {
    minMargin: p.minMarginPct != null ? String(p.minMarginPct) : "",
    idealMargin: p.idealMarginPct != null ? String(p.idealMarginPct) : "",
    premiumMargin: p.premiumMarginPct != null ? String(p.premiumMarginPct) : "",
    strategy: behaviorToStrategy(p.commercialBehavior, p.marginTarget?.kind),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Origin badges
// ─────────────────────────────────────────────────────────────────────────────

function OriginBadge({ row }: { row: CategoryPolicyRow }) {
  if (row.policy) {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <Layers className="h-3 w-3" /> Própria
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
      <Building2 className="h-3 w-3" /> Herdada da empresa
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace
// ─────────────────────────────────────────────────────────────────────────────

export function CategoryPoliciesWorkspace({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const queryKey = ["pricing", "category-policies", companyId] as const;

  const overview = useQuery({
    queryKey,
    queryFn: () => getCategoryPoliciesOverview({ data: { companyId } }),
  });

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);

  const rows = overview.data?.rows ?? [];
  const companyPolicy = overview.data?.companyPolicy?.entity ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.category.name.toLowerCase().includes(q));
  }, [rows, search]);

  const selected = useMemo(
    () => rows.find((r) => r.category.id === selectedId) ?? null,
    [rows, selectedId],
  );

  // Hidrata editor quando a seleção muda ou os dados são atualizados.
  useEffect(() => {
    if (selected) setEditor(toEditor(selected));
  }, [selected]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione uma categoria");
      const strategy = editor.strategy;

      const marginTargetKind =
        strategy === "premium"
          ? "premium"
          : strategy === "high_turnover" || strategy === "stock_burn"
            ? "min"
            : strategy === "inherit"
              ? undefined
              : "ideal";

      const input: CategoryPolicyInput = {
        categoryId: selected.category.id,
        name: selected.category.name,
        minMarginPct: num(editor.minMargin),
        idealMarginPct: num(editor.idealMargin),
        premiumMarginPct: num(editor.premiumMargin),
        marginTarget: marginTargetKind
          ? ({ kind: marginTargetKind } as CategoryPolicyInput["marginTarget"])
          : undefined,
        commercialBehavior: strategyToBehavior(strategy),
      };

      return saveCategoryPolicy({
        data: {
          companyId,
          input,
          expectedVersion: selected.policy?.meta.version,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Política da categoria salva");
      await qc.invalidateQueries({ queryKey });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Falha ao salvar";
      toast.error(msg);
    },
  });

  const companyBadge = companyPolicy ? (
    <Badge variant="secondary" className="gap-1 text-[10px]">
      <BadgeCheck className="h-3 w-3" />
      Empresa: min {companyPolicy.defaults?.minMarginPct ?? "—"}% · ideal{" "}
      {companyPolicy.defaults?.idealMarginPct ?? "—"}% · premium{" "}
      {companyPolicy.defaults?.premiumMarginPct ?? "—"}%
    </Badge>
  ) : null;

  return (
    <PageLayout
      title="Políticas por Categoria"
      description="Sobrescreva a política comercial da empresa em categorias específicas. Categorias sem política própria herdam automaticamente a empresa."
      meta={companyBadge}
    >
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Categorias</CardTitle>
            <CardDescription>
              {rows.length} categorias · {rows.filter((r) => r.policy).length} com política própria
            </CardDescription>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar categoria..."
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Mín.</TableHead>
                <TableHead className="text-right">Ideal</TableHead>
                <TableHead className="text-right">Premium</TableHead>
                <TableHead>Estratégia</TableHead>
                <TableHead className="text-right">Versão</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Carregando categorias...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhuma categoria encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const p = row.policy?.entity;
                  const effMin = p?.minMarginPct ?? companyPolicy?.defaults?.minMarginPct;
                  const effIdeal = p?.idealMarginPct ?? companyPolicy?.defaults?.idealMarginPct;
                  const effPremium =
                    p?.premiumMarginPct ?? companyPolicy?.defaults?.premiumMarginPct;
                  const strat = p
                    ? STRATEGY_LABEL[behaviorToStrategy(p.commercialBehavior, p.marginTarget?.kind)]
                    : STRATEGY_LABEL.inherit;
                  return (
                    <TableRow
                      key={row.category.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(row.category.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {row.category.color ? (
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: row.category.color }}
                            />
                          ) : null}
                          <span className="font-medium text-foreground">{row.category.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <OriginBadge row={row} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {effMin != null ? `${effMin}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {effIdeal != null ? `${effIdeal}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {effPremium != null ? `${effPremium}%` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{strat}</TableCell>
                      <TableCell className="text-right text-[10px] text-muted-foreground tabular-nums">
                        {row.policy ? `v${row.policy.meta.version}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(row.category.id);
                          }}
                        >
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.category.name}
                  <OriginBadge row={selected} />
                </SheetTitle>
                <SheetDescription>
                  Deixe os campos em branco para herdar o valor da política da empresa. Apenas os
                  campos preenchidos serão considerados como sobrescrita desta categoria.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Margem mínima (%)
                    </Label>
                    <Input
                      inputMode="decimal"
                      placeholder={
                        companyPolicy?.defaults?.minMarginPct != null
                          ? String(companyPolicy.defaults.minMarginPct)
                          : "—"
                      }
                      value={editor.minMargin}
                      onChange={(e) => setEditor((s) => ({ ...s, minMargin: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Margem ideal (%)
                    </Label>
                    <Input
                      inputMode="decimal"
                      placeholder={
                        companyPolicy?.defaults?.idealMarginPct != null
                          ? String(companyPolicy.defaults.idealMarginPct)
                          : "—"
                      }
                      value={editor.idealMargin}
                      onChange={(e) => setEditor((s) => ({ ...s, idealMargin: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Margem premium (%)
                    </Label>
                    <Input
                      inputMode="decimal"
                      placeholder={
                        companyPolicy?.defaults?.premiumMarginPct != null
                          ? String(companyPolicy.defaults.premiumMarginPct)
                          : "—"
                      }
                      value={editor.premiumMargin}
                      onChange={(e) =>
                        setEditor((s) => ({
                          ...s,
                          premiumMargin: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Estratégia comercial
                  </Label>
                  <Select
                    value={editor.strategy}
                    onValueChange={(v) => setEditor((s) => ({ ...s, strategy: v as StrategyKey }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STRATEGY_LABEL) as StrategyKey[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {STRATEGY_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Origem</span>
                    <OriginBadge row={selected} />
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Versão da política</span>
                    <span className="tabular-nums text-foreground">
                      {selected.policy ? `v${selected.policy.meta.version}` : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-6">
                <Button
                  variant="outline"
                  onClick={() => setSelectedId(null)}
                  disabled={saveMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <Save className="mr-1.5 h-4 w-4" />
                  {saveMutation.isPending ? "Salvando..." : "Salvar política"}
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </PageLayout>
  );
}
