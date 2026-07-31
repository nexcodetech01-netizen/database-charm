import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Facebook,
  Instagram,
  Layers,
  Plug,
  RefreshCcw,
  Send,
  Settings2,
  ShoppingBag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BellaInlineSuggestion } from "@/features/bella-ai/components/bella-inline-suggestion";
import {
  MetaIntegrationProvider,
  useMetaIntegration,
} from "./meta-integration-provider";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function MetaWorkspace() {
  return (
    <MetaIntegrationProvider>
      <MetaWorkspaceInner />
    </MetaIntegrationProvider>
  );
}

function MetaWorkspaceInner() {
  const { state, connect, disconnect, refreshStatus, connecting } = useMetaIntegration();
  const [tab, setTab] = useState("geral");

  const handleConnect = () => {
    connect();
    toast.info("Abrindo consentimento Meta…", {
      description: "Você será redirecionado para autorizar o NexOS.",
    });
  };
  const handleDisconnect = () => {
    disconnect();
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 h-7 px-2 text-xs text-muted-foreground"
          >
            <Link to="/configuracoes">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Configurações
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <MetaMark />
            Meta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Facebook, Instagram e Commerce Manager em uma única integração.
          </p>
        </div>
        {state.connected ? (
          <Button size="sm" variant="outline" onClick={handleDisconnect}>
            <Settings2 className="mr-1.5 h-4 w-4" /> Gerenciar conexão
          </Button>
        ) : (
          <Button size="sm" onClick={handleConnect} disabled={connecting}>
            <Plug className="mr-1.5 h-4 w-4" /> {connecting ? "Conectando…" : "Conectar Meta"}
          </Button>
        )}
      </div>

      {/* Bella */}
      <MetaBella onConnect={handleConnect} onGoCatalog={() => setTab("catalogo")} />

      {/* Overview card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-sm">Visão geral</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Status atual da sua integração Meta.
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              state.connected
                ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                : "border-muted-foreground/30 text-muted-foreground"
            }
          >
            {state.connected ? "🟢 Conectado" : "🔴 Não conectado"}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Empresa Meta" value={state.businessManager ?? "—"} />
          <InfoRow label="Business Manager ID" value={state.metaBusinessId ?? "—"} />
          <InfoRow
            label="Facebook"
            value={state.facebook.pageName ?? "—"}
          />
          <InfoRow
            label="Instagram"
            value={state.instagram.username ? `@${state.instagram.username}` : "—"}
          />
          <InfoRow
            label="Commerce Manager"
            value={state.catalog.connected ? "Ativo" : "Inativo"}
          />
          <InfoRow
            label="Catálogo"
            value={
              state.catalog.connected
                ? `${state.catalog.productsSynced}/${state.catalog.productsTotal} sincronizados`
                : "—"
            }
          />
          <InfoRow
            label="Última sincronização"
            value={formatDate(state.lastSyncAt)}
          />
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full flex-wrap justify-start">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="facebook">Facebook</TabsTrigger>
          <TabsTrigger value="instagram">Instagram</TabsTrigger>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="publicacoes">Publicações</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-3">
          <GeralTab onRefresh={() => {
            refreshStatus();
            toast.success("Status atualizado");
          }} />
        </TabsContent>
        <TabsContent value="facebook" className="mt-3">
          <FacebookTab />
        </TabsContent>
        <TabsContent value="instagram" className="mt-3">
          <InstagramTab />
        </TabsContent>
        <TabsContent value="catalogo" className="mt-3">
          <CatalogoTab />
        </TabsContent>
        <TabsContent value="publicacoes" className="mt-3">
          <PublicacoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Bella ---------------- */

function MetaBella({
  onConnect,
  onGoCatalog,
}: {
  onConnect: () => void;
  onGoCatalog: () => void;
}) {
  const { state } = useMetaIntegration();
  if (!state.connected) {
    return (
      <BellaInlineSuggestion
        title="Meta desconectada"
        message="Conecte sua conta Meta para publicar no Facebook e Instagram e sincronizar o catálogo."
        action={{ label: "Conectar Meta", onClick: onConnect }}
        tone="warning"
      />
    );
  }
  if (state.catalog.productsFailed > 0) {
    return (
      <BellaInlineSuggestion
        title={`${state.catalog.productsFailed} falha(s) na sincronização`}
        message="Revise os produtos que não subiram para o Commerce Manager."
        action={{ label: "Ver detalhes", onClick: onGoCatalog }}
        tone="warning"
      />
    );
  }
  if (state.catalog.productsPending > 0) {
    return (
      <BellaInlineSuggestion
        title={`${state.catalog.productsPending} produto(s) aguardando sincronização`}
        message="Envie agora para manter o catálogo Meta atualizado."
        action={{ label: "Sincronizar", onClick: onGoCatalog }}
        tone="info"
      />
    );
  }
  if (!state.instagram.shoppingActive) {
    return (
      <BellaInlineSuggestion
        title="Ative o Instagram Shopping"
        message="Após a aprovação da Meta, ative o Shopping para marcar produtos nas publicações."
        contextPrompt="Como ativar o Instagram Shopping na minha conta?"
        tone="info"
      />
    );
  }
  return (
    <BellaInlineSuggestion
      title="Tudo em dia"
      message="Sua integração Meta está conectada e o catálogo sincronizado."
      tone="info"
    />
  );
}

/* ---------------- Geral ---------------- */

function GeralTab({ onRefresh }: { onRefresh: () => void }) {
  const { state } = useMetaIntegration();
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm">Conexão Meta</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Contas vinculadas e permissões concedidas.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh}>
          <RefreshCcw className="mr-1.5 h-4 w-4" /> Atualizar status
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Business Manager" value={state.businessManager ?? "—"} />
          <InfoRow label="Business ID" value={state.metaBusinessId ?? "—"} />
          <InfoRow
            label="Página Facebook"
            value={state.facebook.pageName ?? "—"}
          />
          <InfoRow
            label="Instagram"
            value={
              state.instagram.username ? `@${state.instagram.username}` : "—"
            }
          />
          <InfoRow
            label="Última sincronização"
            value={formatDate(state.lastSyncAt)}
          />
        </div>

        <Separator />

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Permissões concedidas
          </p>
          {state.permissions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma permissão. Conecte-se à Meta para autorizar o NexOS.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {state.permissions.map((p) => (
                <Badge key={p} variant="secondary" className="font-mono text-[10px]">
                  {p}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Facebook ---------------- */

function FacebookTab() {
  const { state, updateFacebook } = useMetaIntegration();
  const fb = state.facebook;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Facebook className="h-4 w-4 text-primary" /> Página & Loja
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Configuração da sua presença no Facebook.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Página conectada" value={fb.pageName ?? "—"} />
          <InfoRow
            label="Loja no Facebook"
            value={fb.shopEnabled ? "Ativa" : "Inativa"}
          />
          <InfoRow
            label="Catálogo vinculado"
            value={state.catalog.connected ? "Sim" : "Não"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Automação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ToggleRow
            id="fb-auto"
            label="Publicação automática de novos produtos"
            checked={fb.autoPublish}
            onChange={(v) => updateFacebook({ autoPublish: v })}
          />
          <ToggleRow
            id="fb-stock"
            label="Atualizar estoque automaticamente"
            checked={fb.syncStock}
            onChange={(v) => updateFacebook({ syncStock: v })}
          />
          <ToggleRow
            id="fb-price"
            label="Atualizar preço automaticamente"
            checked={fb.syncPrice}
            onChange={(v) => updateFacebook({ syncPrice: v })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Instagram ---------------- */

function InstagramTab() {
  const { state, updateInstagram } = useMetaIntegration();
  const ig = state.instagram;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Instagram className="h-4 w-4 text-primary" /> Conta & Shopping
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <InfoRow
            label="Business Account"
            value={ig.businessAccount ? "Sim" : "Não"}
          />
          <InfoRow
            label="Instagram Shopping"
            value={ig.shoppingActive ? "Ativo" : "Inativo"}
          />
          <InfoRow
            label="Conta"
            value={ig.username ? `@${ig.username}` : "—"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Automação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ToggleRow
            id="ig-auto"
            label="Publicação automática de novos produtos"
            checked={ig.autoPublish}
            onChange={(v) => updateInstagram({ autoPublish: v })}
          />
          <ToggleRow
            id="ig-price"
            label="Atualizar preço automaticamente"
            checked={ig.syncPrice}
            onChange={(v) => updateInstagram({ syncPrice: v })}
          />
          <ToggleRow
            id="ig-stock"
            label="Atualizar estoque automaticamente"
            checked={ig.syncStock}
            onChange={(v) => updateInstagram({ syncStock: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Padrões de publicação</CardTitle>
          <p className="text-xs text-muted-foreground">
            Usados pela Central de Vendas ao gerar posts.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ig-caption" className="text-xs font-medium text-muted-foreground">
              Legenda padrão
            </Label>
            <Textarea
              id="ig-caption"
              rows={3}
              value={ig.captionTemplate}
              onChange={(e) => updateInstagram({ captionTemplate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ig-hashtags" className="text-xs font-medium text-muted-foreground">
              Hashtags padrão
            </Label>
            <Textarea
              id="ig-hashtags"
              rows={2}
              value={ig.hashtags}
              onChange={(e) => updateInstagram({ hashtags: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ig-cta" className="text-xs font-medium text-muted-foreground">
              CTA padrão
            </Label>
            <Textarea
              id="ig-cta"
              rows={2}
              value={ig.cta}
              onChange={(e) => updateInstagram({ cta: e.target.value })}
            />
          </div>
          <Separator />
          <div className="flex items-start gap-3 rounded-md border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <ShoppingBag className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Ao gerar conteúdo pela{" "}
              <strong className="font-medium text-foreground">Central de Vendas</strong>,
              a aba Instagram usa estes padrões e permite publicar ou copiar a legenda.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Catálogo ---------------- */

function CatalogoTab() {
  const { state, syncCatalogNow } = useMetaIntegration();
  const c = state.catalog;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-primary" /> Commerce Manager
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sincronização de produtos com o catálogo Meta.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            syncCatalogNow();
            toast.success("Sincronização iniciada");
          }}
          disabled={!state.connected}
        >
          <RefreshCcw className="mr-1.5 h-4 w-4" /> Sincronizar agora
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Produtos" value={c.productsTotal} />
        <Metric label="Sincronizados" value={c.productsSynced} tone="success" />
        <Metric label="Pendentes" value={c.productsPending} tone="warning" />
        <Metric label="Falhas" value={c.productsFailed} tone="danger" />
        <div className="sm:col-span-2 lg:col-span-4">
          <InfoRow
            label="Última sincronização"
            value={formatDate(state.lastSyncAt)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Publicações ---------------- */

function PublicacoesTab() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Send className="h-4 w-4 text-primary" /> Histórico de publicações
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Registro das publicações feitas para Facebook e Instagram.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Mensagem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-xs text-muted-foreground"
              >
                Nenhuma publicação ainda. Quando você publicar pela Central de Vendas,
                o histórico aparecerá aqui.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------- Building blocks ---------------- */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "danger"
          ? "text-red-600 dark:text-red-400"
          : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

function MetaMark() {
  // Ícone composto Facebook + Instagram para representar a Meta.
  return (
    <span className="relative inline-flex h-6 w-9 items-center">
      <Facebook className="absolute left-0 h-5 w-5 text-primary" />
      <Instagram className="absolute right-0 h-5 w-5 text-primary" />
    </span>
  );
}
