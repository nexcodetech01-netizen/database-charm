import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listRegimes, type TaxRegime } from "../strategies/tax-regime-strategy";
import { useFiscalHealthConfig, useUpdateFiscalHealthConfig } from "../hooks/use-fiscal-health";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function FiscalHealthConfigCard() {
  const { data, isLoading } = useFiscalHealthConfig();
  const update = useUpdateFiscalHealthConfig();

  const [regime, setRegime] = useState<TaxRegime>("simples");
  const [limit, setLimit] = useState<string>("");
  const [startMonth, setStartMonth] = useState<number>(1);
  const [thresholds, setThresholds] = useState<string>("70,80,90,95,100");

  useEffect(() => {
    if (!data) return;
    setRegime(data.regime);
    setLimit(data.annualRevenueLimit != null ? String(data.annualRevenueLimit) : "");
    setStartMonth(data.fiscalYearStartMonth);
    setThresholds(data.alertThresholds.join(","));
  }, [data]);

  async function onSave() {
    const parsedLimit = limit.trim() === "" ? null : Number(limit.replace(",", "."));
    if (parsedLimit != null && (!Number.isFinite(parsedLimit) || parsedLimit < 0)) {
      toast.error("Limite anual inválido.");
      return;
    }
    const parsedThresholds = thresholds
      .split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
    if (parsedThresholds.length === 0) {
      toast.error("Informe ao menos um percentual de alerta.");
      return;
    }
    try {
      await update.mutateAsync({
        companyId: data?.companyId ?? "",
        regime,
        annualRevenueLimit: parsedLimit,
        fiscalYearStartMonth: startMonth,
        alertThresholds: parsedThresholds,
      });
      toast.success("Configuração de saúde fiscal atualizada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar configuração.");
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Configuração</h3>
          <p className="text-sm text-muted-foreground">
            Regime tributário, limite anual e percentuais de alerta.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="regime">Regime tributário</Label>
          <Select value={regime} onValueChange={(v) => setRegime(v as TaxRegime)} disabled={isLoading}>
            <SelectTrigger id="regime"><SelectValue /></SelectTrigger>
            <SelectContent>
              {listRegimes().map((s) => (
                <SelectItem key={s.regime} value={s.regime}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fyStart">Início do exercício fiscal</Label>
          <Select value={String(startMonth)} onValueChange={(v) => setStartMonth(Number(v))} disabled={isLoading}>
            <SelectTrigger id="fyStart"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="limit">Limite anual (R$)</Label>
          <Input
            id="limit"
            inputMode="decimal"
            placeholder="Deixe vazio para usar padrão do regime"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="alerts">Percentuais de alerta (separados por vírgula)</Label>
          <Input
            id="alerts"
            placeholder="70,80,90,95,100"
            value={thresholds}
            onChange={(e) => setThresholds(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={update.isPending}>
          {update.isPending ? "Salvando…" : "Salvar configuração"}
        </Button>
      </div>
    </div>
  );
}
