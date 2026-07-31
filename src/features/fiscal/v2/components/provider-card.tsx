import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  CheckCircle2,
  KeyRound,
  Server,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import {
  fiscalKeys,
  useFiscalProviderConfig,
  useUpdateFiscalProvider,
  type UpdateProviderInput,
} from "../hooks/use-fiscal";
import {
  provisionFiscalProvider,
  resetFiscalProviderProvisioning,
  setProviderApiKey,
  testProviderConnectionAll,
} from "../functions/fiscal.functions";
import type { NfeEnvironment } from "../functions/fiscal.functions";
import type { ProviderHealthItem } from "../lib/provider-health";
import { ProductionConfirmDialog } from "./fiscal-environment";

type ProviderId = UpdateProviderInput["providerId"];

/** Ícone por veredito de item do health check. */
const HEALTH_ICON: Record<ProviderHealthItem["status"], string> = {
  ok: "✓",
  warning: "⚠",
  error: "✗",
  skipped: "–",
};

const PROVIDERS: Array<{ id: ProviderId; label: string; hint?: string }> = [
  { id: "mock", label: "Mock (homologação interna)", hint: "Somente para testes." },
  { id: "tecnospeed", label: "TecnoSpeed / TecnoMicro" },
  { id: "focus_nfe", label: "Focus NFe" },
  { id: "plugnotas", label: "PlugNotas" },
  { id: "nfe_io", label: "NFe.io" },
];

export function ProviderCard() {
  const config = useFiscalProviderConfig();
  const update = useUpdateFiscalProvider();
  const qc = useQueryClient();
  const setKey = useServerFn(setProviderApiKey);
  const runProvision = useServerFn(provisionFiscalProvider);
  const runResetProvision = useServerFn(resetFiscalProviderProvisioning);
  const runHealthAll = useServerFn(testProviderConnectionAll);

  const [providerId, setProviderId] = useState<ProviderId>("mock");
  const [environment, setEnvironment] = useState<NfeEnvironment>("homologation");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmProd, setConfirmProd] = useState(false);
  // URLs e tokens são por ambiente e totalmente independentes.
  const [envUrls, setEnvUrls] = useState<Record<NfeEnvironment, string>>({
    production: "",
    homologation: "",
  });
  const [envKeys, setEnvKeys] = useState<Record<NfeEnvironment, string>>({
    production: "",
    homologation: "",
  });
  // Token PRINCIPAL (admin) — usado só em `/v2/empresas`.
  const [envAdminKeys, setEnvAdminKeys] = useState<Record<NfeEnvironment, string>>({
    production: "",
    homologation: "",
  });
  const [healthItems, setHealthItems] = useState<Record<
    NfeEnvironment,
    ProviderHealthItem[]
  > | null>(null);

  // Hidrata o formulário UMA única vez, quando a configuração persistida
  // chega. Qualquer refetch posterior (realtime, health check, invalidação
  // após salvar) não pode sobrescrever o que o usuário está digitando — era
  // isso que fazia a "URL da API" ser enviada como null.
  const persisted = config.data;
  const persistedRef = useRef(persisted);
  persistedRef.current = persisted;
  const hydratedRef = useRef(false);
  const hasPersisted = Boolean(persisted);

  useEffect(() => {
    const p = persistedRef.current;
    if (!p || hydratedRef.current) return;
    hydratedRef.current = true;
    setProviderId(p.providerId as ProviderId);
    setEnvironment(p.environment);
    setWebhookUrl(p.webhookUrl ?? "");
    setNotes(p.notes ?? "");
    setEnvUrls({
      production: p.environments?.production?.apiUrl ?? "",
      homologation: p.environments?.homologation?.apiUrl ?? "",
    });
  }, [hasPersisted]);

  const saveKey = useMutation({
    mutationFn: (input: {
      value: string | null;
      environment: NfeEnvironment;
      credential: "company" | "admin";
    }) =>
      setKey({
        data: {
          apiKey: input.value,
          environment: input.environment,
          credential: input.credential,
        },
      }),
    onSuccess: (_r, input) => {
      qc.invalidateQueries({ queryKey: fiscalKeys.provider() });
      toast.success("Token salvo.");
      const reset = (s: Record<NfeEnvironment, string>) => ({ ...s, [input.environment]: "" });
      if (input.credential === "admin") setEnvAdminKeys(reset);
      else setEnvKeys(reset);
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar token."),
  });

  const health = useMutation({
    mutationFn: () => runHealthAll(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: fiscalKeys.provider() });
      setHealthItems({ production: r.production.items, homologation: r.homologation.items });
      const label = (s: "ok" | "warning" | "error") =>
        s === "ok" ? "✓ conectado" : s === "warning" ? "⚠ atenção" : "✗ falha";
      toast.info(
        `Produção: ${label(r.production.status)} — ${r.production.message}\n` +
          `Homologação: ${label(r.homologation.status)} — ${r.homologation.message}`,
      );
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao testar conexão."),
  });


  const provision = useMutation({
    mutationFn: (input: { markOnly: boolean }) => runProvision({ data: input }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: fiscalKeys.provider() });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao provisionar empresa."),
  });

  const resetProvision = useMutation({
    mutationFn: () => runResetProvision(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fiscalKeys.provider() });
      toast.success("Provisionamento removido. Envie o certificado novamente.");
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao remover provisionamento."),
  });

  const hasApiKey = Boolean(config.data?.hasApiKey);
  const lastStatus = config.data?.lastHealthStatus ?? null;
  const isProvisioned = Boolean(config.data?.provisionedAt);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" /> Provedor de NF-e
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Provedor</Label>
            <Select value={providerId} onValueChange={(v) => setProviderId(v as ProviderId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Ambiente padrão</Label>
            <Select
              value={environment}
              onValueChange={(v) => {
                if (v === "production" && environment !== "production") {
                  setConfirmProd(true);
                  return;
                }
                setEnvironment(v as NfeEnvironment);
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
        </div>

        <div className="space-y-1">
          <Label>Webhook (opcional)</Label>
          <Input
            placeholder="https://seu-dominio/api/public/nfe/callback"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label>Notas internas</Label>
          <Textarea
            rows={2}
            placeholder="Ex.: cnpj cadastrado no provedor, contato do suporte, plano contratado…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Credenciais por ambiente: a Focus emite tokens distintos para
            produção e homologação — nunca reaproveitamos um no outro. */}
        <div className="grid gap-3 md:grid-cols-2">
          {(["production", "homologation"] as const).map((env) => {
            const envCfg = config.data?.environments?.[env];
            const envHasKey = Boolean(envCfg?.hasApiKey);
            const envHasAdminKey = Boolean(envCfg?.hasAdminKey);
            const envStatus = envCfg?.lastHealthStatus ?? null;
            return (
              <div key={env} className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    {env === "production" ? "Produção" : "Homologação"}
                  </Label>
                  {envStatus === "ok" ? (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck className="h-3 w-3" /> Conectado
                    </Badge>
                  ) : envHasKey ? (
                    <Badge variant="outline" className="gap-1">
                      <ShieldCheck className="h-3 w-3" /> Token configurado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <ShieldAlert className="h-3 w-3" /> Token ausente
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">URL da API</Label>
                  <Input
                    placeholder={
                      env === "production"
                        ? "https://api.focusnfe.com.br"
                        : "https://homologacao.focusnfe.com.br"
                    }
                    value={envUrls[env]}
                    onChange={(e) => setEnvUrls((s) => ({ ...s, [env]: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Token Empresa (emissão de NF-e)</Label>
                  <Input
                    type="password"
                    placeholder={
                      envHasKey ? "•••••••• (deixe em branco para manter)" : "Cole o token deste ambiente"
                    }
                    value={envKeys[env]}
                    onChange={(e) => setEnvKeys((s) => ({ ...s, [env]: e.target.value }))}
                    autoComplete="off"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      saveKey.mutate({
                        value: envKeys[env].trim(),
                        environment: env,
                        credential: "company",
                      })
                    }
                    disabled={saveKey.isPending || !envKeys[env].trim()}
                  >
                    Salvar token
                  </Button>
                  {envHasKey && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        saveKey.mutate({ value: null, environment: env, credential: "company" })
                      }
                      disabled={saveKey.isPending}
                    >
                      Remover
                    </Button>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Token Principal — Admin (cadastro da empresa)</Label>
                  <Input
                    type="password"
                    placeholder={
                      envHasAdminKey
                        ? "•••••••• (deixe em branco para manter)"
                        : "Token da conta, usado só em /v2/empresas"
                    }
                    value={envAdminKeys[env]}
                    onChange={(e) => setEnvAdminKeys((s) => ({ ...s, [env]: e.target.value }))}
                    autoComplete="off"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      saveKey.mutate({
                        value: envAdminKeys[env].trim(),
                        environment: env,
                        credential: "admin",
                      })
                    }
                    disabled={saveKey.isPending || !envAdminKeys[env].trim()}
                  >
                    Salvar token admin
                  </Button>
                  {envHasAdminKey && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        saveKey.mutate({ value: null, environment: env, credential: "admin" })
                      }
                      disabled={saveKey.isPending}
                    >
                      Remover
                    </Button>
                  )}
                </div>

                {healthItems?.[env]?.length ? (
                  <ul className="space-y-1 border-t pt-2">
                    {healthItems[env].map((it) => (
                      <li key={it.id} className="flex gap-2 text-xs">
                        <span className="shrink-0">{HEALTH_ICON[it.status]}</span>
                        <span>
                          <strong className="font-medium">{it.label}:</strong> {it.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {envCfg?.lastHealthCheckAt && (
                  <p
                    className={
                      envStatus === "error"
                        ? "text-xs text-destructive"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {new Date(envCfg.lastHealthCheckAt).toLocaleString("pt-BR")}
                    {envCfg.lastHealthMessage ? ` — ${envCfg.lastHealthMessage}` : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Cada ambiente guarda token e URL próprios, criptografados com AES-256-GCM. O motor usa
          sempre a credencial do ambiente da emissão — nunca a do outro.
        </p>


        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4" /> Empresa no provedor
            </Label>
            {isProvisioned ? (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3 w-3" /> Provisionada
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <ShieldAlert className="h-3 w-3" /> Não provisionada
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            O cadastro da empresa/certificado no provedor (<code>POST /v2/empresas</code>) exige
            credencial administrativa e <strong>não roda mais durante a emissão</strong>. Execute-o
            aqui na primeira configuração, na troca do certificado A1 ou em reprovisionamento
            manual.
          </p>
          {isProvisioned && (
            <p className="text-xs text-muted-foreground">
              Provisionada em {new Date(config.data!.provisionedAt!).toLocaleString("pt-BR")} (
              {config.data?.provisionedEnvironment === "production" ? "Produção" : "Homologação"})
              {config.data?.provisionedNote ? ` — ${config.data.provisionedNote}` : ""}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => provision.mutate({ markOnly: false })}
              disabled={provision.isPending || resetProvision.isPending}
            >
              {provision.isPending ? "Provisionando…" : "Provisionar certificado"}
            </Button>
            <Button
              variant="outline"
              onClick={() => provision.mutate({ markOnly: true })}
              disabled={provision.isPending || resetProvision.isPending}
            >
              Já provisionada no painel
            </Button>
            {isProvisioned && (
              <Button
                variant="ghost"
                onClick={() => resetProvision.mutate()}
                disabled={provision.isPending || resetProvision.isPending}
              >
                Reprovisionar
              </Button>
            )}
          </div>
        </div>

        {config.data?.lastHealthCheckAt && (
          <Alert variant={lastStatus === "error" ? "destructive" : "default"}>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Última verificação: {new Date(config.data.lastHealthCheckAt).toLocaleString("pt-BR")}
              {config.data.lastHealthMessage && ` — ${config.data.lastHealthMessage}`}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              const envPayload = {
                production: {
                  apiUrl: envUrls.production.trim() || null,
                  apiKey: envKeys.production.trim() || null,
                  adminApiKey: envAdminKeys.production.trim() || null,
                },
                homologation: {
                  apiUrl: envUrls.homologation.trim() || null,
                  apiKey: envKeys.homologation.trim() || null,
                  adminApiKey: envAdminKeys.homologation.trim() || null,
                },
              };
              update.mutate(
                {
                  providerId,
                  environment,
                  // Compatibilidade com o registro legado: espelha a URL do
                  // ambiente ativo, sem tocar na credencial do outro.
                  apiUrl: envUrls[environment].trim() || null,
                  webhookUrl: webhookUrl.trim() || null,
                  notes: notes.trim() || null,
                  environments: envPayload,
                },
                {
                  onSuccess: () => {
                    setEnvKeys({ production: "", homologation: "" });
                    setEnvAdminKeys({ production: "", homologation: "" });
                  },
                },
              );
            }}
            disabled={update.isPending}
          >
            {update.isPending ? "Salvando…" : "Salvar provedor"}
          </Button>

          <Button variant="outline" onClick={() => health.mutate()} disabled={health.isPending}>
            {health.isPending ? "Testando…" : "Testar conexão"}
          </Button>
        </div>
      </CardContent>
      <ProductionConfirmDialog
        open={confirmProd}
        onOpenChange={setConfirmProd}
        onConfirm={() => setEnvironment("production")}
      />
    </Card>
  );
}
