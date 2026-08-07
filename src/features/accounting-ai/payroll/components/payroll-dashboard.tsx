import React, { useMemo, useState } from "react";
import { 
  History, 
  TrendingUp, 
  TrendingDown, 
  PiggyBank, 
  Wallet, 
  Calculator, 
  ShieldCheck, 
  ShieldAlert,
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/format";
import { 
  FinancialCard, 
  SummaryGrid, 
} from "../../components";
import type { FinancialAdvice } from "../../advisor/types";
import type { AccountingSummary } from "../../types";
import { buildFinancialAdvice } from "../../advisor/engine";

interface PayrollDashboardProps {
  summary: AccountingSummary | null;
  advice: FinancialAdvice | null;
  loading?: boolean;
}

export function PayrollDashboard({ summary, advice, loading }: PayrollDashboardProps) {
  const [simulationValue, setSimulationValue] = useState<number>(0);

  const simulationAdvice = useMemo(() => {
    if (!summary || simulationValue === 0) return null;
    return buildFinancialAdvice({ summary, requestedAmount: simulationValue });
  }, [summary, simulationValue]);

  const cards = useMemo(() => {
    const s = summary;
    const p = s?.payroll.data;
    const a = advice;

    return [
      {
        label: "Recomendado",
        icon: TrendingUp,
        value: p ? formatCurrency(p.suggestedAmount) : "—",
        hint: p ? `${p.suggestedRate}% do lucro` : undefined,
        highlight: true,
      },
      {
        label: "Máximo seguro",
        icon: ShieldCheck,
        value: a?.withdrawal.available ? formatCurrency(a.withdrawal.safeAmount) : "—",
        hint: a?.risk ? `Risco: ${a.risk.label}` : undefined,
      },
      {
        label: "Lucro líquido",
        icon: Calculator,
        value: s?.profit.data ? formatCurrency(s.profit.data.netProfit) : "—",
        hint: s?.profit.data ? `${s.profit.data.netMargin.toFixed(2)}% margem` : undefined,
      },
      {
        label: "Reserva financeira",
        icon: PiggyBank,
        value: a?.reserve.available ? formatCurrency(a.reserve.recommended) : "—",
        hint: "Reserva de segurança",
      },
      {
        label: "Caixa disponível",
        icon: Wallet,
        value: s?.cash.data ? formatCurrency(s.cash.data.currentBalance) : "—",
        hint: "Saldo atual das contas",
      },
      {
        label: "Lucro distribuível",
        icon: TrendingDown,
        value: p ? formatCurrency(p.distributableProfit) : "—",
        hint: "Pós-retirada e reserva",
      },
    ];
  }, [summary, advice]);

  return (
    <div className="space-y-6">
      <SummaryGrid columns={3}>
        {cards.map((c) => (
          <FinancialCard
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            hint={c.hint}
            loading={loading}
            highlight={c.highlight}
          />
        ))}
      </SummaryGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Simulação */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-primary" />
              Simulação de Retirada
            </CardTitle>
            <CardDescription>
              Veja o impacto imediato no caixa e no nível de risco.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between text-sm font-medium">
                <span>Valor para retirar</span>
                <span className="text-primary">{formatCurrency(simulationValue)}</span>
              </div>
              <Slider
                value={[simulationValue]}
                max={(advice?.withdrawal.safeAmount || 0) * 2 || 20000}
                step={100}
                onValueChange={([val]) => setSimulationValue(val)}
                className="py-4"
              />
              <div className="grid grid-cols-2 gap-2">
                {[1000, 2000, 5000, 10000].map((v) => (
                  <Button
                    key={v}
                    variant="outline"
                    size="sm"
                    onClick={() => setSimulationValue(v)}
                    className="h-8"
                  >
                    {formatCurrency(v)}
                  </Button>
                ))}
              </div>
            </div>

            {simulationAdvice && (
              <div className={`rounded-xl border p-4 ${
                simulationAdvice.withdrawal.approved 
                  ? "bg-primary/5 border-primary/20" 
                  : "bg-destructive/5 border-destructive/20"
              }`}>
                <div className="flex items-start gap-3">
                  {simulationAdvice.withdrawal.approved ? (
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                  ) : (
                    <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold leading-none">
                      {simulationAdvice.withdrawal.approved ? "Retirada Segura" : "Risco Elevado"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      O caixa restante seria de {formatCurrency(simulationAdvice.availableCash - simulationValue)}. 
                      Nível de risco: {simulationAdvice.risk.label}.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Explicação da Bella */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-primary" />
              Explicação da Bella
            </CardTitle>
            <CardDescription>
              Por que esses valores foram recomendados?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                A Bella utiliza o <strong>Motor Contábil V2</strong> para analisar seu lucro líquido e o 
                <strong> Motor Financeiro</strong> para verificar compromissos futuros.
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>Política de 30% do lucro para pró-labore.</li>
                <li>Reserva mínima de 20% do lucro ou saídas de 30 dias.</li>
                <li>Consideração de impostos a pagar ({formatCurrency(advice?.commitments.taxes || 0)}).</li>
                <li>Saúde financeira atual: {advice?.risk.score}/100.</li>
              </ul>
              <p className="mt-4 rounded-lg bg-muted p-3 text-xs italic">
                "Minha recomendação é conservadora para garantir que sua empresa tenha fôlego para os 
                próximos ciclos, protegendo sua reserva de emergência."
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Histórico e Calendário */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Histórico e Próximos Passos
          </CardTitle>
          <CardDescription>
            Ciclo de retiradas e previsões baseadas no calendário financeiro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
            <div className="rounded-full bg-muted p-4">
              <Info className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="max-w-xs space-y-1">
              <p className="font-medium">Módulo Enterprise em Expansão</p>
              <p className="text-sm text-muted-foreground">
                O registro formal de retiradas e o histórico integrado ao ERP NexOS estão sendo mapeados.
                Por enquanto, utilize estas recomendações para realizar seus lançamentos manuais no Financeiro.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
