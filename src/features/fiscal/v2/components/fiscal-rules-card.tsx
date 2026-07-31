import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Scale, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  setCscToken,
  updateFiscalSettings,
  type NfeEnvironment,
  type TaxRegime,
} from "../functions/fiscal.functions";
import { useFiscalSettings, useInvalidateFiscalConfig } from "../hooks/use-fiscal";
import { crtCoherenceMessage, defaultCrtForRegime, isCrtCoherent } from "../lib/crt";

import { ProductionConfirmDialog } from "./fiscal-environment";

const REGIMES: Array<{ id: TaxRegime; label: string }> = [
  { id: "simples", label: "Simples Nacional" },
  { id: "presumido", label: "Lucro Presumido" },
  { id: "real", label: "Lucro Real" },
  { id: "mei", label: "MEI" },
];

const UFS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];

export function FiscalRulesCard() {
  const invalidateFiscalConfig = useInvalidateFiscalConfig();
  const updateFn = useServerFn(updateFiscalSettings);
  const setCsc = useServerFn(setCscToken);

  const { data, isLoading } = useFiscalSettings();

  const [taxRegime, setTaxRegime] = useState<TaxRegime>("simples");
  const [crt, setCrt] = useState<number>(1);
  const [cnaePrincipal, setCnaePrincipal] = useState("");
  const [emitUf, setEmitUf] = useState("SP");
  const [nfeSeries, setNfeSeries] = useState(1);
  const [nfeNextNumber, setNfeNextNumber] = useState(1);
  const [defaultEnvironment, setDefaultEnvironment] = useState<NfeEnvironment>("homologation");
  const [confirmProd, setConfirmProd] = useState(false);
  const [operationNature, setOperationNature] = useState("");
  const [defaultCfop, setDefaultCfop] = useState("5102");
  const [defaultCsosn, setDefaultCsosn] = useState("102");
  const [defaultOrigem, setDefaultOrigem] = useState(0);
  const [issueOnlyAfterPayment, setIssueOnlyAfterPayment] = useState(false);
  const [homologationMode, setHomologationMode] = useState(true);
  const [stockOnHomologation, setStockOnHomologation] = useState(true);
  const [cscId, setCscId] = useState("");
  const [cscToken, setCscTokenValue] = useState("");

  useEffect(() => {
    if (!data) return;
    setTaxRegime(data.taxRegime);
    setCrt(data.crt ?? 1);
    setCnaePrincipal(data.cnaePrincipal ?? "");
    setEmitUf(data.emitUf);
    setNfeSeries(data.nfeSeries);
    setNfeNextNumber(data.nfeNextNumber);
    setDefaultEnvironment(data.defaultEnvironment);
    setOperationNature(data.operationNature);
    setDefaultCfop(data.defaultCfop);
    setDefaultCsosn(data.defaultCsosn ?? "102");
    setDefaultOrigem(data.defaultOrigem);
    setIssueOnlyAfterPayment(data.issueOnlyAfterPayment);
    setHomologationMode(data.homologationMode);
    setStockOnHomologation(data.stockOnHomologation);
    setCscId(data.cscId ?? "");
  }, [data]);

  const crtCoherent = isCrtCoherent(taxRegime, crt);

  const save = useMutation({

    mutationFn: () =>
      updateFn({
        data: {
          taxRegime,
          crt,
          cnaePrincipal: cnaePrincipal.trim() || null,
          emitUf,
          nfeSeries,
          nfeNextNumber,
          defaultEnvironment,
          operationNature,
          defaultCfop,
          defaultCsosn: defaultCsosn.trim() || null,
          defaultOrigem,
          issueOnlyAfterPayment,
          homologationMode,
          stockOnHomologation,
          cscId: cscId.trim() || null,
        },
      }),
    onSuccess: () => {
      invalidateFiscalConfig();
      toast.success("Regras fiscais salvas.");
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar regras."),
  });

  const saveCsc = useMutation({
    mutationFn: (value: string | null) => setCsc({ data: { token: value } }),
    onSuccess: () => {
      invalidateFiscalConfig();
      toast.success("CSC atualizado.");
      setCscTokenValue("");
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar CSC."),
  });

  const hasCsc = Boolean(data?.hasCscToken);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" /> Regras fiscais padrão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Regime tributário</Label>
                <Select
                  value={taxRegime}
                  onValueChange={(v) => {
                    const regime = v as TaxRegime;
                    setTaxRegime(regime);
                    // Mantém o CRT coerente com o regime (MEI → 4, Simples → 1, Presumido/Real → 3).
                    if (!isCrtCoherent(regime, crt)) setCrt(defaultCrtForRegime(regime));
                  }}
                >

                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIMES.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>UF de emissão</Label>
                <Select value={emitUf} onValueChange={setEmitUf}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Série da NF-e</Label>
                <Input
                  type="number"
                  min={1}
                  value={nfeSeries}
                  onChange={(e) => setNfeSeries(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-1">
                <Label>Próximo número</Label>
                <Input
                  type="number"
                  min={1}
                  value={nfeNextNumber}
                  onChange={(e) => setNfeNextNumber(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-1">
                <Label>Ambiente padrão</Label>
                <Select
                  value={defaultEnvironment}
                  onValueChange={(v) => {
                    if (v === "production" && defaultEnvironment !== "production") {
                      setConfirmProd(true);
                      return;
                    }
                    setDefaultEnvironment(v as NfeEnvironment);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologation">Homologação</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>CFOP padrão</Label>
                <Input
                  value={defaultCfop}
                  maxLength={4}
                  onChange={(e) => setDefaultCfop(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="space-y-1">
                <Label>CRT (Código Regime Tributário)</Label>
                <Select value={String(crt)} onValueChange={(v) => setCrt(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Simples Nacional</SelectItem>
                    <SelectItem value="2">2 - Simples Nacional (excesso de sublimite)</SelectItem>
                    <SelectItem value="3">3 - Regime Normal</SelectItem>
                    <SelectItem value="4">4 - MEI</SelectItem>
                  </SelectContent>
                </Select>
                {!crtCoherent ? (
                  <p className="text-xs text-destructive">{crtCoherenceMessage(taxRegime)}</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label>CNAE principal</Label>
                <Input
                  value={cnaePrincipal}
                  onChange={(e) => setCnaePrincipal(e.target.value)}
                  placeholder="0000-0/00"
                />
              </div>
              <div className="space-y-1">
                <Label>CSOSN padrão</Label>
                <Input
                  value={defaultCsosn}
                  maxLength={4}
                  onChange={(e) => setDefaultCsosn(e.target.value.replace(/\D/g, ""))}
                  placeholder="102"
                />
              </div>
              <div className="space-y-1">
                <Label>Origem da mercadoria</Label>
                <Select
                  value={String(defaultOrigem)}
                  onValueChange={(v) => setDefaultOrigem(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - Nacional</SelectItem>
                    <SelectItem value="1">1 - Estrangeira (importação direta)</SelectItem>
                    <SelectItem value="2">2 - Estrangeira (mercado interno)</SelectItem>
                    <SelectItem value="3">3 - Nacional c/ conteúdo importado &gt; 40%</SelectItem>
                    <SelectItem value="4">4 - Nacional (processos básicos)</SelectItem>
                    <SelectItem value="5">5 - Nacional c/ conteúdo importado ≤ 40%</SelectItem>
                    <SelectItem value="6">
                      6 - Estrangeira (importação direta, sem similar)
                    </SelectItem>
                    <SelectItem value="7">
                      7 - Estrangeira (mercado interno, sem similar)
                    </SelectItem>
                    <SelectItem value="8">8 - Nacional c/ conteúdo importado &gt; 70%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Natureza da operação</Label>
                <Textarea
                  rows={2}
                  value={operationNature}
                  onChange={(e) => setOperationNature(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="issue-only-after-payment">
                  Emitir NF-e apenas após o pagamento
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativo, o assistente lista somente vendas pagas. Desativado, todas as vendas
                  fiscalmente elegíveis aparecem.
                </p>
              </div>
              <Switch
                id="issue-only-after-payment"
                checked={issueOnlyAfterPayment}
                onCheckedChange={setIssueOnlyAfterPayment}
              />
            </div>

            <div className="space-y-3 rounded-md border border-warning/40 bg-warning/5 p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="homologation-mode">🟠 Modo de homologação</Label>
                  <p className="text-xs text-muted-foreground">
                    Vendas com NF-e de homologação viram vendas de teste: badge TESTE, filtros
                    automáticos e exclusão de caixa, dashboards e relatórios. Vendas de produção não
                    são afetadas.
                  </p>
                </div>
                <Switch
                  id="homologation-mode"
                  checked={homologationMode}
                  onCheckedChange={setHomologationMode}
                />
              </div>
              <div className="flex items-start justify-between gap-4 border-t pt-3">
                <div className="space-y-0.5">
                  <Label htmlFor="stock-on-homologation">Baixar estoque em homologação</Label>
                  <p className="text-xs text-muted-foreground">
                    Padrão: sim — permite testar o fluxo completo. Ao desativar, o estoque das
                    vendas de teste é devolvido automaticamente.
                  </p>
                </div>
                <Switch
                  id="stock-on-homologation"
                  checked={stockOnHomologation}
                  onCheckedChange={setStockOnHomologation}
                />
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" /> CSC (NFC-e, opcional)
                </Label>
                {hasCsc ? (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3 w-3" /> Token configurado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <ShieldAlert className="h-3 w-3" /> Não configurado
                  </Badge>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Input
                  placeholder="ID do CSC (ex.: 000001)"
                  value={cscId}
                  onChange={(e) => setCscId(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder={hasCsc ? "•••••• (em branco mantém)" : "Token do CSC"}
                  value={cscToken}
                  onChange={(e) => setCscTokenValue(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => saveCsc.mutate(cscToken.trim() || null)}
                  disabled={saveCsc.isPending || (!cscToken && !hasCsc)}
                >
                  Salvar token CSC
                </Button>
                {hasCsc && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => saveCsc.mutate(null)}
                    disabled={saveCsc.isPending}
                  >
                    Remover
                  </Button>
                )}
              </div>
            </div>

            <Button onClick={() => save.mutate()} disabled={save.isPending || !crtCoherent}>
              {save.isPending ? "Salvando…" : "Salvar regras"}
            </Button>
          </>
        )}
      </CardContent>
      <ProductionConfirmDialog
        open={confirmProd}
        onOpenChange={setConfirmProd}
        onConfirm={() => setDefaultEnvironment("production")}
      />
    </Card>
  );
}
