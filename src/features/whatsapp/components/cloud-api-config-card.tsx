import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Plug,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getWhatsAppStatus,
  validateWhatsAppConnection,
} from "@/lib/whatsapp.functions";

const SECRET_LABELS: Record<string, string> = {
  META_APP_ID: "Meta App ID",
  META_APP_SECRET: "Meta App Secret",
  WHATSAPP_WABA_ID: "WhatsApp Business Account ID (WABA)",
  WHATSAPP_PHONE_NUMBER_ID: "Phone Number ID",
  WHATSAPP_ACCESS_TOKEN: "Access Token permanente",
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: "Webhook Verify Token",
};

export function CloudApiConfigCard() {
  const statusFn = useServerFn(getWhatsAppStatus);
  const validateFn = useServerFn(validateWhatsAppConnection);

  const statusQuery = useQuery({
    queryKey: ["whatsapp", "cloud-api", "status"],
    queryFn: () => statusFn(),
  });

  const validateMutation = useMutation({
    mutationFn: () => validateFn(),
    onSuccess: (result) => {
      if (result.connected) {
        toast.success("Conexão validada com sucesso");
      } else {
        toast.error(result.error ?? "Falha ao validar conexão");
      }
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao validar"),
  });

  const status = statusQuery.data;
  const validation = validateMutation.data;
  const connected = validation?.connected ?? false;

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-sm">
              WhatsApp Business Cloud API (oficial Meta)
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Conexão direta com a Meta Graph API. Credenciais armazenadas em
              cofre seguro do projeto.
            </p>
          </div>
        </div>
        {connected ? (
          <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Conectado
          </Badge>
        ) : status?.allConfigured ? (
          <Badge variant="outline">Aguardando validação</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Não conectado
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {status?.secrets.map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/10 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">
                  {SECRET_LABELS[s.name] ?? s.name}
                </p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {s.name}
                </p>
              </div>
              {s.configured ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                >
                  <ShieldCheck className="mr-1 h-3 w-3" /> Salvo
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  <KeyRound className="mr-1 h-3 w-3" /> Pendente
                </Badge>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Webhook URL (cadastrar no App Meta → WhatsApp → Configuration)
          </Label>
          <div className="flex gap-2">
            <Input readOnly value={status?.webhookUrl ?? ""} className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => status && copy(status.webhookUrl, "Webhook URL")}
              disabled={!status}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Label className="mt-2 text-xs text-muted-foreground">
            Webhook Verify Token
          </Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={status?.webhookVerifyToken ?? ""}
              placeholder={
                status?.webhookVerifyTokenConfigured
                  ? ""
                  : "Configure o secret WHATSAPP_WEBHOOK_VERIFY_TOKEN"
              }
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                status?.webhookVerifyToken &&
                copy(status.webhookVerifyToken, "Verify Token")
              }
              disabled={!status?.webhookVerifyToken}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Cole este valor no campo <span className="font-mono">Verify Token</span> do
            App Meta → WhatsApp → Configuration. Assine os campos{" "}
            <span className="font-mono">messages</span> e{" "}
            <span className="font-mono">message_status</span>.
          </p>
        </div>

        <ValidationSummary state={validateMutation.status} result={validation} />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-[11px] text-muted-foreground">
            Para alterar credenciais, use o cofre de Secrets do projeto.
          </p>
          <Button
            size="sm"
            onClick={() => validateMutation.mutate()}
            disabled={!status?.allConfigured || validateMutation.isPending}
          >
            {validateMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Validar conexão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ValidationSummary({
  state,
  result,
}: {
  state: "idle" | "pending" | "success" | "error";
  result: Awaited<ReturnType<typeof validateWhatsAppConnection>> | undefined;
}) {
  if (state === "idle" || !result) return null;

  if (result.connected) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> API conectada
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
          <dt>Número</dt>
          <dd className="text-foreground">{result.phoneNumber ?? "—"}</dd>
          <dt>Nome verificado</dt>
          <dd className="text-foreground">{result.verifiedName ?? "—"}</dd>
          <dt>Conta WABA</dt>
          <dd className="text-foreground">{result.wabaName ?? "—"}</dd>
          <dt>Qualidade</dt>
          <dd className="text-foreground">{result.qualityRating ?? "—"}</dd>
        </dl>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
      <div className="flex items-center gap-1.5 font-medium text-destructive">
        <XCircle className="h-3.5 w-3.5" /> Falha ao validar
      </div>
      <p className="mt-1 text-muted-foreground">{result.error}</p>
    </div>
  );
}
