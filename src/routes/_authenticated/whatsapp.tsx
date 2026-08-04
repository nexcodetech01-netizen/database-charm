import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import {
  CheckCheck,
  MailOpen,
  MessageCircle,
  MessageSquarePlus,
  Send,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { KpiCard, KpiSection, PageHeader } from "@/components/layout";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import {
  AutomationsList,
  ChatPanel,
  CloudApiConfigCard,
  CommunicationTimeline,
  ConversationList,
  CustomerPanel,
  ProvidersGrid,
  TemplatesGrid,
  WHATSAPP_CONVERSATIONS,
  WHATSAPP_TIMELINE,
  type WhatsAppConversation,
} from "@/features/whatsapp";
import { WhatsAppConsole } from "@/features/whatsapp/console";
import { usePermissions } from "@/features/rbac/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  beforeLoad: requirePermission("bella_ia.view"),
  component: WhatsAppPage,
});

function WhatsAppPage() {
  const navigate = useNavigate();
  const conversations = WHATSAPP_CONVERSATIONS;
  const [selectedId, setSelectedId] = useState<string | null>(
    conversations[0]?.id ?? null,
  );
  const perms = usePermissions();
  const companyId = perms.companyId ?? null;

  const [activeTab, setActiveTab] = useState("console");
  const [newConversationOpen, setNewConversationOpen] = useState(false);

  const selected = useMemo<WhatsAppConversation | null>(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const openNewConversation = () => {
    setActiveTab("console");
    setNewConversationOpen(true);
  };

  const openSettings = () => {
    navigate({ to: "/configuracoes", search: { section: "whatsapp" } });
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6">
      <BreadcrumbNav />
      <PageHeader
        icon={MessageCircle}
        title="WhatsApp Business"
        description="Envie pedidos, cobranças, recibos e acompanhe todas as conversas."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={openNewConversation}>
              <MessageSquarePlus className="mr-1.5 h-4 w-4" /> Nova conversa
            </Button>
            <Button size="sm" variant="outline">
              <Sparkles className="mr-1.5 h-4 w-4" /> Nova campanha
            </Button>
            <Button size="sm" variant="outline" onClick={openSettings}>
              <Settings2 className="mr-1.5 h-4 w-4" /> Configurações
            </Button>
          </div>
        }
      />


      <KpiSection columns={5}>
        <KpiCard
          label="Conversas abertas"
          value={conversations.filter((c) => c.status === "open").length}
          icon={MessageCircle}
        />
        <KpiCard 
          label="Atendimento Bella/IA" 
          value={conversations.filter((c) => (c.status as string) === "bella").length} 
          icon={Sparkles} 
        />
        <KpiCard 
          label="Humano" 
          value={conversations.filter((c) => (c.status as string) === "human").length} 
          icon={User} 
        />
        <KpiCard label="Taxa de Resolução" value="95%" icon={CheckCheck} />
        <KpiCard 
          label="Janelas Ativas" 
          value={conversations.filter((c) => (c.lastMessageAt ? (Date.now() - new Date(c.lastMessageAt).getTime()) <= 24 * 60 * 60 * 1000 : false)).length} 
          icon={Timer} 
        />
      </KpiSection>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="console">Console</TabsTrigger>
          <TabsTrigger value="inbox">Caixa de entrada</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="templates">Modelos</TabsTrigger>
          <TabsTrigger value="automations">Automações</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
        </TabsList>

        <TabsContent value="console" className="mt-0">
          <WhatsAppConsole
            companyId={companyId}
            newConversationOpen={newConversationOpen}
            onNewConversationOpenChange={setNewConversationOpen}
          />
        </TabsContent>



        <TabsContent value="inbox" className="mt-0">
          <Card className="overflow-hidden">
            <div className="grid h-[calc(100vh-320px)] min-h-[560px] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
              <ConversationList
                conversations={conversations}
                selectedId={selectedId}
                onSelect={(c) => setSelectedId(c.id)}
              />
              <ChatPanel conversation={selected} />
              <div className="hidden lg:block">
                <CustomerPanel conversation={selected} />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-0 space-y-3">
          <SectionHeader
            title="Timeline de comunicação"
            description="Toda mensagem enviada pelo NexOS — cliente, CRM, venda, financeiro — em ordem cronológica."
          />
          <CommunicationTimeline events={WHATSAPP_TIMELINE} />
        </TabsContent>

        <TabsContent value="templates" className="mt-0 space-y-3">
          <SectionHeader
            title="Modelos de mensagem"
            description="Boas-vindas, pedido, orçamento, cobrança, pós-venda, lembrete e aniversário."
          />
          <TemplatesGrid />
        </TabsContent>

        <TabsContent value="automations" className="mt-0 space-y-3">
          <SectionHeader
            title="Automações"
            description="Gatilhos e ações preparados para disparo automático após eventos do NexOS."
          />
          <AutomationsList />
        </TabsContent>

        <TabsContent value="integrations" className="mt-0 space-y-4">
          <SectionHeader
            title="Integrações"
            description="Conexão oficial com a WhatsApp Business Cloud API (Meta) e provedores alternativos."
          />
          <CloudApiConfigCard />
          <ProvidersGrid />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
