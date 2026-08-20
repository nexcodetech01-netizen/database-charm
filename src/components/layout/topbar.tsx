import { Bell, Search, LogOut, User, Menu, Volume2, VolumeX, Smartphone, Settings, ChevronLeft, ChevronRight, CheckCircle, Filter, ExternalLink, History, Trash2, Check } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NotificationSettingsPanel } from "@/components/settings/notification-settings-panel";
import { useNotificationSettings } from "@/hooks/use-notification-settings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useExternalNotificationsRealtime } from "@/features/whatsapp/hooks/use-external-notifications-realtime";
import { useCommercialInboxRealtime } from "@/features/whatsapp/hooks/use-commercial-inbox-realtime";
import { useLogStore } from "@/features/diagnostics/hooks/use-log-store";
import { getUnreadNotifications, markNotificationReadFn, saveNotification } from "@/features/bella-ai/events/persistence.functions";
import { BELLA_EVENT_CATALOG } from "@/features/bella-ai/events/catalog";
import { priorityFromSeverity } from "@/features/bella-ai/events/EventPriority";
import type { BellaEvent } from "@/features/bella-ai/events/BellaEvent";
import { useServerFn } from "@tanstack/react-start";

/** Rota de destino ao clicar num alerta do sino, por módulo do evento. */
function routeForEvent(event: BellaEvent): string {
  switch (event.type) {
    case "catalog.order.received":
    case "whatsapp.message.received":
      return "/comercial/inbox-whatsapp";
    case "inventory.min_stock_reached":
    case "inventory.out_of_stock":
    case "inventory.slow_moving":
      return "/estoque";
    case "finance.invoice.overdue":
    case "finance.cashflow.negative":
    case "finance.receivable.created":
    case "finance.payable.created":
      return "/financeiro";
    default:
      return "/";
  }
}

export function Topbar() {
  const { user, companyId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toggle: toggleMobileNav } = useMobileNav();
  const addLog = useLogStore(state => state.addLog);

  const [catalogOrdersCount, setCatalogOrdersCount] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState<BellaEvent[]>([]);
  const { settings, isLoading: settingsLoading } = useNotificationSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Hooks das Server Functions (CORREÇÃO: essencial para TanStack Start v1)
  const getUnreadFn = useServerFn(getUnreadNotifications);
  const readNotificationFn = useServerFn(markNotificationReadFn);
  const saveNotificationFn = useServerFn(saveNotification);

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

  useExternalNotificationsRealtime(companyId, settings, settingsLoading);
  useCommercialInboxRealtime(companyId);

  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);

  const updateCount = () => {
    const active = bellaEventRegistry.listActive({
      tenantId: companyId || undefined
    });
    const catalogOrders = active.filter(e => e.type === "catalog.order.received");
    setCatalogOrdersCount(catalogOrders.length);
    setActiveAlerts(active.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  };

  const markAlertAsRead = async (alert: BellaEvent) => {
    if (!companyId) return;
    
    bellaEventRegistry.resolveByPayload({
      tenantId: alert.tenantId,
      type: alert.type,
      payload: alert.payload,
    });
    updateCount();

    try {
      const payload = alert.payload as any;
      const refId = payload?.entityId || payload?.ticketId || null;
      addLog('[TOPBAR-NOTIF]', `marcando como lida: type=${alert.type} referenceId=${refId}`);
      
      const result = await readNotificationFn({
        data: {
          companyId,
          eventType: alert.type,
          referenceId: refId,
        }
      });
      addLog('[TOPBAR-NOTIF]', `resultado do servidor: ${JSON.stringify(result)}`);
    } catch (err) {
      console.warn("[Topbar] Falha ao marcar notificação como lida no banco:", err);
      addLog('[TOPBAR-NOTIF]', `ERRO ao marcar como lida: ${err}`);
    }
  };

  const markAllAlertsAsRead = async () => {
    if (!companyId || activeAlerts.length === 0) return;

    const alertsToRead = [...activeAlerts];
    
    alertsToRead.forEach(alert => bellaEventRegistry.resolveByPayload({
      tenantId: alert.tenantId,
      type: alert.type,
      payload: alert.payload,
    }));
    updateCount();

    try {
      await Promise.all(
        alertsToRead.map(alert => {
          const payload = alert.payload as any;
          return readNotificationFn({
            data: {
              companyId,
              eventType: alert.type,
              referenceId: payload?.entityId || payload?.ticketId || null,
            }
          }).catch(e => console.error(e));
        })
      );
    } catch (err) {
      console.warn("[Topbar] Falha ao marcar todas as notificações como lidas:", err);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    bellaEventRegistry.start();

    const hydrateRegistry = async () => {
      if (!companyId) return;

      try {
        const unreadResponse = (await getUnreadFn({
          data: { companyId: companyId }
        })) as any;

        const unread = Array.isArray(unreadResponse) ? unreadResponse : [];

        if (unread && unread.length > 0) {
          addLog('[TOPBAR-NOTIF]', `hydrating registry with ${unread.length} persistent notifications`);

          unread.forEach((notif: any) => {
            const meta = (BELLA_EVENT_CATALOG as any)[notif.event_type];
            if (!meta) return;

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

    updateCount();
    void hydrateRegistry();

    // Listener para o Registry: no navegador, o Topbar cuida da persistência
    const unsubscribe = bellaEventRegistry.subscribe((entry, event) => {
      if (entry.action === "created") {
        // CORREÇÃO: Persiste no banco usando o hook do componente
        const payload = event.payload as any;
        saveNotificationFn({
          data: {
            companyId: event.tenantId,
            eventType: event.type,
            title: event.title,
            message: event.description,
            referenceId: payload?.entityId || payload?.ticketId || null,
            metadata: payload
          }
        }).catch(err => {
          console.warn("[Topbar] Falha na persistência via hook:", err);
        });

        const ticketId = (event.payload as any)?.ticketId;
        updateCount();

        const config = settings[event.type];
        if (!config) return;

        if (ticketId && notifiedIdsRef.current.has(ticketId)) return;
        if (ticketId) notifiedIdsRef.current.add(ticketId);

        if (config.sound && audioRef.current) {
          audioRef.current.play().catch(() => {});
        }

        const title = event.title || "Nova notificação";
        const description = event.description || "";

        toast.success(title, {
          description,
          action: ticketId
            ? { label: "Ver", onClick: () => { markAlertAsRead(event); navigate({ to: "/comercial/inbox-whatsapp" }); } }
            : { label: "Ver", onClick: () => { markAlertAsRead(event); navigate({ to: routeForEvent(event) }); } }
        });

        if (config.browser) {
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

    const channel = getInboxChannel();
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "CATALOG_ORDER_RECEIVED") {
        updateCount();
      } else if (msg.type === "CATALOG_ORDER_RESOLVED") {
        bellaEventRegistry.resolveByPayload({
          tenantId: companyId || "",
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
  }, [companyId, settings, navigate, notify, getUnreadFn, saveNotificationFn]);

  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email || "Você";
  const initials = displayName.split(" ").slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";

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
            <div className="relative">
              <Button variant="ghost" size="icon" title="Alertas Ativos">
                <Bell className={cn("h-4 w-4", activeAlerts.length > 0 && "animate-tada text-primary")} />
                {activeAlerts.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground border-2 border-background animate-in fade-in zoom-in">
                    {activeAlerts.length > 9 ? '9+' : activeAlerts.length}
                  </Badge>
                )}
              </Button>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex flex-col border-b p-3 gap-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Alertas Ativos</h4>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={markAllAlertsAsRead}
                    title="Resolver todos"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Histórico Completo"
                    asChild
                  >
                    <Link to="/">
                      <History className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="max-h-[350px] overflow-y-auto">
              {activeAlerts.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center gap-2">
                  <Check className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Tudo em ordem por aqui.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        "p-3 hover:bg-accent/50 transition-colors group relative cursor-default",
                        alert.severity === 'critical' && "bg-destructive/5"
                      )}
                    >
                      <div className="flex gap-3">
                        <div className={cn(
                          "mt-1 h-2 w-2 rounded-full shrink-0",
                          alert.severity === 'critical' ? "bg-destructive" : 
                          alert.severity === 'warning' ? "bg-warning" : "bg-primary"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-xs font-medium truncate">{alert.title}</p>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {format(alert.createdAt, "HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                            {alert.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-6 px-2 text-[10px] bg-primary/10 hover:bg-primary/20 text-primary border-none"
                              onClick={() => {
                                markAlertAsRead(alert);
                                navigate({ to: routeForEvent(alert) });
                              }}
                            >
                              Ver Detalhes
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                              onClick={() => markAlertAsRead(alert)}
                            >
                              Ignorar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full ml-1">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary border border-primary/20">
                {initials}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>Meu Perfil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowSettings(true)} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl pt-10">
          <DialogHeader className="px-1">
            <DialogTitle>Configurações de Notificação</DialogTitle>
          </DialogHeader>
          <NotificationSettingsPanel />
        </DialogContent>
      </Dialog>
    </header>
  );
}
