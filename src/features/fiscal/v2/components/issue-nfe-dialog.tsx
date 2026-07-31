import { formatAccessKey } from "../lib/access-key";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  DanfeDownloadButton,
  XmlDownloadButton,
  XmlViewButton,
} from "./artifact-download-button";
import { ProductionConfirmDialog } from "./fiscal-environment";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import { cn } from "@/lib/utils";
import { getFiscalStatusBadge } from "../lib/fiscal-status";
import { formatCurrency } from "@/lib/format";
import { maskDocument } from "@/lib/masks";
import { ListSkeleton } from "@/components/layout/list-skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useFiscalProviderConfig,
  useFiscalSettings,
  useIssueFiscal,
  useSimulateFiscal,
} from "../hooks/use-fiscal";
import {
  listSalesForFiscal,
  type FiscalDocumentDto,
  type FiscalSaleOption,
  type FiscalSimulationResult,
  type NfeEnvironment,
  type SimulationIssue,
} from "../functions/fiscal.functions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultSaleId?: string;
  onIssued?: (doc: FiscalDocumentDto) => void;
}

type Step = "pick" | "review" | "result";

/**
 * Sprint 009 — Assistente de emissão de NF-e em 3 etapas:
 *   1. Selecionar venda
 *   2. Pré-validação (simulação server-side) com bloqueios/avisos
 *   3. Resultado da emissão real
 */
export function IssueNfeDialog({ open, onOpenChange, defaultSaleId, onIssued }: Props) {
  const [step, setStep] = useState<Step>("pick");
  const [saleId, setSaleId] = useState(defaultSaleId ?? "");
  // `null` = usuário não escolheu manualmente → o servidor resolve o ambiente.
  const [environmentOverride, setEnvironmentOverride] = useState<NfeEnvironment | null>(null);
  const [search, setSearch] = useState("");
  const [simulation, setSimulation] = useState<FiscalSimulationResult | null>(null);
  const [issued, setIssued] = useState<FiscalDocumentDto | null>(null);
  const [includeAll, setIncludeAll] = useState(false);
  const debounced = useDebouncedValue(search, 300);

  useEffect(() => {
    if (!open) {
      setStep("pick");
      setSaleId(defaultSaleId ?? "");
      setSearch("");
      setSimulation(null);
      setIssued(null);
      setIncludeAll(false);
      setEnvironmentOverride(null);
    }
  }, [open, defaultSaleId]);

  // Mesma origem de dados usada pelo banner/selo fiscal e pelo servidor:
  // fiscal_settings.default_environment → fiscal_provider_config.environment → homologação.
  const settingsQuery = useFiscalSettings();
  const providerQuery = useFiscalProviderConfig();
  const resolvedEnvironment: NfeEnvironment =
    settingsQuery.data?.defaultEnvironment ?? providerQuery.data?.environment ?? "homologation";
  const environment: NfeEnvironment = environmentOverride ?? resolvedEnvironment;
  const environmentLoading = settingsQuery.isLoading || providerQuery.isLoading;

  const listFn = useServerFn(listSalesForFiscal);
  const salesQuery = useQuery({
    queryKey: ["fiscal", "sales-picker", debounced, includeAll],
    queryFn: () => listFn({ data: { search: debounced || undefined, limit: 20, includeAll } }),
    enabled: open && step === "pick",
    staleTime: 15_000,
  });
  const sales = salesQuery.data ?? [];

  const selected = useMemo(() => sales.find((s) => s.id === saleId) ?? null, [sales, saleId]);

  const simulate = useSimulateFiscal();
  const issue = useIssueFiscal({
    onSuccess: (doc) => {
      setIssued(doc);
      onIssued?.(doc);
    },
  });

  const runSimulation = async () => {
    if (!saleId) return;
    const result = await simulate.mutateAsync({
      saleId,
      ...(environmentOverride ? { environment: environmentOverride } : {}),
    });
    setSimulation(result);
    setStep("review");
  };

  const runIssue = () => {
    if (!saleId) return;
    setStep("result");
    issue.mutate({ saleId, ...(environmentOverride ? { environment: environmentOverride } : {}) });
  };

  const resetToPick = () => {
    setStep("pick");
    setSaleId("");
    setSimulation(null);
    setIssued(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Assistente de emissão · NF-e
            <EnvironmentBadge environment={environment} />
          </DialogTitle>
          <DialogDescription>
            {step === "pick" && "Selecione a venda de origem."}
            {step === "review" && "Validamos empresa, cliente, provedor e regras antes de emitir."}
            {step === "result" && "Acompanhe o resultado da emissão."}
          </DialogDescription>
        </DialogHeader>

        <Steps current={step} />

        {step === "pick" && (
          <PickSaleStep
            sales={sales}
            isLoading={salesQuery.isLoading}
            isRefetching={salesQuery.isFetching}
            onRefresh={() => salesQuery.refetch()}
            search={search}
            onSearchChange={setSearch}
            saleId={saleId}
            onSelectSale={setSaleId}
            environment={environment}
            onEnvironmentChange={setEnvironmentOverride}
            environmentLoading={environmentLoading}
            selected={selected}
            onClose={() => onOpenChange(false)}
            includeAll={includeAll}
            onIncludeAllChange={setIncludeAll}
          />
        )}

        {step === "review" && (
          <ReviewStep
            simulation={simulation}
            isRunning={simulate.isPending}
            environment={environment}
          />
        )}

        {step === "result" && (
          <ResultStep
            doc={issued}
            isSubmitting={issue.isPending}
            error={issue.error as Error | null}
            environment={environment}
            saleId={saleId}
            customerEmail={simulation?.summary.customerEmail ?? null}
            onNewIssue={resetToPick}
            onClose={() => onOpenChange(false)}
          />
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            disabled={issue.isPending}
            onClick={() => {
              if (step === "review") setStep("pick");
              else onOpenChange(false);
            }}
          >
            {step === "review" ? (
              <>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
              </>
            ) : (
              "Fechar"
            )}
          </Button>

          {step === "pick" && (
            <Button
              disabled={!saleId || Boolean(selected?.hasActiveNfe) || simulate.isPending}
              onClick={runSimulation}
            >
              {simulate.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-1.5 h-4 w-4" />
              )}
              Validar emissão
            </Button>
          )}

          {step === "review" && simulation && (
            <Button disabled={!simulation.ok || issue.isPending} onClick={runIssue}>
              {issue.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1.5 h-4 w-4" />
              )}
              {issue.isPending ? "Transmitindo…" : "Emitir agora"}
            </Button>
          )}

          {step === "result" && (
            <Button disabled={issue.isPending} onClick={() => onOpenChange(false)}>
              Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------- Stepper

function Steps({ current }: { current: Step }) {
  const items: Array<{ id: Step; label: string }> = [
    { id: "pick", label: "1. Venda" },
    { id: "review", label: "2. Pré-validação" },
    { id: "result", label: "3. Resultado" },
  ];
  const currentIndex = items.findIndex((i) => i.id === current);
  return (
    <div className="flex items-center gap-2 text-xs">
      {items.map((it, i) => (
        <div key={it.id} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border font-medium",
              i < currentIndex && "border-primary bg-primary text-primary-foreground",
              i === currentIndex && "border-primary text-primary",
              i > currentIndex && "border-muted text-muted-foreground",
            )}
          >
            {i < currentIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span
            className={cn(
              i === currentIndex ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {it.label.replace(/^\d+\.\s/, "")}
          </span>
          {i < items.length - 1 && (
            <div className={cn("h-px flex-1", i < currentIndex ? "bg-primary" : "bg-border")} />
          )}
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------------- Step 1

function PickSaleStep({
  sales,
  isLoading,
  isRefetching,
  onRefresh,
  search,
  onSearchChange,
  saleId,
  onSelectSale,
  environment,
  onEnvironmentChange,
  environmentLoading,
  selected,
  onClose,
  includeAll,
  onIncludeAllChange,
}: {
  sales: FiscalSaleOption[];
  isLoading: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  saleId: string;
  onSelectSale: (id: string) => void;
  environment: NfeEnvironment;
  onEnvironmentChange: (v: NfeEnvironment) => void;
  environmentLoading?: boolean;
  selected: FiscalSaleOption | null;
  onClose: () => void;
  includeAll: boolean;
  onIncludeAllChange: (v: boolean) => void;
}) {
  const hasSearch = search.trim().length > 0;
  const [confirmProd, setConfirmProd] = useState(false);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5" /> Buscar venda
        </Label>
        <Input
          placeholder="Buscar por cliente, CPF/CNPJ, nº do pedido ou nome do produto..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2">
        <div>
          <p className="text-xs font-medium">Todas as vendas (depuração)</p>
          <p className="text-[11px] text-muted-foreground">
            Ignora filtros fiscais e mostra o motivo de cada venda não elegível.
          </p>
        </div>
        <Switch checked={includeAll} onCheckedChange={onIncludeAllChange} />
      </div>

      <div>
        <Label>
          {hasSearch
            ? "Resultados da busca"
            : includeAll
              ? "20 vendas mais recentes (sem filtros)"
              : "20 vendas mais recentes"}
        </Label>

        <div className="mt-1.5 rounded-md border">
          {isLoading ? (
            <ListSkeleton rows={4} showHeader={false} className="p-3" />
          ) : sales.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 p-6 text-center">
              <FileText className="h-7 w-7 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {hasSearch
                    ? "Nenhuma venda encontrada para esta busca."
                    : "Você ainda não possui vendas disponíveis para emissão."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hasSearch
                    ? "Ajuste os termos da busca ou recarregue a lista."
                    : "Para emitir uma NF-e é necessário faturar uma venda primeiro."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" asChild onClick={onClose}>
                  <Link to="/vendas/novo" search={{ productId: undefined }}>
                    <Plus className="mr-1.5 h-4 w-4" /> Nova venda
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={onRefresh} disabled={isRefetching}>
                  {isRefetching ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                  )}
                  Recarregar lista
                </Button>
              </div>
            </div>
          ) : (
            <ul className="divide-y">
              {sales.map((s) => (
                <SaleRow
                  key={s.id}
                  sale={s}
                  term={search}
                  selected={saleId === s.id}
                  onSelect={() => s.canIssue && onSelectSale(s.id)}
                  showReasons={includeAll}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {selected?.hasActiveNfe && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Já existe uma NF-e ativa para esta venda. Cancele-a antes de emitir uma nova.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label>Ambiente</Label>
        <Select
          disabled={environmentLoading}
          value={environment}
          onValueChange={(v) => {
            if (v === "production" && environment !== "production") {
              setConfirmProd(true);
              return;
            }
            onEnvironmentChange(v as NfeEnvironment);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="homologation">Homologação (testes)</SelectItem>
            <SelectItem value="production">Produção</SelectItem>
          </SelectContent>
        </Select>
        {environment === "homologation" ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Esta NF-e será emitida apenas para testes.
          </p>
        ) : null}
      </div>

      <ProductionConfirmDialog
        open={confirmProd}
        onOpenChange={setConfirmProd}
        onConfirm={() => onEnvironmentChange("production")}
      />
    </div>
  );
}

/** Realça (negrito) o trecho encontrado na busca, ignorando acentos e caixa. */
function Highlight({ text, term }: { text: string; term: string }) {
  const needle = term.trim();
  if (!needle) return <>{text}</>;
  const norm = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const hayN = norm(text);
  const needN = norm(needle);
  if (needN.length === 0 || hayN.length !== text.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let from = 0;
  let idx = hayN.indexOf(needN);
  if (idx === -1) return <>{text}</>;
  let key = 0;
  while (idx !== -1) {
    if (idx > from) parts.push(text.slice(from, idx));
    parts.push(
      <mark key={key++} className="bg-primary/15 font-semibold text-foreground">
        {text.slice(idx, idx + needN.length)}
      </mark>,
    );
    from = idx + needN.length;
    idx = hayN.indexOf(needN, from);
  }
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}


function SaleRow({
  sale,
  term,
  selected,
  onSelect,
  showReasons = false,
}: {
  sale: FiscalSaleOption;
  term: string;
  selected: boolean;
  onSelect: () => void;
  showReasons?: boolean;
}) {
  const date = sale.paidAt ?? sale.saleDate;
  const doc = sale.customerDocument ? maskDocument(sale.customerDocument) : null;

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onSelect}
        disabled={!sale.canIssue}
        className={cn(
          "flex min-h-[116px] w-full flex-col justify-between gap-1 p-4 text-left transition-all",
          selected
            ? "bg-primary/[0.06] shadow-sm ring-1 ring-primary"
            : "hover:-translate-y-0.5 hover:shadow-md hover:ring-1 hover:ring-primary/50",
          !sale.canIssue && "cursor-not-allowed opacity-60",
        )}
      >
        {/* Linha 1 — número .......... valor */}
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            {sale.number ? (
              <span className="truncate">
                <Highlight text={`#${sale.number}`} term={term} />
              </span>
            ) : (
              <span className="text-muted-foreground">Sem nº</span>
            )}
            {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
          </span>
          <span className="shrink-0 text-sm font-semibold">{formatCurrency(sale.totalAmount)}</span>
        </div>

        {/* Linha 2 — cliente */}
        <p className="truncate text-base font-semibold leading-tight">
          <Highlight text={sale.customerName ?? "Consumidor não identificado"} term={term} />
        </p>

        {/* Linha 3 — documento */}
        <p className="truncate text-[13px] text-muted-foreground">
          {doc ? <Highlight text={doc} term={term} /> : "CPF/CNPJ não informado"}
        </p>

        {/* Linha 4 — produto + SKU */}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {sale.productName ? (
              <Highlight text={sale.productName} term={term} />
            ) : (
              <span className="text-muted-foreground">Produto não informado</span>
            )}
          </p>
          {sale.productSku && (
            <p className="truncate text-xs text-muted-foreground">
              SKU: <Highlight text={sale.productSku} term={term} />
            </p>
          )}
        </div>

        {/* Linha 5 — data + status */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {date ? format(new Date(date), "dd/MM/yyyy", { locale: ptBR }) : "Data não informada"}
          </span>
          <Badge
            variant="outline"
            className={cn("text-[10px]", getFiscalStatusBadge(sale.fiscalStatus).className)}
            title={sale.fiscalIssues.join(" ") || undefined}
          >
            {getFiscalStatusBadge(sale.fiscalStatus).label}
          </Badge>
        </div>

        {showReasons && !sale.canIssue && sale.fiscalIssues.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-amber-600 dark:text-amber-400">
            {sale.fiscalIssues.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </button>
    </li>
  );
}

// ------------------------------------------------------- Ambiente (badge)

function EnvironmentBadge({ environment }: { environment: NfeEnvironment }) {
  const prod = environment === "production";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-semibold uppercase tracking-wide",
        prod
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      )}
    >
      {prod ? "🔴 Produção" : "🟠 Homologação"}
    </Badge>
  );
}

// -------------------------------------------------------------- Step 2

const PROVIDER_LABEL: Record<string, string> = {
  focus: "Focus NFe",
  focusnfe: "Focus NFe",
  plugnotas: "PlugNotas",
  tecnospeed: "TecnoSpeed",
  mock: "Mock (simulado)",
};

function CheckLine({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
      ) : (
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
      )}
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 flex-1 font-medium", !ok && "text-destructive")}>{value}</span>
    </div>
  );
}

function SummaryBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ReviewStep({
  simulation,
  isRunning,
  environment,
}: {
  simulation: FiscalSimulationResult | null;
  isRunning: boolean;
  environment: NfeEnvironment;
}) {
  if (isRunning || !simulation) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Executando pré-validação fiscal…
      </div>
    );
  }
  const { blockers, warnings, summary, ok, provider } = simulation;
  const certValue = summary.hasCertificate
    ? [
        summary.certificateAlias ?? "Certificado A1 ativo",
        summary.certificateValidTo
          ? `válido até ${format(new Date(summary.certificateValidTo), "dd/MM/yyyy", { locale: ptBR })}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Nenhum certificado A1 ativo";

  return (
    <div className="space-y-4">
      {ok ? (
        <Alert className="border-emerald-500/40 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Tudo pronto para emitir</AlertTitle>
          <AlertDescription>
            Nenhum bloqueio encontrado. Você pode emitir a NF-e a seguir.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{blockers.length} bloqueio(s) impedem a emissão</AlertTitle>
          <AlertDescription>Resolva os itens listados abaixo e tente novamente.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryBlock title="Empresa">
          <CheckLine
            ok={Boolean(summary.companyCnpj)}
            label="Emitente"
            value={
              summary.companyName
                ? `${summary.companyName}${summary.companyCnpj ? ` · ${maskDocument(summary.companyCnpj)}` : ""}`
                : "Dados da empresa incompletos"
            }
          />
          <CheckLine ok={summary.hasCertificate} label="Certificado A1" value={certValue} />
          <CheckLine
            ok={provider !== "mock" && summary.hasProviderKey}
            label="Provider"
            value={PROVIDER_LABEL[provider] ?? provider ?? "Não configurado"}
          />
          <CheckLine
            ok
            label="Ambiente"
            value={environment === "production" ? "Produção" : "Homologação"}
          />
        </SummaryBlock>

        <SummaryBlock title="Cliente">
          <CheckLine
            ok={Boolean(summary.customerName)}
            label="Nome"
            value={summary.customerName ?? "Não informado"}
          />
          <CheckLine
            ok={Boolean(summary.customerDocument)}
            label="CPF/CNPJ"
            value={
              summary.customerDocument ? maskDocument(summary.customerDocument) : "Não informado"
            }
          />
          <CheckLine
            ok={Boolean(summary.customerAddress)}
            label="Endereço"
            value={summary.customerAddress ?? "Endereço incompleto"}
          />
        </SummaryBlock>

        <SummaryBlock title="Fiscal">
          <CheckLine ok={Boolean(summary.cfop)} label="CFOP" value={summary.cfop ?? "—"} />
          <CheckLine ok={Boolean(summary.ncm)} label="NCM" value={summary.ncm ?? "—"} />
          <CheckLine
            ok={Boolean(summary.csosn)}
            label="CSOSN/CST"
            value={
              summary.csosn ? `${summary.csosn}${summary.crt ? ` (CRT ${summary.crt})` : ""}` : "—"
            }
          />
          <CheckLine
            ok={Boolean(summary.series)}
            label="Série"
            value={
              summary.series
                ? `${summary.series}${summary.numberPreview ? ` · nº ${summary.numberPreview}` : ""}`
                : "—"
            }
          />
          <CheckLine
            ok={Boolean(summary.natureza)}
            label="Natureza"
            value={summary.natureza ?? "—"}
          />
        </SummaryBlock>

        <SummaryBlock title={`Itens (${summary.itemCount})`}>
          {summary.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum item na venda.</p>
          ) : (
            <>
              {summary.items.map((it, i) => (
                <div key={i} className="text-xs">
                  <p className="truncate font-medium">{it.description}</p>
                  <p className="text-muted-foreground">
                    {it.quantity} × {formatCurrency(it.unitPrice)} ={" "}
                    <span className="font-medium text-foreground">{formatCurrency(it.total)}</span>
                    {it.ncm ? ` · NCM ${it.ncm}` : " · sem NCM"}
                  </p>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Total da NF-e</span>
                <span>{formatCurrency(summary.totalAmount)}</span>
              </div>
            </>
          )}
        </SummaryBlock>
      </div>

      <ScrollArea className="max-h-56 rounded-md border">
        <div className="divide-y">
          {blockers.map((i) => (
            <IssueRow key={i.id} issue={i} />
          ))}
          {warnings.map((i) => (
            <IssueRow key={i.id} issue={i} />
          ))}
          {blockers.length === 0 && warnings.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground">Nenhum alerta. Tudo verificado.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-medium">{value}</p>
    </div>
  );
}

function IssueRow({ issue }: { issue: SimulationIssue }) {
  const isErr = issue.severity === "error";
  const Icon = isErr ? ShieldAlert : AlertTriangle;
  return (
    <div
      className={cn(
        "flex items-start gap-2 px-3 py-2 text-xs",
        isErr ? "text-destructive" : "text-amber-700 dark:text-amber-400",
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{issue.title}</p>
        <p className="text-muted-foreground">{issue.detail}</p>
        {issue.hint && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">💡 {issue.hint}</p>
        )}
      </div>
      {issue.step && (
        <Badge variant="outline" className="text-[10px] uppercase">
          {issue.step}
        </Badge>
      )}
    </div>
  );
}

// -------------------------------------------------------------- Step 3

const ISSUE_STAGES = [
  "Assinando XML…",
  "Montando NF-e…",
  "Enviando para Focus…",
  "Transmitindo para SEFAZ…",
  "Aguardando autorização…",
] as const;

/** Progresso por etapas — nunca apenas um spinner. */
function IssueProgress() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setStage((s) => Math.min(s + 1, ISSUE_STAGES.length - 1));
    }, 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="space-y-2 rounded-md border p-4">
      {ISSUE_STAGES.map((label, i) => {
        const done = i < stage;
        const active = i === stage;
        return (
          <div
            key={label}
            className={cn(
              "flex items-center gap-2 text-sm transition-opacity",
              done && "text-muted-foreground",
              active && "font-medium text-foreground",
              !done && !active && "opacity-40",
            )}
          >
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : active ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <span className="h-4 w-4 rounded-full border" />
            )}
            {label}
          </div>
        );
      })}
      <p className="pt-1 text-xs text-muted-foreground">
        Não feche esta janela enquanto a transmissão estiver em andamento.
      </p>
    </div>
  );
}

const REJECTION_HINTS: Array<{ match: RegExp; hint: string }> = [
  { match: /ncm/i, hint: "Revise o NCM cadastrado nos produtos da venda." },
  { match: /cnpj|cpf|destinat/i, hint: "Confira CPF/CNPJ e endereço do destinatário." },
  { match: /certificad|assinatura|senha/i, hint: "Verifique o certificado A1 e sua senha." },
  { match: /ie|inscri/i, hint: "Confira a Inscrição Estadual do emitente/destinatário." },
  { match: /duplicid|numera|s[ée]rie/i, hint: "Ajuste a série/próximo número em Regras fiscais." },
  { match: /cfop/i, hint: "Revise o CFOP padrão em Fiscal → Configuração → Regras." },
];

function suggestFix(code: string | null, reason: string | null): string {
  const text = `${code ?? ""} ${reason ?? ""}`;
  const found = REJECTION_HINTS.find((h) => h.match.test(text));
  return (
    found?.hint ??
    "Verifique os dados da venda, do cliente e das regras fiscais e tente emitir novamente."
  );
}

function ResultStep({
  doc,
  isSubmitting,
  error,
  environment,
  saleId,
  customerEmail,
  onNewIssue,
  onClose,
}: {
  doc: FiscalDocumentDto | null;
  isSubmitting: boolean;
  error: Error | null;
  environment: NfeEnvironment;
  saleId: string;
  customerEmail: string | null;
  onNewIssue: () => void;
  onClose: () => void;
}) {
  if (isSubmitting) return <IssueProgress />;

  if (error && !doc) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Falha na emissão</AlertTitle>
        <AlertDescription className="space-y-1">
          <p className="whitespace-pre-wrap">{error.message}</p>
          <p className="text-xs">💡 {suggestFix(null, error.message)}</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (!doc) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">Nenhum resultado disponível.</p>
    );
  }

  const ok = doc.status === "authorized";
  const failed = doc.status === "rejected" || doc.status === "error";

  const copyKey = async () => {
    if (!doc.accessKey) return;
    await navigator.clipboard.writeText(formatAccessKey(doc.accessKey, ""));
    toast.success("Chave de acesso copiada.");
  };

  const mailto = () => {
    const subject = encodeURIComponent(`NF-e ${doc.number ?? ""} série ${doc.series ?? ""}`);
    const body = encodeURIComponent(
      [
        "Segue os dados da NF-e emitida:",
        `Número: ${doc.number ?? "—"}`,
        `Série: ${doc.series ?? "—"}`,
        `Chave de acesso: ${formatAccessKey(doc.accessKey)}`,
        `Protocolo: ${doc.protocol ?? "—"}`,
      ].join("\n"),
    );
    window.location.href = `mailto:${customerEmail ?? ""}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-3">
      {ok && (
        <>
          <Alert className="border-emerald-500/40 bg-emerald-500/5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="flex items-center gap-2">
              ✔ NF-e autorizada <EnvironmentBadge environment={environment} />
            </AlertTitle>
            <AlertDescription>
              A nota foi autorizada pela SEFAZ e os arquivos já estão disponíveis.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-3 rounded-md border p-3 text-xs sm:grid-cols-3">
            <Field label="Número" value={doc.number ? String(doc.number) : "—"} />
            <Field label="Série" value={doc.series ? String(doc.series) : "—"} />
            <Field label="Protocolo" value={doc.protocol ?? "—"} />
            <Field
              label="Data/hora"
              value={
                doc.protocolAt
                  ? format(new Date(doc.protocolAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : format(new Date(doc.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
              }
            />
            <div className="col-span-2 sm:col-span-3">
              <p className="text-[10px] uppercase text-muted-foreground">Chave de acesso</p>
              <p className="mt-0.5 break-all font-mono text-[11px] font-medium">
                {formatAccessKey(doc.accessKey)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <DanfeDownloadButton path={doc.danfePath} doc={doc} />
            <XmlViewButton path={doc.xmlAuthorizedPath ?? doc.xmlSignedPath} doc={doc} />
            <XmlDownloadButton
              path={doc.xmlAuthorizedPath ?? doc.xmlSignedPath}
              doc={doc}
            />
            <Button size="sm" variant="outline" onClick={copyKey} disabled={!doc.accessKey}>
              <Copy className="mr-1.5 h-4 w-4" /> Copiar chave
            </Button>
            <Button size="sm" variant="outline" onClick={mailto}>
              <Mail className="mr-1.5 h-4 w-4" /> Enviar por e-mail
            </Button>
            <Button size="sm" variant="outline" onClick={onNewIssue}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova emissão
            </Button>
            {saleId && (
              <Button size="sm" variant="outline" asChild onClick={onClose}>
                <Link to="/vendas/$saleId" params={{ saleId }}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar para venda
                </Link>
              </Button>
            )}
          </div>
        </>
      )}

      {failed && (
        <>
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Falha na emissão</AlertTitle>
            <AlertDescription>
              A NF-e não foi autorizada. Veja o retorno do provedor/SEFAZ abaixo.
            </AlertDescription>
          </Alert>
          <div className="space-y-2 rounded-md border p-3 text-xs">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Código</p>
              <p className="mt-0.5 font-mono font-medium">{doc.rejectionCode ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Descrição</p>
              <p className="mt-0.5 whitespace-pre-wrap font-medium">
                {doc.rejectionReason ?? "Motivo não informado pelo provedor."}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Sugestão de correção</p>
              <p className="mt-0.5">💡 {suggestFix(doc.rejectionCode, doc.rejectionReason)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onNewIssue}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Tentar novamente
            </Button>
            {saleId && (
              <Button size="sm" variant="outline" asChild onClick={onClose}>
                <Link to="/vendas/$saleId" params={{ saleId }}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar para venda
                </Link>
              </Button>
            )}
          </div>
        </>
      )}

      {!ok && !failed && (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertTitle>Em processamento</AlertTitle>
          <AlertDescription>
            Status atual: <strong>{doc.status}</strong>. A tela será atualizada automaticamente
            quando o provedor concluir.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
