import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  runSystemDiagnostics,
  type DiagnosticsResult,
  type CheckStatus,
} from "@/lib/diagnostics.functions";

const STATUS_META: Record<
  CheckStatus | "running",
  { icon: typeof CheckCircle2; tone: string; label: string }
> = {
  ok: { icon: CheckCircle2, tone: "text-emerald-500", label: "OK" },
  warning: { icon: AlertTriangle, tone: "text-amber-500", label: "Aviso" },
  error: { icon: XCircle, tone: "text-red-500", label: "Erro" },
  running: { icon: Loader2, tone: "text-primary", label: "Executando" },
};

function StatusIcon({ status }: { status: CheckStatus | "running" }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Icon
      className={`h-4 w-4 shrink-0 ${meta.tone} ${
        status === "running" ? "animate-spin" : ""
      }`}
    />
  );
}

export function DiagnosticoSection() {
  const runDiagnostics = useServerFn(runSystemDiagnostics);
  const [result, setResult] = useState<DiagnosticsResult | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await runDiagnostics();
      setResult(res);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao executar diagnóstico",
      );
    } finally {
      setRunning(false);
    }
  };

  const grouped = result
    ? result.checks.reduce<Record<string, typeof result.checks>>((acc, c) => {
        (acc[c.category] ??= []).push(c);
        return acc;
      }, {})
    : null;

  const overallMeta = result ? STATUS_META[result.overall] : null;
  const overallText =
    result?.overall === "ok"
      ? "Sistema saudável"
      : result?.overall === "warning"
        ? "Sistema operando com avisos"
        : "Sistema com falhas críticas";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">Health Check do NexOS</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Verifica conexões, integrações e configurações do sistema.
                Nenhuma ação externa é executada.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={handleRun} disabled={running}>
            {running ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Executando…
              </>
            ) : (
              <>
                <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                Executar Diagnóstico
              </>
            )}
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {!result && !running && (
            <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              Clique em <strong>Executar Diagnóstico</strong> para iniciar a
              verificação.
            </div>
          )}

          {running && (
            <div className="space-y-2">
              {[
                "Banco de Dados",
                "Autenticação",
                "Edge Functions",
                "Storage",
                "WhatsApp",
                "Asaas",
                "Bella IA",
              ].map((cat) => (
                <div
                  key={cat}
                  className="flex items-center gap-3 rounded-md border bg-muted/10 px-3 py-2 text-sm"
                >
                  <StatusIcon status="running" />
                  <span className="font-medium">{cat}</span>
                  <span className="text-xs text-muted-foreground">
                    Executando…
                  </span>
                </div>
              ))}
            </div>
          )}

          {grouped && (
            <div className="space-y-4">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {category}
                  </div>
                  <div className="divide-y rounded-md border bg-card">
                    {items.map((check) => (
                      <div
                        key={check.id}
                        className="flex items-start justify-between gap-3 px-3 py-2.5"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <StatusIcon status={check.status} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {check.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {check.message}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STATUS_META[check.status].tone}`}
                        >
                          {STATUS_META[check.status].label}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {result && overallMeta && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
{buildSummary(result)}
            </pre>
            <Separator />
            <div className="flex items-center gap-2">
              <StatusIcon status={result.overall} />
              <span className="text-sm font-semibold">{overallText}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(result.ranAt).toLocaleString("pt-BR")}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function buildSummary(result: DiagnosticsResult): string {
  const labels: Record<string, string> = {
    "Banco de Dados": "Banco",
    Autenticação: "Autenticação",
    "Edge Functions": "Edge Functions",
    Storage: "Storage",
    WhatsApp: "WhatsApp",
    Asaas: "Asaas",
    "Bella IA": "Bella IA",
  };
  const byCategory = new Map<string, CheckStatus>();
  for (const c of result.checks) {
    const prev = byCategory.get(c.category);
    const rank = (s: CheckStatus) =>
      s === "error" ? 2 : s === "warning" ? 1 : 0;
    if (!prev || rank(c.status) > rank(prev)) byCategory.set(c.category, c.status);
  }
  const lines = ["Health Check", ""];
  const width = 18;
  for (const [cat, label] of Object.entries(labels)) {
    const status = byCategory.get(cat);
    if (!status) continue;
    const dots = ".".repeat(Math.max(3, width - label.length));
    const tag =
      status === "ok" ? "OK" : status === "warning" ? "AVISO" : "ERRO";
    lines.push(`${label} ${dots} ${tag}`);
  }
  return lines.join("\n");
}
