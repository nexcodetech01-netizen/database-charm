import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  CheckCircle2,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Radio,
  KeyRound,
  PlugZap,
  Webhook,
  CreditCard,
  Landmark,
} from "lucide-react";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useBellaPayConfig,
  useSaveBellaPayConfig,
  useTestBellaPayConnection,
} from "../hooks/use-bella-pay";
import { useCardFixedFee } from "../lib/card-fixed-fee";
import {
  CREDIT_CARD_ALLOWED_INSTALLMENTS,
  CREDIT_CARD_MAX_INSTALLMENTS,
} from "../lib/credit-card-fee";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/features/finance/hooks/use-finance";
import type { BellaPayEnvironment } from "../types";

interface Props {
  companyId: string;
}

/**
 * PAY-CONFIG-UI — Wizard de configuração Bella Pay.
 * Refatoração puramente visual: consome os mesmos hooks/mutations,
 * não altera lógica, server functions, banco ou webhook.
 */
export function ConfigPanel({ companyId }: Props) {
  const { data: config, isLoading } = useBellaPayConfig(companyId);
  const save = useSaveBellaPayConfig(companyId);
  const test = useTestBellaPayConnection(companyId);

  const [env, setEnv] = useState<BellaPayEnvironment>("sandbox");
  const [sandbox, setSandbox] = useState("");
  const [production, setProduction] = useState("");
  const [showKey, setShowKey] = useState(false);

  // PDV-010 + PDV-014 — Configuração de Cartão de Crédito.
  const [absorbFee, setAbsorbFee] = useState(false);
  const [feePercent, setFeePercent] = useState<string>("0");
  const [maxInstallments, setMaxInstallments] = useState<number>(
    CREDIT_CARD_MAX_INSTALLMENTS,
  );
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null);
  const { data: accounts } = useAccounts(companyId);
  const activeAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.status === "active"),
    [accounts],
  );
  const [fixedFee, setFixedFee] = useCardFixedFee(companyId);
  const [fixedFeeInput, setFixedFeeInput] = useState<string>(String(fixedFee));

  useEffect(() => {
    if (config) {
      setSandbox(config.api_key_sandbox ?? "");
      setProduction(config.api_key_production ?? "");
      setEnv(config.environment);
      setAbsorbFee(Boolean(config.credit_card_absorb_fee));
      setFeePercent(String(config.credit_card_fee_percent ?? 0));
      setDefaultAccountId(config.default_account_id ?? null);
      setMaxInstallments(
        Math.min(
          Math.max(1, Number(config.credit_card_max_installments ?? 3)),
          CREDIT_CARD_MAX_INSTALLMENTS,
        ),
      );
    }
  }, [config]);

  useEffect(() => {
    setFixedFeeInput(String(fixedFee));
  }, [fixedFee]);

  const activeKey = env === "production" ? production : sandbox;
  const setActiveKey = (v: string) =>
    env === "production" ? setProduction(v) : setSandbox(v);


  const webhookUrl = useMemo(() => {
    if (typeof window === "undefined" || !config?.webhook_token) return "";
    return `${window.location.origin}/api/public/bella-pay/webhook/${config.webhook_token}`;
  }, [config?.webhook_token]);

  const status = config?.connection_status ?? "disconnected";
  const lastTested = config?.last_tested_at
    ? new Date(config.last_tested_at).toLocaleString("pt-BR")
    : null;

  const handleSave = () =>
    save.mutate({
      apiKeySandbox: sandbox || null,
      apiKeyProduction: production || null,
      environment: env,
    });

  const handleSaveCard = () => {
    const percent = Number(feePercent.replace(",", "."));
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      toast.error("Percentual inválido.");
      return;
    }
    const fixed = Number(fixedFeeInput.replace(",", "."));
    if (Number.isNaN(fixed) || fixed < 0) {
      toast.error("Taxa fixa inválida.");
      return;
    }
    setFixedFee(fixed);
    save.mutate({
      environment: env,
      creditCardAbsorbFee: absorbFee,
      creditCardFeePercent: percent,
      creditCardMaxInstallments: maxInstallments,
    });
  };

  const handleSaveAccount = () => {
    if (!defaultAccountId) {
      toast.error("Selecione uma conta financeira.");
      return;
    }
    save.mutate({ environment: env, defaultAccountId });
  };

  const handleTest = () =>
    test.mutate({
      apiKey: activeKey,
      environment: env,
      persist: true,
    });


  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* PASSO 1 — Ambiente */}
      <StepCard
        step={1}
        icon={Radio}
        title="Ambiente"
        description="Escolha em qual ambiente do Asaas você deseja operar."
      >
        <div className="grid grid-cols-2 gap-3">
          <EnvOption
            active={env === "sandbox"}
            onClick={() => setEnv("sandbox")}
            label="Sandbox"
            hint="Ambiente de testes"
          />
          <EnvOption
            active={env === "production"}
            onClick={() => setEnv("production")}
            label="Produção"
            hint="Cobranças reais"
          />
        </div>
      </StepCard>

      {/* PASSO 2 — API Key */}
      <StepCard
        step={2}
        icon={KeyRound}
        title="API Key"
        description={
          env === "production"
            ? "Cole aqui a chave de Produção gerada no painel Asaas."
            : "Cole aqui a chave de Sandbox gerada no painel Asaas."
        }
      >
        <div className="space-y-2">
          <Label htmlFor="api-key" className="text-xs font-medium">
            Chave de {env === "production" ? "Produção" : "Sandbox"}
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="api-key"
                type={showKey ? "text" : "password"}
                autoComplete="off"
                placeholder={env === "production" ? "$aact_prod_..." : "$aact_..."}
                value={activeKey}
                onChange={(e) => setActiveKey(e.target.value)}
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            A chave é armazenada de forma criptografada e nunca é exibida em logs.
          </p>
        </div>
      </StepCard>

      {/* PASSO 3 — Teste de conexão */}
      <StepCard
        step={3}
        icon={PlugZap}
        title="Teste de conexão"
        description="Valide se a chave está ativa consultando /myAccount no Asaas."
      >
        <div className="space-y-4">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={test.isPending || isLoading || !activeKey}
            className="w-full sm:w-auto"
          >
            {test.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando…
              </>
            ) : (
              "Testar conexão"
            )}
          </Button>

          <ConnectionStatus
            status={status}
            environment={env}
            lastTested={lastTested}
            message={config?.connection_message ?? null}
          />
        </div>
      </StepCard>

      {/* PASSO 4 — Webhook */}
      <StepCard
        step={4}
        icon={Webhook}
        title="Webhook"
        description="Cole esta URL em Integrações → Webhooks do Asaas para receber os eventos de cobrança."
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button
              size="icon"
              variant="outline"
              onClick={async () => {
                if (!webhookUrl) return;
                await navigator.clipboard.writeText(webhookUrl);
                toast.success("URL copiada.");
              }}
              disabled={!webhookUrl}
              aria-label="Copiar URL"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Aguardando primeiro evento do Asaas.
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Eventos suportados: cobrança criada, confirmada, cancelada e vencida.
          </p>
        </div>
      </StepCard>

      {/* PASSO 5 — Cartão de Crédito (PDV-010 + PDV-014) */}
      <StepCard
        step={5}
        icon={CreditCard}
        title="Cartão de Crédito"
        description="Defina parcelamento, quem paga a taxa e os valores. O checkout aplica automaticamente."
      >
        <div className="space-y-4">
          {/* Parcelamento máximo */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Parcelamento máximo</Label>
            <div className="flex gap-2">
              {CREDIT_CARD_ALLOWED_INSTALLMENTS.map((n) => {
                const selected = maxInstallments === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMaxInstallments(n)}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition",
                      selected
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/40"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    {n}x
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Limite de parcelas oferecidas ao cliente no checkout.
            </p>
          </div>

          {/* Quem paga a taxa */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Quem paga a taxa</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAbsorbFee(false)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm transition",
                  !absorbFee
                    ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <div className="font-medium">Loja</div>
                <div className="text-[11px] text-muted-foreground">
                  Absorve a taxa. Cliente vê apenas o valor original.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setAbsorbFee(true)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm transition",
                  absorbFee
                    ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <div className="font-medium">Cliente</div>
                <div className="text-[11px] text-muted-foreground">
                  Taxa somada ao valor cobrado no checkout.
                </div>
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="card-fee" className="text-xs font-medium">
                Taxa percentual (%)
              </Label>
              <Input
                id="card-fee"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                value={feePercent}
                onChange={(e) => setFeePercent(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Ex.: 3,99 para 3,99% por transação.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-fixed-fee" className="text-xs font-medium">
                Taxa fixa (R$)
              </Label>
              <Input
                id="card-fixed-fee"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={fixedFeeInput}
                onChange={(e) => setFixedFeeInput(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Ex.: 0,49 por transação de cartão.
              </p>
            </div>
          </div>

          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            Recebimento previsto: <strong className="text-foreground">D+32</strong> para cartão. <br />
            <span className="text-destructive italic font-medium">PIX: Utilizando conta própria (configurado fora do Asaas).</span>
          </div>

          <Button onClick={handleSaveCard} disabled={save.isPending}>
            {save.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando
              </>
            ) : (
              "Salvar configuração do cartão"
            )}
          </Button>
        </div>
      </StepCard>

      {/* PASSO 6 — Conta financeira padrão (ETAPA 2) */}
      <StepCard
        step={6}
        icon={Landmark}
        title="Conta financeira padrão"
        description="Conta usada para creditar as baixas dos pagamentos confirmados pelo Bella Pay."
      >
        <div className="space-y-3">
          {activeAccounts.length === 0 ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              Nenhuma conta financeira ativa encontrada. Cadastre uma conta em
              Financeiro &gt; Contas Financeiras antes de receber pelo Bella Pay.
            </div>
          ) : (
            <Select
              value={defaultAccountId ?? ""}
              onValueChange={(v) => setDefaultAccountId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta de destino" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <p className="text-[11px] text-muted-foreground">
            Sem esta conta configurada, pagamentos confirmados pelo gateway
            mantêm o recebível pendente e a venda não é marcada como paga.
          </p>

          <Button
            onClick={handleSaveAccount}
            disabled={save.isPending || !defaultAccountId}
            className="w-full sm:w-auto"
          >
            {save.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando
              </>
            ) : (
              "Salvar conta padrão"
            )}
          </Button>
        </div>
      </StepCard>
    </div>



  );
}

// ---------------------------------------------------------------------------
// Sub-componentes visuais
// ---------------------------------------------------------------------------

interface StepCardProps {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}

function StepCard({ step, icon: Icon, title, description, children }: StepCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-xs font-semibold text-foreground">
            {step}
          </div>
          <div className="flex-1 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{title}</h3>
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EnvOption({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition-all",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/40"
          : "border-border hover:border-foreground/20 hover:bg-muted/40",
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            active ? "bg-primary" : "bg-muted-foreground/30",
          )}
        />
      </div>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </button>
  );
}

function ConnectionStatus({
  status,
  environment,
  lastTested,
  message,
}: {
  status: "connected" | "error" | "disconnected";
  environment: BellaPayEnvironment;
  lastTested: string | null;
  message: string | null;
}) {
  if (status === "connected") {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <Badge className="bg-success/10 text-success border-success/20">
            Conectado
          </Badge>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <StatusRow
            label="Ambiente"
            value={environment === "production" ? "Produção" : "Sandbox"}
          />
          <StatusRow label="Último teste" value={lastTested ?? "—"} />
        </dl>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <Badge variant="destructive">Falha na conexão</Badge>
        </div>
        {message ? (
          <p className="mt-2 text-xs text-muted-foreground">{message}</p>
        ) : null}
        {lastTested ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Último teste: {lastTested}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">
          Ainda não testado. Salve a chave e clique em <strong>Testar conexão</strong>.
        </p>
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
