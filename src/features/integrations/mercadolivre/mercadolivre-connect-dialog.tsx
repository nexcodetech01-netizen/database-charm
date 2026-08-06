import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  XCircle,
  Settings2,
} from "lucide-react";
import { MercadoLivrePricingSettingsDialog } from "@/features/products/components/ml-pricing-settings-dialog";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  disconnectMercadoLivre,
  getMercadoLivreIntegration,
  saveMercadoLivreCredentials,
  startMercadoLivreOAuth,
} from "@/lib/mercadolivre.functions";

type Status = Awaited<ReturnType<typeof getMercadoLivreIntegration>> | null;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: (connected: boolean) => void;
}

interface StatusDescriptor {
  label: string;
  tone: "success" | "warning" | "error" | "muted";
  icon: typeof CheckCircle2;
  message: string;
  action?: string;
}

function describeStatus(s: NonNullable<Status>): StatusDescriptor {
  switch (s.status) {
    case "connected":
      return {
        label: "Conectado",
        tone: "success",
        icon: CheckCircle2,
        message: s.mlNickname
          ? `Conta @${s.mlNickname} autorizada e sincronizando.`
          : "Conta autorizada e sincronizando.",
      };
    case "expiring_soon":
      return {
        label: "Expira em breve",
        tone: "warning",
        icon: AlertTriangle,
        message: "O token de acesso expira nas próximas 24 horas.",
        action: "Reautorize para evitar interrupção.",
      };
    case "expired":
      return {
        label: "Expirado",
        tone: "error",
        icon: XCircle,
        message: "O token de acesso expirou e as chamadas ao Mercado Livre irão falhar.",
        action: "Reautorize a conta para restabelecer a conexão.",
      };
    case "credentials_only":
      return {
        label: "Aguardando autorização",
        tone: "warning",
        icon: AlertTriangle,
        message: "Credenciais salvas. Falta autorizar a conta Mercado Livre.",
        action: "Clique em \"Autorizar conta Mercado Livre\" para concluir.",
      };
    case "disconnected":
    default:
      return {
        label: "Não conectado",
        tone: "muted",
        icon: ShoppingBag,
        message: "Nenhuma credencial cadastrada para esta empresa.",
        action: "Salve o App ID e Client Secret do seu app ML para começar.",
      };
  }
}

const toneStyles: Record<StatusDescriptor["tone"], { badge: string; alert: string; icon: string }> = {
  success: {
    badge: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
    alert: "border-emerald-500/40 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    badge: "border-amber-500/40 text-amber-600 dark:text-amber-400",
    alert: "border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-100",
    icon: "text-amber-600 dark:text-amber-400",
  },
  error: {
    badge: "border-destructive/50 text-destructive",
    alert: "border-destructive/50 bg-destructive/5 text-destructive",
    icon: "text-destructive",
  },
  muted: {
    badge: "border-muted-foreground/30 text-muted-foreground",
    alert: "border-border bg-muted/30 text-muted-foreground",
    icon: "text-muted-foreground",
  },
};

function formatError(err: unknown): { title: string; description: string; recovery?: string } {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();

  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return {
      title: "Sem permissão para esta empresa",
      description: "Sua conta não tem acesso à empresa selecionada.",
      recovery: "Troque de empresa no menu ou peça acesso ao administrador.",
    };
  }
  if (lower.includes("unauthorized") || lower.includes("jwt") || lower.includes("401")) {
    return {
      title: "Sessão expirada",
      description: "Sua sessão de login expirou.",
      recovery: "Saia e entre novamente para renovar a sessão.",
    };
  }
  return {
    title: "Ocorreu um erro",
    description: raw || "Erro desconhecido.",
    recovery: "Tente novamente. Se persistir, salve as credenciais e reautorize a conta.",
  };
}

export function MercadoLivreConnectDialog({ open, onOpenChange, onStatusChange }: Props) {
  const getFn = useServerFn(getMercadoLivreIntegration);
  const saveFn = useServerFn(saveMercadoLivreCredentials);
  const startFn = useServerFn(startMercadoLivreOAuth);
  const disconnectFn = useServerFn(disconnectMercadoLivre);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [inlineError, setInlineError] = useState<{ title: string; description: string; recovery?: string } | null>(null);
  const [pricingSettingsOpen, setPricingSettingsOpen] = useState(false);

  const refresh = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setInlineError(null);
    try {
      const s = await getFn();
      setStatus(s);
      setClientId(prev => prev || (s.clientId ?? ""));
      onStatusChange?.(s.connected);
    } catch (err) {
      const info = formatError(err);
      setInlineError(info);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [getFn, onStatusChange]);

  useEffect(() => {
    if (open && !status) void refresh(true);
  }, [open, refresh, status]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const s = params.get("ml_status");
    if (!s) return;
    
    params.delete("ml_status");
    params.delete("ml_error");
    const clean = window.location.pathname + (params.toString() ? `?${params.toString()}` : "") + window.location.hash;
    window.history.replaceState({}, "", clean);

    if (s === "connected") {
      toast.success("Mercado Livre conectado com sucesso.");
      void refresh(true);
    }
  }, [refresh]);

  const handleSave = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Preencha Client ID e Client Secret.");
      return;
    }
    setSaving(true);
    setInlineError(null);
    try {
      await saveFn({ data: { clientId: clientId.trim(), clientSecret: clientSecret.trim() } });
      setClientSecret("");
      toast.success("Credenciais salvas com segurança.");
      await refresh(true);
    } catch (err) {
      setInlineError(formatError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAuthorize = async () => {
    setAuthorizing(true);
    setInlineError(null);
    try {
      const { authorizationUrl } = await startFn();
      window.location.href = authorizationUrl;
    } catch (err) {
      setAuthorizing(false);
      setInlineError(formatError(err));
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar a conta Mercado Livre desta empresa?")) return;
    try {
      await disconnectFn();
      toast.info("Mercado Livre desconectado.");
      setClientSecret("");
      await refresh(true);
    } catch (err) {
      setInlineError(formatError(err));
    }
  };

  const hasCreds = status?.hasCredentials ?? false;
  const connected = status?.connected ?? false;
  const descriptor = status ? describeStatus(status) : null;
  const tone = descriptor ? toneStyles[descriptor.tone] : null;
  const StatusIcon = descriptor?.icon ?? ShoppingBag;
  const needsReauth = status?.status === "expired" || status?.status === "expiring_soon";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-lg flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Mercado Livre
            {descriptor && tone && (
              <Badge variant="outline" className={`ml-1 ${tone.badge}`}>
                {descriptor.label}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Configure o app do Mercado Livre e autorize a conta para sincronizar anúncios, pedidos e estoque.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <div className="space-y-4">
              {descriptor && tone && (
                <Alert className={tone.alert}>
                  <StatusIcon className={`h-4 w-4 ${tone.icon}`} />
                  <AlertTitle>{descriptor.label}</AlertTitle>
                  <AlertDescription className="space-y-1">
                    <p>{descriptor.message}</p>
                    {descriptor.action && (
                      <p className="text-xs opacity-90">{descriptor.action}</p>
                    )}
                    {connected && status && (
                      <div className="mt-2 space-y-0.5 text-xs opacity-90">
                        {status.mlUserId && <div>ML User ID: {status.mlUserId}</div>}
                        {status.tokenExpiresAt && (
                          <div>
                            Token expira em: {new Date(status.tokenExpiresAt).toLocaleString("pt-BR")}
                          </div>
                        )}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {inlineError && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>{inlineError.title}</AlertTitle>
                  <AlertDescription className="space-y-1">
                    <p>{inlineError.description}</p>
                    {inlineError.recovery && (
                      <p className="text-xs opacity-90">{inlineError.recovery}</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ml-client-id" className="text-xs font-medium">
                    App ID / Client ID
                  </Label>
                  <Input
                    id="ml-client-id"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Ex: 1234567890123456"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ml-client-secret" className="text-xs font-medium">
                    Client Secret {hasCreds && <span className="text-muted-foreground">(deixe em branco para manter)</span>}
                  </Label>
                  <Input
                    id="ml-client-secret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={hasCreds ? "••••••••••••" : "Cole o Client Secret do app"}
                    autoComplete="off"
                  />
                </div>
                <div className="rounded-md border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Credenciais protegidas por RLS
                  </p>
                  <p className="mt-1">
                    Apenas usuários autenticados vinculados a esta empresa podem ler ou alterar estas credenciais.
                  </p>
                  <p className="mt-2 font-medium text-foreground">Redirect URI:</p>
                  <code className="mt-1 block break-all font-mono text-[11px]">
                    {status?.redirectUri ?? "—"}
                  </code>
                  <a
                    href="https://developers.mercadolivre.com.br/devcenter"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Abrir DevCenter <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border/60 bg-background/95 p-6 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSave}
              variant="outline"
              disabled={loading || saving || !clientId.trim() || (!clientSecret.trim() && !hasCreds)}
            >
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Salvar credenciais
            </Button>
            <Button
              onClick={handleAuthorize}
              disabled={loading || authorizing || !hasCreds}
              variant={needsReauth ? "destructive" : "default"}
            >
              {authorizing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : needsReauth ? (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              ) : (
                <ExternalLink className="mr-1.5 h-4 w-4" />
              )}
              {needsReauth ? "Reautorizar conta" : "Autorizar conta"}
            </Button>
          </div>
          <div className="flex gap-2">
            {connected && (
              <Button variant="outline" onClick={() => setPricingSettingsOpen(true)}>
                <Settings2 className="mr-1.5 h-4 w-4" />
                Custos de Venda
              </Button>
            )}
            {connected && (
              <Button variant="ghost" onClick={handleDisconnect} className="text-destructive">
                Desconectar
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <MercadoLivrePricingSettingsDialog 
        open={pricingSettingsOpen} 
        onOpenChange={setPricingSettingsOpen} 
      />
    </Dialog>
  );
}
