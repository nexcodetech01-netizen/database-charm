import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  FileCheck,
  Loader2,
  Scale,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import {
  useCompanyFiscalProfile,
  useFiscalCertificates,
  useFiscalProviderConfig,
  useFiscalSettings,
} from "../hooks/use-fiscal";
import { testProviderConnection } from "../functions/fiscal.functions";

import { CompanyFiscalCard } from "./company-fiscal-card";
import { CertificateCard } from "./certificate-card";
import { ProviderCard } from "./provider-card";
import { FiscalRulesCard } from "./fiscal-rules-card";
import { FiscalOnboardingChecklist } from "./fiscal-onboarding-checklist";

type StepId = "empresa" | "certificado" | "provedor" | "regras" | "testes";

interface StepDef {
  id: StepId;
  title: string;
  short: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepDef[] = [
  {
    id: "empresa",
    title: "Dados da empresa",
    short: "Empresa",
    description: "Confirme razão social, CNPJ, IE e endereço fiscal.",
    icon: Building2,
  },
  {
    id: "certificado",
    title: "Certificado A1",
    short: "Certificado",
    description: "Envie o arquivo .pfx e defina a senha.",
    icon: ShieldCheck,
  },
  {
    id: "provedor",
    title: "Provedor fiscal",
    short: "Provedor",
    description: "Escolha o provedor e cadastre a API key.",
    icon: Server,
  },
  {
    id: "regras",
    title: "Configuração fiscal",
    short: "Regras",
    description: "Regime, série, ambiente e defaults de emissão.",
    icon: Scale,
  },
  {
    id: "testes",
    title: "Testes e validação",
    short: "Validação",
    description: "Verifique a conexão com o provedor e finalize.",
    icon: FileCheck,
  },
];

export interface FiscalConfigWizardProps {
  initialStep?: StepId;
}

export function FiscalConfigWizard({ initialStep }: FiscalConfigWizardProps = {}) {
  const startIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.id === initialStep),
  );
  const [current, setCurrent] = useState(startIndex === -1 ? 0 : startIndex);

  const company = useCompanyFiscalProfile();
  const settings = useFiscalSettings();
  const certs = useFiscalCertificates();
  const provider = useFiscalProviderConfig();

  const completion = useMemo<Record<StepId, boolean>>(() => {
    const c = company.data;
    const s = settings.data;
    const p = provider.data;
    const activeCert = certs.data?.some((cert) => cert.isActive) ?? false;
    return {
      empresa: Boolean(
        c?.cnpj &&
          c.ie &&
          c.address &&
          c.city &&
          c.state &&
          c.zipcode,
      ),
      certificado: activeCert,
      provedor: Boolean(p && p.providerId !== "mock" && p.hasApiKey),
      regras: Boolean(
        s && s.operationNature && s.defaultCfop,
      ),
      testes: p?.lastHealthStatus === "ok",
    };
  }, [company.data, settings.data, certs.data, provider.data]);

  const completedCount = STEPS.filter((s) => completion[s.id]).length;
  const progress = Math.round((completedCount / STEPS.length) * 100);
  const currentStep = STEPS[current];
  const isLast = current === STEPS.length - 1;
  const currentComplete = completion[currentStep.id];

  const goNext = () => {
    if (!currentComplete) {
      toast.warning(
        `Complete "${currentStep.title}" antes de avançar. Salve os dados obrigatórios da etapa.`,
      );
      return;
    }
    if (!isLast) setCurrent((v) => v + 1);
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Assistente de configuração fiscal
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cinco etapas para deixar o módulo pronto para emitir NF-e.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 self-start">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            {completedCount} de {STEPS.length} etapas
          </Badge>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ol className="mt-6 grid gap-2 sm:grid-cols-5">
          {STEPS.map((step, index) => {
            const done = completion[step.id];
            const active = index === current;
            const Icon = step.icon;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => setCurrent(index)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      done
                        ? "bg-emerald-500 text-white"
                        : active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">
                      {index + 1}. {step.short}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {done ? "Concluído" : active ? "Em andamento" : "Pendente"}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </header>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Etapa {current + 1} de {STEPS.length}
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">
              {currentStep.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {currentStep.description}
            </p>
          </div>
          {currentComplete ? (
            <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Configurado
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              Pendente
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          {currentStep.id === "empresa" && <CompanyFiscalCard />}
          {currentStep.id === "certificado" && <CertificateCard />}
          {currentStep.id === "provedor" && <ProviderCard />}
          {currentStep.id === "regras" && <FiscalRulesCard />}
          {currentStep.id === "testes" && (
            <ValidationStep completion={completion} />
          )}
        </div>

        <footer className="mt-6 flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setCurrent((v) => Math.max(0, v - 1))}
            disabled={current === 0}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            {!currentComplete && (
              <span className="text-xs text-muted-foreground">
                Salve os dados desta etapa para avançar.
              </span>
            )}
            {!isLast ? (
              <Button onClick={goNext} disabled={!currentComplete}>
                Próximo <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() =>
                  toast.success(
                    "Configuração fiscal concluída. O dashboard já reflete o novo status.",
                  )
                }
                disabled={completedCount < STEPS.length}
              >
                <Check className="mr-1.5 h-4 w-4" /> Concluir
              </Button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}

function ValidationStep({
  completion,
}: {
  completion: Record<StepId, boolean>;
}) {
  const runHealth = useServerFn(testProviderConnection);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    status: "ok" | "warning" | "error";
    message: string;
  } | null>(null);
  const provider = useFiscalProviderConfig();

  const prereqsOk =
    completion.empresa && completion.certificado && completion.provedor && completion.regras;

  const runTest = async () => {
    setRunning(true);
    try {
      const r = await runHealth();
      setResult({ status: r.status, message: r.message });
      const map = {
        ok: toast.success,
        warning: toast.warning,
        error: toast.error,
      } as const;
      map[r.status](r.message);
      provider.refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao testar conexão.";
      setResult({ status: "error", message: msg });
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {!prereqsOk && (
        <Alert>
          <AlertTitle>Etapas anteriores pendentes</AlertTitle>
          <AlertDescription>
            Complete empresa, certificado, provedor e regras fiscais para
            liberar o teste de conexão.
          </AlertDescription>
        </Alert>
      )}

      <FiscalOnboardingChecklist />

      <div className="rounded-lg border border-border/60 bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Teste de conexão com o provedor</p>
            <p className="text-xs text-muted-foreground">
              Executa uma checagem de saúde na API configurada e registra o
              resultado no módulo fiscal.
            </p>
          </div>
          <Button onClick={runTest} disabled={running || !prereqsOk}>
            {running ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Testando…
              </>
            ) : (
              <>
                <FileCheck className="mr-1.5 h-4 w-4" /> Testar agora
              </>
            )}
          </Button>
        </div>

        {result && (
          <Alert
            className="mt-3"
            variant={result.status === "error" ? "destructive" : "default"}
          >
            {result.status === "ok" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {result.status === "ok"
                ? "Conexão saudável"
                : result.status === "warning"
                  ? "Conexão com avisos"
                  : "Falha na conexão"}
            </AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
