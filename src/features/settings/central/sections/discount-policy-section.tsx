import { useState, useEffect, useMemo } from "react";
import { Save, Percent, Sparkles, Receipt } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useResolvedCompanyId } from "@/hooks/use-resolved-company-id";
import {
  DEFAULT_DISCOUNT_POLICY,
  useDiscountPolicy,
  type DiscountEnforcement,
  type DiscountPolicy,
} from "@/features/sales/lib/discount-policy";
import { SALE_PAYMENT_METHODS } from "@/features/sales/types";
import {
  useBellaFeeCatalog,
  type BellaFeeSnapshot,
} from "@/features/bella-pay/lib/fee-catalog";


/**
 * PDV-015 — Política Inteligente de Descontos.
 * UX-only: persiste em localStorage por empresa via useDiscountPolicy.
 */
export function DiscountPolicySection() {
  const { user } = useAuth();
  const { companyId: resolvedCompanyId } = useResolvedCompanyId(user?.id);
  const companyId = resolvedCompanyId ?? "default";

  const [saved, updatePolicy] = useDiscountPolicy(companyId);
  const [draft, setDraft] = useState<DiscountPolicy>(saved);

  useEffect(() => setDraft(saved), [saved]);

  // Taxas reutilizadas do Bella Pay (não duplica configuração).
  const { snapshots, ready: feesReady } = useBellaFeeCatalog(companyId);

  // Margem média dos produtos ativos — base para a recomendação da Bella.
  const { data: avgMargin } = useQuery({
    queryKey: ["settings", "avg-margin", companyId],
    enabled: !!resolvedCompanyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("margin")
        .eq("company_id", resolvedCompanyId as string)
        .eq("status", "active")
        .limit(1000);
      if (!data || data.length === 0) return null;
      const nums = data
        .map((r) => Number(r.margin) || 0)
        .filter((n) => n > 0);
      if (nums.length === 0) return null;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    },
  });

  // Recomendação da Bella: metade da margem média, descontando a maior taxa
  // percentual entre as formas de pagamento permitidas. Nunca > 15%.
  const bellaRecommendation = useMemo(() => {
    if (!feesReady) return null;
    const allowed = draft.allowedMethods.length
      ? draft.allowedMethods
      : ["pix", "cash"];
    const allowedFees = snapshots.filter((s) => allowed.includes(s.method));
    const highestFeePct = allowedFees.reduce(
      (max, s) => Math.max(max, s.percent),
      0,
    );
    const margin = avgMargin ?? 25; // fallback comercial saudável
    const raw = (margin - highestFeePct) / 2;
    const rounded = Math.round(raw);
    const clamped = Math.max(1, Math.min(15, rounded));
    return {
      percent: clamped,
      basis: {
        margin,
        highestFeePct,
        hasMarginData: avgMargin != null,
      },
    };
  }, [snapshots, feesReady, draft.allowedMethods, avgMargin]);

  function toggleMethod(value: string, on: boolean) {

    setDraft((d) => ({
      ...d,
      allowedMethods: on
        ? Array.from(new Set([...d.allowedMethods, value]))
        : d.allowedMethods.filter((m) => m !== value),
    }));
  }

  function reset() {
    setDraft(DEFAULT_DISCOUNT_POLICY);
  }

  function save() {
    const clean: DiscountPolicy = {
      ...draft,
      maxPercent: Math.max(0, Math.min(100, Number(draft.maxPercent) || 0)),
    };
    updatePolicy(clean);
    toast.success("Política de descontos salva");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">Política de Descontos</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                O sistema decide quando desconto é permitido. O operador não
                precisa lembrar da regra.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">
              Permitir descontos
            </Label>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) =>
                setDraft((d) => ({ ...d, enabled: Boolean(v) }))
              }
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-2">
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label className="text-xs text-muted-foreground">
              Desconto máximo padrão (%)
            </Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                disabled={!draft.enabled}
                value={String(draft.maxPercent)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    maxPercent: Number(e.target.value) || 0,
                  }))
                }
                className="pr-8 text-right tabular-nums"
              />
              <Percent className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Aplicar desconto em
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {SALE_PAYMENT_METHODS.map((m) => {
                const on = draft.allowedMethods.includes(m.value);
                return (
                  <label
                    key={m.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                      on ? "border-primary bg-primary/5" : "border-border"
                    } ${!draft.enabled ? "opacity-50" : ""}`}
                  >
                    <Checkbox
                      checked={on}
                      disabled={!draft.enabled}
                      onCheckedChange={(v) => toggleMethod(m.value, Boolean(v))}
                    />
                    <span>{m.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Quando ultrapassar o limite
            </Label>
            <RadioGroup
              value={draft.enforcement}
              onValueChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  enforcement: v as DiscountEnforcement,
                }))
              }
              disabled={!draft.enabled}
              className="grid gap-2 sm:grid-cols-3"
            >
              <EnforcementOption
                value="block"
                label="Bloquear"
                desc="Operador não consegue salvar a venda."
                selected={draft.enforcement === "block"}
              />
              <EnforcementOption
                value="request_manager"
                label="Solicitar gerente"
                desc="Aguarda autorização do gerente."
                selected={draft.enforcement === "request_manager"}
              />
              <EnforcementOption
                value="allow"
                label="Permitir"
                desc="Registra o desconto e segue."
                selected={draft.enforcement === "allow"}
              />
            </RadioGroup>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button variant="ghost" size="sm" onClick={reset}>
              Restaurar padrão (5%, PIX + Dinheiro, gerente)
            </Button>
            <Button size="sm" onClick={save}>
              <Save className="mr-1.5 h-3.5 w-3.5" /> Salvar política
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bella recomenda — usa margem média + taxas Bella Pay */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-sm">Bella recomenda</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Com suas taxas atuais e margem média, o desconto ideal para
                pagamentos à vista é:
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {!bellaRecommendation ? (
            <p className="text-xs text-muted-foreground">
              Calculando recomendação…
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-3xl font-semibold tracking-tight text-primary">
                  {bellaRecommendation.percent}%
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {bellaRecommendation.basis.hasMarginData
                    ? `Margem média ${bellaRecommendation.basis.margin.toFixed(0)}%`
                    : "Sem histórico — usando margem estimada de 25%"}
                  {bellaRecommendation.basis.highestFeePct > 0
                    ? ` · descontada a maior taxa (${bellaRecommendation.basis.highestFeePct
                        .toFixed(2)
                        .replace(".", ",")}%)`
                    : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDraft((d) => ({
                    ...d,
                    maxPercent: bellaRecommendation.percent,
                  }));
                  toast.success(
                    `Recomendação aplicada: ${bellaRecommendation.percent}% (clique em Salvar).`,
                  );
                }}
              >
                Usar recomendação
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referência de taxas Bella Pay (somente leitura — configurado em Bella Pay) */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-foreground">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">Taxas Bella Pay</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Reutilizadas da sua configuração de Bella Pay. Para alterar,
                acesse Configurações → Bella Pay.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="divide-y rounded-md border text-sm">
            {snapshots.map((s) => (
              <FeeRow key={s.method} snap={s} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FeeRow({ snap }: { snap: BellaFeeSnapshot }) {
  const feeLabel =
    snap.percent <= 0 && snap.fixed <= 0
      ? "sem taxa"
      : snap.percent <= 0
        ? new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(snap.fixed)
        : snap.fixed <= 0
          ? `${snap.percent.toFixed(2).replace(".", ",")}%`
          : `${snap.percent.toFixed(2).replace(".", ",")}% + ${new Intl.NumberFormat(
              "pt-BR",
              { style: "currency", currency: "BRL" },
            ).format(snap.fixed)}`;

  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-foreground">{snap.label}</span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {feeLabel}
      </span>
    </div>
  );
}


function EnforcementOption({
  value,
  label,
  desc,
  selected,
}: {
  value: string;
  label: string;
  desc: string;
  selected: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition ${
        selected ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <RadioGroupItem value={value} className="mt-0.5" />
      <div>
        <div className="font-medium">{label}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </label>
  );
}
