import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle, ExternalLink, Save, Lock, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CloudApiConfigCard } from "@/features/whatsapp";
import { validateWhatsAppConnection } from "@/lib/whatsapp.functions";
import {
  getCompanyWhatsAppConfig,
  setCompanyWhatsAppPhoneNumberId,
} from "@/features/settings/lib/whatsapp-config.functions";

const PREFS_KEY = "nexos.whatsapp.preferences";

interface WhatsappPrefs {
  signature: string;
  autoSend: boolean;
}

const DEFAULT_PREFS: WhatsappPrefs = {
  signature: "— Equipe NexOS",
  autoSend: true,
};

function loadPrefs(): WhatsappPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<WhatsappPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function WhatsappSection() {
  const [signature, setSignature] = useState(DEFAULT_PREFS.signature);
  const [autoSend, setAutoSend] = useState(DEFAULT_PREFS.autoSend);

  useEffect(() => {
    const prefs = loadPrefs();
    setSignature(prefs.signature);
    setAutoSend(prefs.autoSend);
  }, []);

  const validate = useServerFn(validateWhatsAppConnection);
  const { data: connection, isLoading } = useQuery({
    queryKey: ["whatsapp", "connection-status"],
    queryFn: () => validate(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const isConnected = connection?.connected === true;
  const phoneDisplay = connection?.phoneNumber ?? "";

  const handleSave = () => {
    try {
      window.localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ signature, autoSend }),
      );
      toast.success("Preferências de WhatsApp salvas");
    } catch {
      toast.error("Não foi possível salvar as preferências");
    }
  };

  return (
    <div className="space-y-4">
      <CloudApiConfigCard />

      <CompanyPhoneNumberIdCard />


      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">WhatsApp</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Envie cobranças, comprovantes e campanhas direto do sistema.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              isConnected
                ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                : "border-amber-500/40 text-amber-600 dark:text-amber-400"
            }
          >
            {isLoading ? "Verificando..." : isConnected ? "Conectado" : "Desconectado"}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 pt-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Número do WhatsApp
              <Lock className="h-3 w-3" />
            </Label>
            <Input
              value={phoneDisplay}
              readOnly
              disabled
              placeholder={isLoading ? "Carregando..." : "Não configurado"}
            />
            <p className="text-[11px] text-muted-foreground">
              Gerenciado pela Cloud API acima (secret <code>WHATSAPP_PHONE_NUMBER_ID</code>).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <div className="flex h-10 items-center rounded-md border bg-muted/20 px-3 text-sm">
              <span
                className={`mr-2 h-2 w-2 rounded-full ${
                  isConnected ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {isConnected
                ? connection?.verifiedName || "Sessão ativa"
                : "Sessão inativa"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Templates de mensagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <TemplateRow name="Cobrança criada" body="Olá {{cliente}}, sua fatura de {{valor}} venc..." />
          <TemplateRow name="Pagamento confirmado" body="Recebemos seu pagamento! Obrigado por comprar..." />
          <TemplateRow name="Cobrança vencida" body="{{cliente}}, notamos que a fatura de {{valor}} v..." />
          <TemplateRow name="Pós-venda" body="Como foi sua experiência com {{produto}}?" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Assinatura padrão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={2}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Texto adicionado ao final de todas as mensagens."
          />
          <div className="flex items-center justify-between rounded-md border bg-muted/20 p-3">
            <div>
              <p className="text-sm font-medium">Envio automático em cobranças</p>
              <p className="text-xs text-muted-foreground">
                Dispara mensagem ao criar, pagar ou vencer uma cobrança.
              </p>
            </div>
            <Switch checked={autoSend} onCheckedChange={setAutoSend} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/whatsapp">
            Abrir WhatsApp <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button size="sm" onClick={handleSave}>
          <Save className="mr-1.5 h-3.5 w-3.5" /> Salvar
        </Button>
      </div>
    </div>
  );
}

function TemplateRow({ name, body }: { name: string; body: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/10 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{body}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => toast.info(`Editar template "${name}"`)}
      >
        Editar
      </Button>
    </div>
  );
}

function CompanyPhoneNumberIdCard() {
  const qc = useQueryClient();
  const getCfg = useServerFn(getCompanyWhatsAppConfig);
  const setCfg = useServerFn(setCompanyWhatsAppPhoneNumberId);

  const cfgQ = useQuery({
    queryKey: ["settings", "whatsapp", "company-phone-id"],
    queryFn: () => getCfg(),
    staleTime: 30_000,
  });

  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (cfgQ.data) {
      setValue(cfgQ.data.whatsappPhoneNumberId ?? "");
      setDirty(false);
    }
  }, [cfgQ.data]);

  const save = useMutation({
    mutationFn: async () =>
      setCfg({ data: { phoneNumberId: value.trim() ? value.trim() : null } }),
    onSuccess: () => {
      toast.success("Phone Number ID atualizado");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["settings", "whatsapp", "company-phone-id"] });
      qc.invalidateQueries({ queryKey: ["whatsapp", "connection-status"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha ao salvar"),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-sm">Phone Number ID por empresa</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Vincula esta empresa ao número da Cloud API que recebe os
              webhooks. Cada Phone Number ID pode pertencer a apenas uma
              empresa.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            WhatsApp Phone Number ID
          </Label>
          <Input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setDirty(true);
            }}
            placeholder="Ex.: 1306844229170757"
            inputMode="numeric"
            disabled={cfgQ.isLoading}
          />
          <p className="text-[11px] text-muted-foreground">
            Consulte no Meta Business Manager em WhatsApp → API Setup.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending || cfgQ.isLoading}
        >
          {save.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

