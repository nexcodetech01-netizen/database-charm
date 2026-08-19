import { Bell, Search, LogOut, User, Menu, Volume2, VolumeX, Smartphone, Settings, ChevronLeft, ChevronRight, CheckCircle, Filter } from "lucide-react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/providers/auth-provider";
import { authService } from "@/features/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useMobileNav } from "./mobile-nav-context";
import { useEffect, useState, useRef } from "react";
import { bellaEventRegistry } from "@/features/bella-ai/events/BellaEventRegistry";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { getInboxChannel, broadcastInboxEvent } from "@/features/whatsapp/lib/inbox-sync";
import { useBrowserNotifications } from "@/features/whatsapp/hooks/use-inbox-notifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, Trash2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NotificationSettingsPanel } from "@/components/settings/notification-settings-panel";
import { useNotificationSettings } from "@/hooks/use-notification-settings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useExternalNotificationsRealtime } from "@/features/whatsapp/hooks/use-external-notifications-realtime";
import { useCommercialInboxRealtime } from "@/features/whatsapp/hooks/use-commercial-inbox-realtime";
import { useLogStore } from "@/features/diagnostics/hooks/use-log-store";
import { getUnreadNotifications } from "@/features/bella-ai/events/persistence.functions";
import { BELLA_EVENT_CATALOG } from "@/features/bella-ai/events/catalog";
import { priorityFromSeverity } from "@/features/bella-ai/events/EventPriority";




export function Topbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toggle: toggleMobileNav } = useMobileNav();
  const addLog = useLogStore(state => state.addLog);
  
  const [catalogOrdersCount, setCatalogOrdersCount] = useState(0);
  const { settings, isLoading: settingsLoading } = useNotificationSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { 
    permission, 
    requestPermission, 
    notify, 
    history: notificationHistory, 
    clearHistory,
    markAsRead,
    markAllAsRead,
    filterType,
    setFilterType,
    filterRead,
    setFilterRead,
    page,
    setPage,
    totalPages,
    filteredCount
  } = useBrowserNotifications();
  
  // Ativa listeners de tempo real para notificações externas e internas
  useExternalNotificationsRealtime(user?.user_metadata?.company_id, settings, settingsLoading);
  useCommercialInboxRealtime(user?.user_metadata?.company_id);

  const notifiedIdsRef = useRef<Set<string>>(new Set());

  const [showSettings, setShowSettings] = useState(false);


  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Inicia o registry se ainda não estiver (singleton)
    bellaEventRegistry.start();

    // Fase 1: Hidratação do Registry com notificações persistentes não lidas
    const hydrateRegistry = async () => {
      if (!user?.user_metadata?.company_id) return;
      
      try {
        const unread = await getUnreadNotifications({ 
          companyId: user.user_metadata.company_id 
        });
        
        if (unread && unread.length > 0) {
          addLog('[TOPBAR-NOTIF]', `hydrating registry with ${unread.length} persistent notifications`);
          
          unread.forEach(notif => {
            const meta = BELLA_EVENT_CATALOG[notif.event_type as any];
            if (!meta) return;

            // Emite para o engine silenciosamente (evitando loops infinitos se possível, 
            // mas o registry já dedupa por key estável)
            // Usamos as informações da tabela.
            const severity = (notif.metadata as any)?.severity || meta.defaultSeverity;
            
            bellaEventRegistry.upsert({
              id: notif.id,
              tenantId: notif.company_id,
              type: notif.event_type as any,
              module: meta.module,
              severity: severity,
              priority: priorityFromSeverity(severity),
              title: notif.title,
              description: notif.message,
              payload: notif.metadata || {},
              createdAt: new Date(notif.created_at),
              source: "persistence:hydration"
            });
          });
          
          updateCount();
        }
      } catch (err) {
        console.warn("[Topbar] Erro na hidratação de notificações:", err);
      }
    };

    const updateCount = () => {

      const active = bellaEventRegistry.listActive({ 
        tenantId: user?.user_metadata?.company_id 
      });
      const catalogOrders = active.filter(e => e.type === "catalog.order.received");
      setCatalogOrdersCount(catalogOrders.length);
    };

    updateCount();
    void hydrateRegistry();


    const unsubscribe = bellaEventRegistry.subscribe((entry, event) => {
      if (entry.action === "created") {
        const ticketId = (event.payload as any)?.ticketId;
        if (ticketId === "10") {
          addLog('[TOPBAR-NOTIF]', `received catalog.order.received n8n-10`);
        }
        
        updateCount();
        
        const config = settings[event.type];
        if (ticketId === "10") {
          addLog('[TOPBAR-NOTIF]', `config exists: ${!!config}`);
          if (config) {
            addLog('[TOPBAR-NOTIF]', `sound: ${config.sound}`);
            addLog('[TOPBAR-NOTIF]', `browser: ${config.browser}`);
          }
        }
        if (!config) return;

        if (ticketId === "10") {
          addLog('[TOPBAR-NOTIF]', `duplicate check n8n-10`);
        }
        if (ticketId && notifiedIdsRef.current.has(ticketId)) {
          if (ticketId === "10") {
            addLog('[TOPBAR-NOTIF]', `discarded duplicate n8n-10`);
          }
          return;
        }
        if (ticketId) notifiedIdsRef.current.add(ticketId);

        if (ticketId === "10") {
          addLog('[TOPBAR-NOTIF]', `showing notification n8n-10`);
        }

        // Notificação sonora
        if (config.sound && audioRef.current) {
          if (ticketId === "10") {
            addLog('[TOPBAR-NOTIF]', `playing sound n8n-10`);
          }
          audioRef.current.play().catch(() => {
            // Browsers bloqueiam autoplay sem interação
          });
        }

        const payload = event.payload as any;
        const title = event.title || "Nova notificação";
        const description = event.description || "";

        // Notificação visual Toast (sempre mostramos se estiver na aba ativa)
        toast.success(title, {
          description,
          action: ticketId
            ? { label: "Ver", onClick: () => navigate({ to: "/comercial/inbox-whatsapp" }) }
            : event.type === "whatsapp.message.received"
              ? { label: "Ver", onClick: () => navigate({ to: "/whatsapp" }) }
              : undefined
        });

        // Notificação do Navegador (respeita preferência)
        if (config.browser) {
          if (ticketId === "10") {
            addLog('[TOPBAR-NOTIF]', `browser notification n8n-10`);
          }
          notify(title, {
            body: description,
            tag: ticketId || undefined,
            type: event.type
          } as any);
        }
      } else if (entry.action === "resolved" || entry.action === "expired") {

        updateCount();
      }
    });

    // Listener para BroadcastChannel (Sincronização entre abas)
    const channel = getInboxChannel();
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "CATALOG_ORDER_RECEIVED") {
        updateCount();
      } else if (msg.type === "CATALOG_ORDER_RESOLVED") {
        // Quando resolvido em outra aba, removemos do registry local se existir
        bellaEventRegistry.resolveByPayload({
          tenantId: user?.user_metadata?.company_id,
          type: "catalog.order.received",
          payload: { entityId: msg.payload.ticketId }
        });
        updateCount();
      } else if (msg.type === "SYNC_COUNT") {
        setCatalogOrdersCount(msg.payload.count);
      }
    };

    channel?.addEventListener("message", handleMessage);

    return () => {
      unsubscribe();
      channel?.removeEventListener("message", handleMessage);
    };
  }, [user?.user_metadata?.company_id, settings, navigate, notify]);



  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    "Você";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "U";

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await authService.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header
      className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
        height: "calc(4rem + env(safe-area-inset-top))",
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden relative z-10 shrink-0"
        onClick={toggleMobileNav}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="relative min-w-0 flex-1 max-w-md">

        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Buscar no NexOS..."
          className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-16 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <audio ref={audioRef} src="/notification-alert.mp3" preload="auto" />
        
        <div className="flex items-center gap-1 border-r border-border pr-2 mr-1">
          {permission !== "granted" && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => requestPermission()}
              title="Ativar notificações do navegador"
              className="text-warning animate-pulse"
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowSettings(true)}
            title="Configurações de Notificação"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>


        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" title="Histórico de Alertas">
              <History className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex flex-col border-b p-3 gap-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Alertas Recentes</h4>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8" 
                    onClick={markAllAsRead}
                    title="Marcar todos como lidos"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                  </Button>
                  {notificationHistory.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={clearHistory}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="Limpar Histórico"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-7 text-[10px] py-0 px-2">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Tipos</SelectItem>
                    <SelectItem value="catalog.order.received">Catálogo</SelectItem>
                    <SelectItem value="whatsapp.message.received">Mensagens WhatsApp</SelectItem>
                    <SelectItem value="sale.created">Vendas</SelectItem>
                    <SelectItem value="finance.invoice.overdue">Financeiro</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={String(filterRead)} onValueChange={(v) => setFilterRead(v === "all" ? "all" : v === "true")}>
                  <SelectTrigger className="h-7 text-[10px] py-0 px-2">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="false">Não Lidos</SelectItem>
                    <SelectItem value="true">Lidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="max-h-[350px] overflow-y-auto">
              {notificationHistory.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center gap-2">
                  <Bell className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Nenhum alerta encontrado.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notificationHistory.map((item) => (
                    <div 
                      key={item.id} 
                      className={cn(
                        "p-3 hover:bg-accent/50 transition-colors group relative cursor-default",
                        !item.read && "bg-primary/5 border-l-2 border-l-primary"
                      )}
                      onMouseEnter={() => !item.read && markAsRead(item.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{item.title}</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-2">{item.body}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-muted-foreground">
                              {format(item.at, "HH:mm", { locale: ptBR })}
                            </span>
                            {item.type && (
                              <span className="text-[8px] bg-muted px-1 rounded text-muted-foreground uppercase tracking-wider">
                                {item.type.split('.')[0]}
                              </span>
                            )}
                          </div>
                        </div>
                        {item.ticketId && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                            onClick={() => navigate({ to: "/comercial/inbox-whatsapp" })}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t p-2 bg-muted/20">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-[10px] text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </PopoverContent>

        </Popover>

        <ThemeToggle />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
              <Bell className="h-4 w-4" />
              {catalogOrdersCount > 0 && (
                <Badge 
                  className="absolute -right-1 -top-1 h-4 min-w-4 flex items-center justify-center rounded-full px-1 text-[10px]"
                  variant="destructive"
                >
                  {catalogOrdersCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {catalogOrdersCount > 0 ? (
              <DropdownMenuItem asChild>
                <Link to="/comercial/inbox-whatsapp" className="flex flex-col items-start gap-1 p-3">
                  <span className="font-semibold text-sm">Pedidos Pendentes</span>
                  <span className="text-xs text-muted-foreground">
                    Você tem {catalogOrdersCount} novo(s) pedido(s) no catálogo.
                  </span>
                  <span className="text-xs text-primary font-medium mt-1">Ver Inbox Comercial →</span>
                </Link>
              </DropdownMenuItem>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhuma notificação nova.
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-accent">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </div>
              <span className="hidden text-sm font-medium sm:inline">{displayName.split(" ")[0]}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4" />
              Meu perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurações do Usuário</DialogTitle>
          </DialogHeader>
          <NotificationSettingsPanel />
        </DialogContent>
      </Dialog>
    </header>

  );
}
