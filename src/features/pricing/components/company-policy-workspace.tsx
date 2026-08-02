/**
 * CompanyPolicyWorkspace — UX-001 (Commercial Experience)
 * =======================================================
 * Tela de configuração da Política Comercial da Empresa.
 *
 * REGRAS:
 *  - Zero cálculo aqui. Zero regra de negócio.
 *  - Toda leitura/gravação passa por Use Cases via server functions.
 *  - Nenhum acesso direto a Pricing Engine ou Repositories.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  RotateCcw,
  Save,
  BadgeCheck,
  Info,
  Store,
  MessageCircle,
  Instagram,
  Globe,
  ShoppingBag,
  ShoppingCart,
  Lock,
} from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageLayout } from "@/components/layout";
import {
  getCompanyPolicyOverview,
  saveCompanyPolicy,
} from "@/features/pricing/lib/company-policy.functions";
import type { CompanyPolicyInput } from "@/features/pricing/config/company-policy";
import type { CommercialBehaviorSpec, RoundingPolicySpec } from "@/features/pricing/engine/types";

// ─────────────────────────────────────────────────────────────────────────────
// Estado local do formulário (representação plana; conversão apenas no save)
// ─────────────────────────────────────────────────────────────────────────────

type StrategyKey = "high_margin" | "high_turnover" | "premium" | "promotion" | "stock_burn";

type RoundingKey = "none" | "integer" | "end_90" | "end_99" | "psychological";

interface FormState {
  minMargin: string;
  idealMargin: string;
  premiumMargin: string;
  strategy: StrategyKey;
  rounding: RoundingKey;
}

const DEFAULT_FORM: FormState = {
  minMargin: "15",
  idealMargin: "35",
  premiumMargin: "55",
  strategy: "high_margin",
  rounding: "end_90",
};

const STRATEGY_LABEL: Record<StrategyKey, string> = {
  high_margin: "Alta Margem",
  high_turnover: "Alto Giro",
  premium: "Premium",
  promotion: "Promoção",
  stock_burn: "Queima de Estoque",
};

const ROUNDING_LABEL: Record<RoundingKey, string> = {
  none: "Sem arredondamento",
  integer: "Inteiro (R$ 1,00)",
  end_90: "Final 0,90",
  end_99: "Final 0,99",
  psychological: "Outro (psicológico)",
};

// Mapeadores entre form ↔ policy — apenas transformação de shape, sem lógica.

const num = (s: string): number | undefined => {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

function strategyToBehavior(k: StrategyKey): CommercialBehaviorSpec {
  switch (k) {
    case "high_turnover":
      return { kind: "high_turnover" };
    case "promotion":
      return { kind: "promotion", discountPct: 10 };
    case "stock_burn":
      return { kind: "stock_burn", maxDiscountPct: 30 };
    default:
      return { kind: "standard" };
  }
}

function behaviorToStrategy(
  b: CommercialBehaviorSpec | undefined,
  marginTarget: string | undefined,
): StrategyKey {
  if (b?.kind === "high_turnover") return "high_turnover";
  if (b?.kind === "promotion") return "promotion";
  if (b?.kind === "stock_burn") return "stock_burn";
  if (marginTarget === "premium") return "premium";
  return "high_margin";
}

function roundingToPolicy(k: RoundingKey): RoundingPolicySpec {
  switch (k) {
    case "integer":
      return { kind: "integer" };
    case "end_90":
      return { kind: "end_90" };
    case "end_99":
      return { kind: "end_99" };
    case "psychological":
      return { kind: "psychological", endings: [90, 95, 99] };
    default:
      return { kind: "none" };
  }
}

function policyToRounding(r: RoundingPolicySpec | undefined): RoundingKey {
  return (r?.kind as RoundingKey) ?? "none";
}

// ─────────────────────────────────────────────────────────────────────────────
// Canais (Card 5) — visualização mock (edição em telas futuras)
// ─────────────────────────────────────────────────────────────────────────────

const CHANNELS = [
  { id: "store", name: "Loja Física", icon: Store, status: "Ativo", commission: "0%", fee: "0%" },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: MessageCircle,
    status: "Ativo",
    commission: "0%",
    fee: "0,99%",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: Instagram,
    status: "Em breve",
    commission: "—",
    fee: "—",
  },
  { id: "site", name: "Site", icon: Globe, status: "Em breve", commission: "—", fee: "—" },
  {
    id: "ml",
    name: "Mercado Livre",
    icon: ShoppingBag,
    status: "Em breve",
    commission: "16%",
    fee: "R$ 6,00",
  },
  {
    id: "shopee",
    name: "Shopee",
    icon: ShoppingCart,
    status: "Em breve",
    commission: "14%",
    fee: "R$ 4,00",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de UI
// ─────────────────────────────────────────────────────────────────────────────

function HelpTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Ajuda"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  );
}

function LabeledField({
  label,
  help,
  children,
}: {
  label: string;
  help?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        {help ? <HelpTip>{help}</HelpTip> : null}
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace
// ─────────────────────────────────────────────────────────────────────────────

export function CompanyPolicyWorkspace({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const queryKey = ["pricing", "company-policy", companyId] as const;

  const overview = useQuery({
    queryKey,
    queryFn: () => getCompanyPolicyOverview({ data: { companyId } }),
  });

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [dirty, setDirty] = useState(false);

  // Hidrata form a partir do backend quando a query resolve.
  useEffect(() => {
    if (!overview.data) return;
    const p = overview.data.policy?.entity;
    if (!p) {
      setForm(DEFAULT_FORM);
      setDirty(false);
      return;
    }
    setForm({
      minMargin: String(p.defaults?.minMarginPct ?? p.minMarginPct ?? ""),
      idealMargin: String(p.defaults?.idealMarginPct ?? p.idealMarginPct ?? ""),
      premiumMargin: String(p.defaults?.premiumMarginPct ?? p.premiumMarginPct ?? ""),
      strategy: behaviorToStrategy(p.commercialBehavior, p.marginTarget?.kind),
      rounding: policyToRounding(p.roundingPolicy),
    });
    setDirty(false);
  }, [overview.data]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((s) => ({ ...s, [k]: v }));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const strategy = form.strategy;
      const marginTargetKind =
        strategy === "premium"
          ? "premium"
          : strategy === "high_turnover" || strategy === "stock_burn"
            ? "min"
            : "ideal";

      const input: CompanyPolicyInput = {
        companyId,
        currency: overview.data?.policy?.entity.currency ?? "BRL",
        defaults: {
          minMarginPct: num(form.minMargin),
          idealMarginPct: num(form.idealMargin),
          premiumMarginPct: num(form.premiumMargin),
        },
        marginTarget: { kind: marginTargetKind } as CompanyPolicyInput["marginTarget"],
        commercialBehavior: strategyToBehavior(strategy),
        roundingPolicy: roundingToPolicy(form.rounding),
      };

      return saveCompanyPolicy({
        data: {
          input,
          expectedVersion: overview.data?.policy?.meta.version,
        },
      });
    },
    onSuccess: () => {
      toast.success("Política comercial salva");
      setDirty(false);
      qc.invalidateQueries({ queryKey });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Falha ao salvar";
      toast.error(msg);
    },
  });

  const restore = () => {
    const p = overview.data?.policy?.entity;
    if (!p) {
      setForm(DEFAULT_FORM);
    } else {
      setForm({
        minMargin: String(p.defaults?.minMarginPct ?? ""),
        idealMargin: String(p.defaults?.idealMarginPct ?? ""),
        premiumMargin: String(p.defaults?.premiumMarginPct ?? ""),
        strategy: behaviorToStrategy(p.commercialBehavior, p.marginTarget?.kind),
        rounding: policyToRounding(p.roundingPolicy),
      });
    }
    setDirty(false);
    toast.info("Alterações descartadas");
  };

  const meta = overview.data?.policy?.meta;
  const stats = overview.data?.stats;

  const versionBadge = useMemo(() => {
    if (!meta) return null;
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <BadgeCheck className="h-3 w-3" /> v{meta.version}
      </Badge>
    );
  }, [meta]);

  return (
    <TooltipProvider delayDuration={200}>
      <PageLayout
        title="Inteligência Comercial"
        description="Configure as regras comerciais utilizadas automaticamente em toda a empresa."
        meta={versionBadge}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={restore}
              disabled={!dirty || saveMutation.isPending}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" /> Restaurar
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending || overview.isLoading}
            >
              <Save className="mr-1.5 h-4 w-4" />
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Card 1 — Margens */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Margens</CardTitle>
              <CardDescription>
                Referência global para classificação da saúde de preço em Produtos, Vendas e Bella
                IA.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <LabeledField
                label="Margem mínima (%)"
                help="Piso da empresa. Preços abaixo disso são marcados como inseguros."
              >
                <Input
                  inputMode="decimal"
                  value={form.minMargin}
                  onChange={(e) => set("minMargin", e.target.value)}
                />
              </LabeledField>
              <LabeledField
                label="Margem ideal (%)"
                help="Alvo padrão do preço recomendado — usado pelo motor quando nenhuma outra regra vence."
              >
                <Input
                  inputMode="decimal"
                  value={form.idealMargin}
                  onChange={(e) => set("idealMargin", e.target.value)}
                />
              </LabeledField>
              <LabeledField
                label="Margem premium (%)"
                help="Margem aspiracional para produtos de alto valor percebido."
              >
                <Input
                  inputMode="decimal"
                  value={form.premiumMargin}
                  onChange={(e) => set("premiumMargin", e.target.value)}
                />
              </LabeledField>
            </CardContent>
          </Card>

          {/* Card 2 — Estratégia Comercial */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estratégia comercial</CardTitle>
              <CardDescription>
                Comportamento padrão da empresa — orienta o motor sem sobrescrever regras
                específicas de produto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LabeledField label="Estratégia padrão">
                <Select
                  value={form.strategy}
                  onValueChange={(v) => set("strategy", v as StrategyKey)}
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
              </LabeledField>
            </CardContent>
          </Card>

          {/* Card 3 — Arredondamento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Arredondamento</CardTitle>
              <CardDescription>
                Aplicado sobre todos os preços sugeridos pelo motor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LabeledField label="Regra padrão">
                <Select
                  value={form.rounding}
                  onValueChange={(v) => set("rounding", v as RoundingKey)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROUNDING_LABEL) as RoundingKey[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {ROUNDING_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledField>
            </CardContent>
          </Card>

          {/* Card 4 — Custos Operacionais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custos operacionais</CardTitle>
              <CardDescription>
                Descontos aplicados automaticamente ao calcular a margem líquida.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <LabeledField
                label="Comissão padrão (%)"
                help="Vinculada ao canal — atualize por canal no Card de Canais."
              >
                <Input value="" disabled placeholder="Definido por canal" />
              </LabeledField>
              <LabeledField
                label="Despesa operacional (%)"
                help="Em breve: rateio de custos fixos por unidade vendida."
              >
                <Input value="" disabled placeholder="Em breve" />
              </LabeledField>
              <LabeledField
                label="Impostos"
                help="Vem do Tax Engine (integração futura — ADR-002)."
              >
                <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/40 px-3 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Tax Engine (em breve)
                </div>
              </LabeledField>
            </CardContent>
          </Card>

          {/* Card 5 — Canais */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Canais de venda</CardTitle>
              <CardDescription>
                Comissões e taxas por canal. A edição detalhada será liberada em breve.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead className="w-24 text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CHANNELS.map((c) => {
                    const Icon = c.icon;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="grid h-7 w-7 place-items-center rounded-md bg-muted text-muted-foreground">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            {c.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={c.status === "Ativo" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.commission}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.fee}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" disabled title="Em breve">
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Card 6 — Resumo */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Resumo da política</CardTitle>
              <CardDescription>
                Estado atual conforme registrado pela camada de aplicação.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div>
                <SummaryRow
                  label="Política ativa"
                  value={overview.isLoading ? "—" : meta ? "Sim" : "Ainda não configurada"}
                />
                <SummaryRow label="Versão" value={meta ? `v${meta.version}` : "—"} />
                <SummaryRow
                  label="Última atualização"
                  value={meta ? new Date(meta.updatedAt).toLocaleString("pt-BR") : "—"}
                />
                <SummaryRow label="Origem" value="Empresa (padrão global)" />
              </div>
              <div>
                <SummaryRow
                  label="Categorias com política própria"
                  value={stats?.categoriesUsingPolicy ?? 0}
                />
                <SummaryRow
                  label="Produtos sobrescrevendo"
                  value={stats?.productsOverriding ?? 0}
                />
                <SummaryRow label="Moeda" value={overview.data?.policy?.entity.currency ?? "BRL"} />
                <SummaryRow label="Criada por" value={meta?.createdBy ?? "—"} />
              </div>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    </TooltipProvider>
  );
}
