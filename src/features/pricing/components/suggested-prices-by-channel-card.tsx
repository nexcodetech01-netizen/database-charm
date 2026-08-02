/**
 * SuggestedPricesByChannelCard
 * ============================
 * Componente único e reutilizável para exibir sugestões de preço por
 * canal de venda usando o motor puro de Inteligência Comercial
 * (`@/features/pricing/calculator`).
 *
 * Dois modos, mesma UI e mesma lógica de cálculo:
 *
 *   1. mode="product"  → busca custo total + margem alvo via server fn
 *      `getProductPricingIntelligence` (produto persistido).
 *   2. mode="local"    → recebe custo total + margem alvo do formulário
 *      em edição, permitindo pré-visualização em tempo real durante
 *      cadastro/edição do produto (ainda não salvo).
 *
 * Zero regra nova de negócio: apenas apresentação por canal.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  Info,
  Lightbulb,
  MessageCircleQuestion,
  RefreshCw,
  Sparkles,
  Store,
  ShoppingBag,
  Globe,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { computeOfficialPricing } from "@/features/pricing/official";
import { worstCaseFee, effectiveFeePct } from "@/features/pricing/official/fees";
import { useCompanyFeeTable } from "@/features/pricing/hooks/use-company-fee-table";
import {
  getProductPricingIntelligence,
  type ProductPricingIntelligenceDTO,
} from "@/features/pricing/lib/product-pricing.functions";
import {
  getProductChannelSettings,
  saveProductChannelSettings,
  type ProductChannelSettingsDTO,
} from "@/features/pricing/lib/channel-settings.functions";
import { friendlyPricingMessage } from "./product-pricing-intelligence-card";

type Props =
  | {
      mode?: "product";
      companyId: string;
      productId: string;
      /** Callback opcional — recebe o preço-base (Loja Física) sugerido em R$. */
      onApplySuggested?: (recommendedPrice: number) => void;
    }
  | {
      mode: "local";
      /** Custo total unitário em centavos (custo + frete + seguro + outros). */
      costTotalCents: number;
      /** Margem alvo em % (ex.: 30 para 30%). */
      targetMarginPct: number;
      /** Preço atualmente praticado na Loja Física (centavos) — usado no modo "Manter lucro". */
      currentStorePriceCents?: number;
      /** Identificador opcional para contextualizar a Bella IA. */
      productId?: string;
      /** Callback opcional — recebe o preço-base (Loja Física) sugerido em R$. */
      onApplySuggested?: (recommendedPrice: number) => void;
    };

/**
 * Estratégias de recomendação suportadas.
 *
 *  - `policy`           → motor atual (custo + margem da política + taxa do canal).
 *  - `keep_store_profit`→ mantém o lucro líquido da Loja Física em cada canal
 *                          (P_canal = P_loja / (1 - taxa_canal)). Não usa margem
 *                          da política e não altera nenhuma fórmula existente.
 */
type Strategy = "policy" | "keep_store_profit";

interface ChannelPreset {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  feePct: number;
  hint: string;
  /** Tarifa/custo fixo padrão em R$ por unidade vendida no canal. */
  defaultFixedCost: number;
}

/**
 * Canais de venda. A taxa de RECEBIMENTO (Loja Física / Site) vem sempre da
 * tabela única da empresa (`payment_method_fees` → `official/fees.ts`).
 * Apenas a COMISSÃO de marketplace é preset do canal, e é editável.
 */
const MARKETPLACE_COMMISSION_PCT = 16;

function buildChannels(paymentFeePct: number): readonly ChannelPreset[] {
  const fee = Math.max(0, Number(paymentFeePct) || 0);
  return [
    {
      id: "store",
      label: "Loja Física",
      icon: Store,
      feePct: fee,
      hint: `Taxa de recebimento da empresa (${fee.toFixed(2)}%)`,
      defaultFixedCost: 0,
    },
    {
      id: "site",
      label: "Site próprio",
      icon: Globe,
      feePct: fee,
      hint: `Gateway Asaas (${fee.toFixed(2)}%)`,
      defaultFixedCost: 0,
    },
    {
      id: "ml",
      label: "Mercado Livre",
      icon: ShoppingBag,
      feePct: MARKETPLACE_COMMISSION_PCT,
      hint: "Comissão clássica ~16% + tarifa fixa",
      defaultFixedCost: 6,
    },
  ];
}

const DEFAULT_FIXED_COSTS: Record<string, number> = { store: 0, site: 0, ml: 6 };

const LOW_MARGIN_ALERT_PCT = 10;

export function SuggestedPricesByChannelCard(props: Props) {
  const isLocal = props.mode === "local";
  const navigate = useNavigate();

  // Modo produto persistido — usa server fn + React Query
  const qc = useQueryClient();
  const companyId = !isLocal ? props.companyId : "";
  const productId = !isLocal ? props.productId : "";
  const queryKey = ["pricing", "product-intelligence", companyId, productId] as const;
  // FASE 4 — taxas SEMPRE da tabela única da empresa.
  const { feeTable } = useCompanyFeeTable(companyId);

  const query = useQuery({
    queryKey,
    queryFn: () => getProductPricingIntelligence({ data: { companyId, productId } }),
    enabled: !isLocal && Boolean(companyId && productId),
  });

  // Modo local — recalcula on-demand via bump para forçar novo memo
  const [localTick, setLocalTick] = useState(0);

  // ── Persistência (apenas modo produto) ──────────────────────────────
  const settingsKey = ["pricing", "channel-settings", companyId, productId] as const;
  const settingsQuery = useQuery({
    queryKey: settingsKey,
    queryFn: () => getProductChannelSettings({ data: { companyId, productId } }),
    enabled: !isLocal && Boolean(companyId && productId),
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: (settings: ProductChannelSettingsDTO) =>
      saveProductChannelSettings({
        data: { companyId, productId, settings },
      }),
    onSuccess: (data) => {
      qc.setQueryData(settingsKey, data);
    },
  });

  // Estratégia de recomendação (toggle na UI). Padrão preserva o
  // comportamento histórico: política comercial.
  const [strategy, setStrategy] = useState<Strategy>("policy");

  // Custo fixo por canal (R$/unidade) — editável na UI.
  const [fixedCosts, setFixedCosts] = useState<Record<string, number>>(() => ({
    ...DEFAULT_FIXED_COSTS,
  }));

  // Margem alvo customizada por canal (%) — editável na UI. Ausente = usa
  // a margem alvo do snapshot (política comercial).
  const [channelMargins, setChannelMargins] = useState<Record<string, number>>({});

  // Estratégia individual por canal (toggle no card do marketplace).
  // Loja Física é sempre "policy".
  const [channelStrategies, setChannelStrategies] = useState<Record<string, Strategy>>({});

  // Hidrata estados locais quando as configurações salvas chegam do servidor.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (isLocal || !settingsQuery.data || hydratedRef.current) return;
    hydratedRef.current = true;
    const saved = settingsQuery.data;
    if (saved.globalStrategy) setStrategy(saved.globalStrategy);

    const nextFixed: Record<string, number> = { ...DEFAULT_FIXED_COSTS };
    const nextMargins: Record<string, number> = {};
    const nextStrategies: Record<string, Strategy> = {};
    for (const [id, entry] of Object.entries(saved.channels ?? {})) {
      if (typeof entry.fixedCost === "number") nextFixed[id] = entry.fixedCost;
      if (typeof entry.marginPct === "number") nextMargins[id] = entry.marginPct;
      if (entry.strategy) nextStrategies[id] = entry.strategy;
    }
    setFixedCosts(nextFixed);
    setChannelMargins(nextMargins);
    setChannelStrategies(nextStrategies);
  }, [isLocal, settingsQuery.data]);

  // Default inteligente: se o produto já tem preço de venda maior que o
  // custo, "Manter lucro em R$" produz o resultado esperado por padrão
  // (âncora = Loja Física). Só aplica quando não há preferência salva e
  // o usuário ainda não interagiu com a estratégia.
  const strategyAutoPickedRef = useRef(false);
  useEffect(() => {
    if (isLocal) return;
    if (strategyAutoPickedRef.current) return;
    if (!settingsQuery.data) return;
    if (settingsQuery.data.globalStrategy) {
      strategyAutoPickedRef.current = true;
      return;
    }
    if (!query.data) return;
    const cost = query.data.product.costTotalCents / 100;
    const store = query.data.product.currentPriceCents / 100;
    if (store > 0 && store > cost) {
      setStrategy("keep_store_profit");
    }
    strategyAutoPickedRef.current = true;
  }, [isLocal, settingsQuery.data, query.data]);

  // Serializa e persiste (debounced) sempre que o usuário altera algo.
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isLocal || !hydratedRef.current) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const channels: ProductChannelSettingsDTO["channels"] = {};
      const ids = new Set<string>([
        ...Object.keys(fixedCosts),
        ...Object.keys(channelMargins),
        ...Object.keys(channelStrategies),
      ]);
      for (const id of ids) {
        const entry: ProductChannelSettingsDTO["channels"][string] = {};
        const fc = fixedCosts[id];
        const defaultFc = DEFAULT_FIXED_COSTS[id] ?? 0;
        if (typeof fc === "number" && fc !== defaultFc) entry.fixedCost = fc;
        const mg = channelMargins[id];
        if (typeof mg === "number") entry.marginPct = mg;
        const st = channelStrategies[id];
        if (st) entry.strategy = st;
        if (Object.keys(entry).length > 0) channels[id] = entry;
      }
      saveMutation.mutate({ globalStrategy: strategy, channels });
    }, 500);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocal, strategy, fixedCosts, channelMargins, channelStrategies]);

  const snapshot: {
    costTotal: number;
    targetMarginPct: number;
    currentStorePrice: number;
  } | null = useMemo(() => {
    if (isLocal) {
      const costTotal = Math.max(0, (props.costTotalCents ?? 0) / 100);
      const targetMarginPct = Number.isFinite(props.targetMarginPct) ? props.targetMarginPct : 30;
      const currentStorePrice = Math.max(0, (props.currentStorePriceCents ?? 0) / 100);
      return { costTotal, targetMarginPct, currentStorePrice };
    }
    if (query.data) {
      return {
        costTotal: query.data.product.costTotalCents / 100,
        targetMarginPct: Number.isFinite(query.data.targetMarginPct)
          ? query.data.targetMarginPct
          : 30,
        currentStorePrice: query.data.product.currentPriceCents / 100,
      };
    }
    return null;
  }, [
    isLocal,
    isLocal ? props.costTotalCents : null,
    isLocal ? props.targetMarginPct : null,
    isLocal ? props.currentStorePriceCents : null,
    query.data,
    localTick,
  ]);

  const channels = useMemo(() => {
    const reference = snapshot?.currentStorePrice || 100;
    return buildChannels(effectiveFeePct(worstCaseFee(feeTable, reference), reference));
  }, [feeTable, snapshot?.currentStorePrice]);

  const rows = useMemo(
    () =>
      buildRows(
        snapshot,
        strategy,
        fixedCosts,
        channelMargins,
        channelStrategies,
        channels,
        companyId,
      ),
    [snapshot, strategy, fixedCosts, channelMargins, channelStrategies, channels, companyId],
  );

  // "Manter lucro" só faz sentido com preço de loja > custo.
  const keepProfitAvailable =
    !!snapshot && snapshot.currentStorePrice > 0 && snapshot.currentStorePrice > snapshot.costTotal;

  const recalc = () => {
    if (isLocal) {
      setLocalTick((t) => t + 1);
    } else {
      qc.invalidateQueries({ queryKey });
    }
  };

  const askBella = () => {
    const pid = isLocal ? props.productId : props.productId;
    if (pid) {
      navigate({ to: "/bella", search: { productId: pid } as never });
    } else {
      navigate({ to: "/bella" });
    }
  };

  const loading = !isLocal && query.isLoading;
  const errored = !isLocal && (query.isError || !query.data);
  const isFetching = !isLocal && query.isFetching;

  const insights = useMemo(() => buildInsights(rows), [rows]);
  const basePriceRow = rows.find((r) => r.id === "store") ?? rows[0];
  const canApply =
    Boolean(props.onApplySuggested) &&
    Boolean(basePriceRow) &&
    !basePriceRow?.unreachable &&
    basePriceRow.priceCents > 0;

  const applySuggested = () => {
    if (!canApply || !basePriceRow || !props.onApplySuggested) return;
    props.onApplySuggested(basePriceRow.priceCents / 100);
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Sugerido pelo NexOS
            </p>
            <CardTitle className="text-base">Preços recomendados por canal</CardTitle>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              {strategy === "policy"
                ? "Valores calculados com base na margem ideal da política comercial e nas taxas estimadas de cada canal. Não representam necessariamente o preço atual praticado."
                : "Valores calculados para manter, em cada canal, o mesmo lucro líquido praticado hoje na Loja Física — descontando a taxa estimada do canal."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Segmento de estratégia — preserva o motor atual e adiciona
              a estratégia "Manter lucro da Loja Física". */}
          <div className="inline-flex rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setStrategy("policy")}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                strategy === "policy"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Política comercial
            </button>
            <button
              type="button"
              onClick={() => setStrategy("keep_store_profit")}
              disabled={!keepProfitAvailable}
              title={
                keepProfitAvailable
                  ? "Manter o mesmo lucro líquido da Loja Física em todos os canais"
                  : "Defina um preço de Loja Física maior que o custo para habilitar"
              }
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                strategy === "keep_store_profit"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
                !keepProfitAvailable && "cursor-not-allowed opacity-50",
              )}
            >
              Manter lucro da Loja Física
            </button>
          </div>

          {snapshot && strategy === "policy" ? (
            <Badge variant="outline" className="gap-1 text-[10px]">
              Política comercial • {formatPercent(snapshot.targetMarginPct)}%
            </Badge>
          ) : null}
          {snapshot && strategy === "keep_store_profit" ? (
            <Badge variant="outline" className="gap-1 text-[10px]">
              Loja Física • {formatCurrency(snapshot.currentStorePrice)}
            </Badge>
          ) : null}

          <Button variant="outline" size="sm" onClick={recalc} disabled={isFetching}>
            <RefreshCw className={cn("mr-1.5 h-4 w-4", isFetching && "animate-spin")} />
            Atualizar preços
          </Button>
          <Button variant="outline" size="sm" onClick={askBella}>
            <MessageCircleQuestion className="mr-1.5 h-4 w-4" />
            Perguntar para Bella
          </Button>
          {props.onApplySuggested && strategy === "policy" ? (
            <Button size="sm" onClick={applySuggested} disabled={!canApply}>
              <Check className="mr-1.5 h-4 w-4" />
              Aplicar preços sugeridos
            </Button>
          ) : null}
          {props.onApplySuggested && strategy === "keep_store_profit" ? (
            <p className="max-w-xs text-[11px] leading-snug text-muted-foreground">
              Os preços exibidos são apenas uma simulação para os marketplaces com base no preço
              atual da Loja Física. Não há preço para aplicar.
            </p>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Calculando preços por canal…</p>
        ) : errored ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {friendlyPricingMessage(query.error)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Defina a política comercial da sua empresa para ver sugestões por canal.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/inteligencia-comercial/politica-empresa">
                Configurar política comercial
              </Link>
            </Button>
          </div>
        ) : !snapshot ? (
          <p className="text-sm text-muted-foreground">
            Informe custo e margem para ver sugestões.
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <ChannelTile
                  key={r.id}
                  row={r}
                  fixedCost={fixedCosts[r.id] ?? 0}
                  costTotal={snapshot.costTotal}
                  currentStorePrice={snapshot.currentStorePrice}
                  keepProfitAvailable={keepProfitAvailable}
                  hasMarginOverride={
                    channelMargins[r.id] !== undefined && Number.isFinite(channelMargins[r.id])
                  }
                  onChangeFixedCost={(v) => setFixedCosts((prev) => ({ ...prev, [r.id]: v }))}
                  onChangeMargin={(v) =>
                    setChannelMargins((prev) => {
                      const next = { ...prev };
                      if (v === null) delete next[r.id];
                      else next[r.id] = v;
                      return next;
                    })
                  }
                  onChangeStrategy={(s) => setChannelStrategies((prev) => ({ ...prev, [r.id]: s }))}
                />
              ))}
            </div>

            {insights.length > 0 ? (
              <div className="space-y-1.5 rounded-lg border border-primary/15 bg-primary/[0.03] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                  <Lightbulb className="h-3.5 w-3.5" /> Bella sugere
                </p>
                <ul className="space-y-1">
                  {insights.map((msg, i) => (
                    <li key={i} className="text-xs text-foreground/80">
                      {msg}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="text-[11px] text-muted-foreground">
              {strategy === "policy" ? (
                <>
                  Base: custo total {formatCurrency(snapshot.costTotal)} + margem alvo{" "}
                  {formatPercent(snapshot.targetMarginPct)}%. Taxas de canal são estimativas usadas
                  para orientação — ajuste conforme seu contrato com cada marketplace.
                </>
              ) : (
                <>
                  Base: preço da Loja Física {formatCurrency(snapshot.currentStorePrice)} (lucro
                  líquido de{" "}
                  {formatCurrency(Math.max(0, snapshot.currentStorePrice - snapshot.costTotal))}
                  ). Cada canal é ajustado para preservar esse mesmo lucro após a taxa estimada — a
                  margem da política não é aplicada nesse modo.
                </>
              )}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Insights derivados (sem novo motor — apenas leitura das rows já calculadas)
// ─────────────────────────────────────────────────────────────────────────────

function buildInsights(rows: readonly Row[]): readonly string[] {
  const viable = rows.filter((r) => !r.unreachable && r.priceCents > 0);
  if (viable.length === 0) return [];

  const out: string[] = [];

  const best = [...viable].sort((a, b) => b.profitCents - a.profitCents)[0];
  if (best) {
    out.push(
      `💡 ${best.label} é o canal com maior lucro (${formatCurrency(best.profitCents / 100)} por unidade).`,
    );
  }

  const low = viable.filter((r) => r.lowMargin);
  for (const r of low.slice(0, 2)) {
    out.push(`⚠️ ${r.label} está abaixo da margem mínima (${formatPercent(r.marginPct)}%).`);
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

interface Row {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  feePct: number;
  hint: string;
  fixedCost: number;
  /** Margem alvo efetiva usada no cálculo (override do canal ou snapshot). */
  targetMarginPct: number;
  /** Estratégia efetiva usada na linha. */
  strategy: Strategy;
  priceCents: number;
  profitCents: number;
  marginPct: number;
  lowMargin: boolean;
  unreachable: boolean;
}

/**
 * Regras de arredondamento — únicas para TODOS os canais e modos.
 * ---------------------------------------------------------------
 * - PRICE_ROUNDING: preço sugerido é sempre elevado ao próximo múltiplo
 *   terminado em ,90 (nunca para baixo), preservando a margem-alvo.
 * - MONEY_DECIMALS: valores monetários derivados (lucro, custo de venda)
 *   são arredondados ao centavo mais próximo (2 casas).
 * - PERCENT_DECIMALS: percentuais exibidos ficam com 2 casas decimais.
 * Assim, os cálculos são consistentes entre "Manter margem %" e "Manter
 * lucro em R$", entre Loja Física e Marketplaces, e entre a UI e o popover.
 */
const MONEY_DECIMALS = 2;
const PERCENT_DECIMALS = 2;

const roundMoney = (v: number): number => {
  if (!Number.isFinite(v)) return 0;
  const factor = 10 ** MONEY_DECIMALS;
  return Math.round(v * factor) / factor;
};

const roundPercent = (v: number): number => {
  if (!Number.isFinite(v)) return 0;
  const factor = 10 ** PERCENT_DECIMALS;
  return Math.round(v * factor) / factor;
};

/** Arredonda para o próximo múltiplo terminado em .90 — nunca para baixo. */
const ceilToEnd90 = (v: number): number => {
  if (!Number.isFinite(v) || v <= 0) return 0;
  const base = Math.floor(v);
  const candidate = base + 0.9;
  return candidate + 1e-9 >= v ? candidate : base + 1.9;
};

function buildRows(
  snapshot: { costTotal: number; targetMarginPct: number; currentStorePrice: number } | null,
  globalStrategy: Strategy,
  fixedCosts: Record<string, number>,
  channelMargins: Record<string, number> = {},
  channelStrategies: Record<string, Strategy> = {},
  channels: readonly ChannelPreset[] = buildChannels(0),
  companyId = "",
): readonly Row[] {
  if (!snapshot) return [];
  const { costTotal, targetMarginPct, currentStorePrice } = snapshot;

  return channels.map((c) => {
    const feeRate = c.feePct / 100;
    const fixedCost = Math.max(0, Number(fixedCosts[c.id] ?? 0) || 0);
    const effectiveCost = costTotal + fixedCost;

    // Margem alvo efetiva: override por canal ou snapshot da política.
    const rawMargin = channelMargins[c.id];
    const effectiveMarginPct =
      Number.isFinite(rawMargin) && (rawMargin as number) >= 0
        ? (rawMargin as number)
        : targetMarginPct;

    // ─────────────────────────────────────────────────────────────────
    // LOJA FÍSICA — SEMPRE REFERÊNCIA INALTERÁVEL
    // Nunca é recalculada. Reflete literalmente o preço de venda real
    // do produto e o lucro real (preço − custo total). Isso garante
    // que todos os demais canais usem a Loja Física como âncora
    // confiável para os cálculos de "Manter lucro em R$".
    // ─────────────────────────────────────────────────────────────────
    if (c.id === "store") {
      const storePrice = roundMoney(currentStorePrice);
      const storeProfit = roundMoney(storePrice - costTotal);
      const storeMarginPct = storePrice > 0 ? roundPercent((storeProfit / storePrice) * 100) : 0;
      const storeUnreachable = storePrice <= 0;
      return {
        id: c.id,
        label: c.label,
        icon: c.icon,
        feePct: 0,
        hint: c.hint,
        fixedCost: 0,
        targetMarginPct: effectiveMarginPct,
        strategy: "policy" as Strategy,
        priceCents: Math.round(storePrice * 100),
        profitCents: Math.round(storeProfit * 100),
        marginPct: storeMarginPct,
        lowMargin: !storeUnreachable && storeMarginPct < LOW_MARGIN_ALERT_PCT,
        unreachable: storeUnreachable,
      } satisfies Row;
    }

    const strategy: Strategy = channelStrategies[c.id] ?? globalStrategy;

    let raw: number;
    let unreachable: boolean;

    if (strategy === "policy") {
      // MOTOR ÚNICO — nenhuma fórmula local (FASE 1/2).
      const official = computeOfficialPricing({
        companyId,
        productId: `channel:${c.id}`,
        costs: { acquisition: costTotal },
        margins: { minPct: 0, targetPct: effectiveMarginPct },
        fee: { pct: c.feePct, fixed: fixedCost, label: c.label },
        module: "pricing.channels",
      });
      raw = official.recommendedPrice;
      unreachable = !Number.isFinite(raw) || raw <= 0;
    } else {
      // Manter Lucro em R$ (âncora: Loja Física):
      // Preço = (Preço Loja Física + Tarifa Fixa) / (1 − Taxa%)
      // Garante que, após taxa % e tarifa fixa, sobre exatamente o
      // lucro líquido praticado na Loja Física (Preço Loja − Custo).
      const storeReachable = currentStorePrice > 0 && currentStorePrice > costTotal && feeRate < 1;
      raw = storeReachable ? (currentStorePrice + fixedCost) / (1 - feeRate) : 0;
      unreachable = !storeReachable || !Number.isFinite(raw) || raw <= 0;
    }

    // Regra única de arredondamento de preço para TODOS os modos/canais.
    const price = unreachable ? 0 : ceilToEnd90(raw);

    // Derivados calculados a partir do preço já arredondado, para que
    // Lucro (R$) e Margem (%) reflitam exatamente o valor cobrado.
    const netPrice = roundMoney(price * (1 - feeRate));
    const profit = roundMoney(netPrice - costTotal - fixedCost);
    const marginPct = price > 0 ? roundPercent((profit / price) * 100) : 0;

    return {
      id: c.id,
      label: c.label,
      icon: c.icon,
      feePct: c.feePct,
      hint: c.hint,
      fixedCost,
      targetMarginPct: effectiveMarginPct,
      strategy,
      priceCents: Math.round(price * 100),
      profitCents: Math.round(profit * 100),
      marginPct,
      lowMargin: !unreachable && marginPct < LOW_MARGIN_ALERT_PCT,
      unreachable,
    };
  });
}

interface ChannelTileProps {
  row: Row;
  fixedCost: number;
  costTotal: number;
  currentStorePrice: number;
  keepProfitAvailable: boolean;
  hasMarginOverride: boolean;
  onChangeFixedCost: (value: number) => void;
  onChangeMargin: (value: number | null) => void;
  onChangeStrategy: (value: Strategy) => void;
}

function ChannelTile({
  row,
  fixedCost,
  costTotal,
  currentStorePrice,
  keepProfitAvailable,
  hasMarginOverride,
  onChangeFixedCost,
  onChangeMargin,
  onChangeStrategy,
}: ChannelTileProps) {
  const Icon = row.icon;
  const price = row.priceCents / 100;
  const profit = row.profitCents / 100;
  const channelFeeAmount = price * (row.feePct / 100);
  const isStore = row.id === "store";
  const strategy = row.strategy;

  const [fixedCostInput, setFixedCostInput] = useState<string>(
    fixedCost > 0 ? fixedCost.toFixed(2).replace(".", ",") : "",
  );
  const externalFixedKey = `${row.id}:${fixedCost}`;
  const [lastFixedKey, setLastFixedKey] = useState(externalFixedKey);
  if (lastFixedKey !== externalFixedKey) {
    setLastFixedKey(externalFixedKey);
    setFixedCostInput(fixedCost > 0 ? fixedCost.toFixed(2).replace(".", ",") : "");
  }

  const [marginInput, setMarginInput] = useState<string>(
    row.targetMarginPct
      .toFixed(2)
      .replace(/\.?0+$/, "")
      .replace(".", ","),
  );
  const externalMarginKey = `${row.id}:${row.targetMarginPct}:${hasMarginOverride}`;
  const [lastMarginKey, setLastMarginKey] = useState(externalMarginKey);
  if (lastMarginKey !== externalMarginKey) {
    setLastMarginKey(externalMarginKey);
    setMarginInput(
      row.targetMarginPct
        .toFixed(2)
        .replace(/\.?0+$/, "")
        .replace(".", ","),
    );
  }

  const [fixedCostError, setFixedCostError] = useState<string | null>(null);
  const [marginError, setMarginError] = useState<string | null>(null);

  const FIXED_COST_MAX = 100_000; // R$ por unidade — teto defensivo
  const MARGIN_MIN = 0;
  const MARGIN_MAX = 99.99; // < 100 evita denominador ≤ 0

  const commitFixedCost = (raw: string) => {
    const normalized = raw.replace(/\./g, "").replace(",", ".").trim();
    if (normalized === "") {
      setFixedCostError(null);
      onChangeFixedCost(0);
      return;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      setFixedCostError("Valor inválido");
      return;
    }
    if (parsed < 0) {
      setFixedCostError("Não pode ser negativo");
      return;
    }
    if (parsed > FIXED_COST_MAX) {
      setFixedCostError(`Máximo ${formatCurrency(FIXED_COST_MAX)}`);
      return;
    }
    setFixedCostError(null);
    onChangeFixedCost(parsed);
  };

  const commitMargin = (raw: string) => {
    const normalized = raw.replace(/\./g, "").replace(",", ".").trim();
    if (normalized === "") {
      setMarginError(null);
      onChangeMargin(null);
      return;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      setMarginError("Valor inválido");
      return;
    }
    if (parsed < MARGIN_MIN) {
      setMarginError("Não pode ser negativa");
      return;
    }
    if (parsed >= 100) {
      setMarginError("Deve ser menor que 100%");
      return;
    }
    if (parsed > MARGIN_MAX) {
      setMarginError(`Máximo ${MARGIN_MAX}%`);
      return;
    }
    if (parsed + row.feePct >= 100) {
      setMarginError(`Margem + taxa do canal (${formatPercent(row.feePct)}%) deve ser < 100%`);
      return;
    }
    setMarginError(null);
    onChangeMargin(parsed);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 transition-colors",
        row.unreachable
          ? "border-destructive/40 bg-destructive/5"
          : row.lowMargin
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-border bg-card hover:border-primary/30",
      )}
    >
      {/* Cabeçalho — canal + taxa estimada */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{row.label}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.hint}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="outline" className="text-[10px] font-medium">
            Taxa {formatPercent(row.feePct)}%
          </Badge>
          <FormulaBreakdownPopover
            row={row}
            fixedCost={fixedCost}
            costTotal={costTotal}
            currentStorePrice={currentStorePrice}
          />
        </div>
      </div>

      {/* Toggle de estratégia por canal — marketplaces apenas */}
      {!isStore ? (
        <div
          className="inline-flex w-full rounded-md border border-border p-0.5"
          role="group"
          aria-label={`Modo de cálculo para ${row.label}`}
        >
          <button
            type="button"
            onClick={() => onChangeStrategy("policy")}
            className={cn(
              "flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors",
              strategy === "policy"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Manter margem %
          </button>
          <button
            type="button"
            disabled={!keepProfitAvailable}
            onClick={() => onChangeStrategy("keep_store_profit")}
            title={
              keepProfitAvailable
                ? "Repassa a taxa deste canal preservando o mesmo lucro em R$ da Loja Física"
                : "Defina um preço de Loja Física maior que o custo para habilitar"
            }
            className={cn(
              "flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors",
              strategy === "keep_store_profit"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
              !keepProfitAvailable && "cursor-not-allowed opacity-50",
            )}
          >
            Manter lucro em R$
          </button>
        </div>
      ) : null}

      {row.unreachable ? (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            {isStore
              ? "Defina o preço de venda deste produto."
              : strategy === "keep_store_profit"
                ? "Defina um preço de Loja Física maior que o custo."
                : "Margem alvo + taxa do canal ≥ 100%."}
          </span>
        </div>
      ) : (
        <>
          {/* Preço em destaque — Loja Física mostra o preço REAL do produto */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {isStore ? "Preço de venda atual" : "Preço sugerido de venda"}
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatCurrency(price)}
            </p>
          </div>

          {/* Detalhamento financeiro — matemática transparente */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 text-xs">
            {!isStore ? (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Custo de venda
                </p>
                {fixedCost > 0 ? (
                  <div className="space-y-0.5">
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      Taxa {formatPercent(row.feePct)}%: −{formatCurrency(channelFeeAmount)}
                    </p>
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      Tarifa fixa: −{formatCurrency(fixedCost)}
                    </p>
                    <p className="font-semibold tabular-nums text-foreground">
                      Total: −{formatCurrency(channelFeeAmount + fixedCost)}
                    </p>
                  </div>
                ) : (
                  <p className="font-medium tabular-nums text-foreground">
                    −{formatCurrency(channelFeeAmount)}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Custo do produto
                </p>
                <p className="font-medium tabular-nums text-foreground">
                  −{formatCurrency(costTotal)}
                </p>
              </div>
            )}
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {isStore ? "Margem real" : "Margem efetiva"}
              </p>
              <p
                className={cn(
                  "flex items-center justify-end gap-1 font-medium tabular-nums",
                  row.lowMargin ? "text-amber-600 dark:text-amber-400" : "text-foreground",
                )}
              >
                {row.lowMargin ? <AlertTriangle className="h-3 w-3" /> : null}
                {formatPercent(row.marginPct)}%
              </p>
            </div>

            {/* Margem alvo customizada por canal — apenas nos marketplaces em modo "Manter margem %" */}
            {!isStore && strategy === "policy" ? (
              <div className="col-span-2 flex items-center justify-between gap-2 rounded-md border border-dashed border-border/70 px-2.5 py-1.5">
                <label
                  htmlFor={`target-margin-${row.id}`}
                  className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  title="Margem alvo % aplicada sobre a venda neste canal. Vazio = usa a margem da política comercial."
                >
                  Margem alvo (%)
                  {hasMarginOverride ? <span className="ml-1 text-primary">•</span> : null}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id={`target-margin-${row.id}`}
                    type="text"
                    inputMode="decimal"
                    value={marginInput}
                    aria-invalid={marginError ? true : undefined}
                    aria-describedby={marginError ? `target-margin-${row.id}-err` : undefined}
                    onChange={(e) => {
                      setMarginInput(e.target.value);
                      if (marginError) setMarginError(null);
                    }}
                    onBlur={(e) => commitMargin(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitMargin((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="30"
                    className={cn(
                      "h-7 w-16 rounded-md border bg-background px-2 text-right text-xs tabular-nums outline-none focus:ring-2",
                      marginError
                        ? "border-destructive focus:ring-destructive/30"
                        : "border-input focus:ring-primary/30",
                    )}
                  />
                  <span className="text-[11px] text-muted-foreground">%</span>
                </div>
              </div>
            ) : null}
            {!isStore && strategy === "policy" && marginError ? (
              <p
                id={`target-margin-${row.id}-err`}
                className="col-span-2 -mt-1 flex items-center gap-1 text-[10px] font-medium text-destructive"
              >
                <AlertTriangle className="h-3 w-3" /> {marginError}
              </p>
            ) : null}

            {/* Tarifa/custo fixo por canal — editável (não se aplica à Loja Física) */}
            {!isStore ? (
              <div className="col-span-2 flex items-center justify-between gap-2 rounded-md border border-dashed border-border/70 px-2.5 py-1.5">
                <label
                  htmlFor={`fixed-cost-${row.id}`}
                  className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  title="Custo fixo adicional por unidade vendida neste canal (ex.: tarifa fixa do Mercado Livre em anúncios abaixo de R$ 79)."
                >
                  Tarifa/custo fixo (R$)
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">R$</span>
                  <input
                    id={`fixed-cost-${row.id}`}
                    type="text"
                    inputMode="decimal"
                    value={fixedCostInput}
                    aria-invalid={fixedCostError ? true : undefined}
                    aria-describedby={fixedCostError ? `fixed-cost-${row.id}-err` : undefined}
                    onChange={(e) => {
                      setFixedCostInput(e.target.value);
                      if (fixedCostError) setFixedCostError(null);
                    }}
                    onBlur={(e) => commitFixedCost(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitFixedCost((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="0,00"
                    className={cn(
                      "h-7 w-20 rounded-md border bg-background px-2 text-right text-xs tabular-nums outline-none focus:ring-2",
                      fixedCostError
                        ? "border-destructive focus:ring-destructive/30"
                        : "border-input focus:ring-primary/30",
                    )}
                  />
                </div>
              </div>
            ) : null}
            {!isStore && fixedCostError ? (
              <p
                id={`fixed-cost-${row.id}-err`}
                className="col-span-2 -mt-1 flex items-center gap-1 text-[10px] font-medium text-destructive"
              >
                <AlertTriangle className="h-3 w-3" /> {fixedCostError}
              </p>
            ) : null}

            <div className="col-span-2 flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {isStore ? "Lucro real do produto" : "Lucro líquido estimado"}
              </span>
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  profit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                )}
              >
                {formatCurrency(profit)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface FormulaBreakdownPopoverProps {
  row: Row;
  fixedCost: number;
  costTotal: number;
  currentStorePrice: number;
}

function FormulaBreakdownPopover({
  row,
  fixedCost,
  costTotal,
  currentStorePrice,
}: FormulaBreakdownPopoverProps) {
  const price = row.priceCents / 100;
  const profit = row.profitCents / 100;
  const feeRate = row.feePct / 100;
  const feeAmount = price * feeRate;
  const effectiveCost = costTotal + fixedCost;
  const isKeepProfit = row.strategy === "keep_store_profit";
  const denominator = isKeepProfit ? 1 - feeRate : 1 - (feeRate + row.targetMarginPct / 100);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Ver detalhes do cálculo"
          className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 text-xs">
        <div className="border-b border-border px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Como calculamos — {row.label}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Modo:{" "}
            <span className="font-medium text-foreground">
              {isKeepProfit ? "Manter lucro em R$" : "Manter margem %"}
            </span>
          </p>
        </div>

        <div className="space-y-2.5 px-3 py-3">
          {/* Bases */}
          <div className="rounded-md bg-muted/40 p-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Entradas
            </p>
            <div className="space-y-0.5 text-[11px]">
              <BreakdownRow label="Custo total do produto" value={formatCurrency(costTotal)} />
              <BreakdownRow label="Tarifa/custo fixo" value={formatCurrency(fixedCost)} />
              <BreakdownRow
                label="Custo efetivo (base)"
                value={formatCurrency(effectiveCost)}
                strong
              />
              <BreakdownRow label="Taxa do canal" value={`${formatPercent(row.feePct)}%`} />
              {isKeepProfit ? (
                <BreakdownRow
                  label="Preço da Loja Física"
                  value={formatCurrency(currentStorePrice)}
                />
              ) : (
                <BreakdownRow
                  label="Margem alvo"
                  value={`${formatPercent(row.targetMarginPct)}%`}
                />
              )}
            </div>
          </div>

          {/* Fórmula do Preço */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Preço sugerido
            </p>
            {isKeepProfit ? (
              <>
                <p className="rounded-md bg-primary/5 px-2 py-1.5 font-mono text-[11px] text-foreground">
                  Preço = (Preço Loja + Tarifa fixa) / (1 − Taxa)
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  = ({formatCurrency(currentStorePrice)} + {formatCurrency(fixedCost)}) / (1 −{" "}
                  {feeRate.toFixed(4)}) ={" "}
                  {denominator > 0
                    ? formatCurrency((currentStorePrice + fixedCost) / denominator)
                    : "—"}
                </p>
              </>
            ) : (
              <>
                <p className="rounded-md bg-primary/5 px-2 py-1.5 font-mono text-[11px] text-foreground">
                  Preço = Custo efetivo / (1 − (Taxa + Margem alvo))
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  = {formatCurrency(effectiveCost)} / (1 − ({feeRate.toFixed(4)} +{" "}
                  {(row.targetMarginPct / 100).toFixed(4)})) ={" "}
                  {denominator > 0 ? formatCurrency(effectiveCost / denominator) : "—"}
                </p>
              </>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">
              Arredondado para o próximo final ,90 →{" "}
              <span className="font-semibold text-foreground">{formatCurrency(price)}</span>
            </p>
          </div>

          {/* Fórmula do Lucro */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Lucro líquido
            </p>
            <p className="rounded-md bg-primary/5 px-2 py-1.5 font-mono text-[11px] text-foreground">
              Lucro = Preço − (Preço × Taxa) − Custo total − Tarifa fixa
            </p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              = {formatCurrency(price)} − {formatCurrency(feeAmount)} − {formatCurrency(costTotal)}{" "}
              − {formatCurrency(fixedCost)} ={" "}
              <span
                className={cn(
                  "font-semibold",
                  profit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                )}
              >
                {formatCurrency(profit)}
              </span>
            </p>
          </div>

          {/* Margem efetiva */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Margem efetiva
            </p>
            <p className="rounded-md bg-primary/5 px-2 py-1.5 font-mono text-[11px] text-foreground">
              Margem = Lucro / Preço × 100
            </p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              = {formatCurrency(profit)} / {formatCurrency(price)} × 100 ={" "}
              <span className="font-semibold text-foreground">{formatPercent(row.marginPct)}%</span>
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BreakdownRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn("tabular-nums", strong ? "font-semibold text-foreground" : "text-foreground")}
      >
        {value}
      </span>
    </div>
  );
}
