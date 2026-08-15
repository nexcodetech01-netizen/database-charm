import { Bell, Search, LogOut, User, Menu, Volume2, VolumeX } from "lucide-react";
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

export function Topbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toggle: toggleMobileNav } = useMobileNav();
  
  const [catalogOrdersCount, setCatalogOrdersCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("nexos:catalog-sound") !== "false";
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Inicia o registry se ainda não estiver (singleton)
    bellaEventRegistry.start();

    const updateCount = () => {
      const active = bellaEventRegistry.listActive({ 
        tenantId: user?.user_metadata?.company_id 
      });
      const catalogOrders = active.filter(e => e.type === "catalog.order.received");
      setCatalogOrdersCount(catalogOrders.length);
    };

    updateCount();

    const unsubscribe = bellaEventRegistry.subscribe((entry, event) => {
      if (entry.action === "created" && event.type === "catalog.order.received") {
        updateCount();
        
        // Notificação sonora
        if (soundEnabled && audioRef.current) {
          audioRef.current.play().catch(() => {
            // Browsers bloqueiam autoplay sem interação
          });
        }

        // Notificação visual Toast
        const payload = event.payload as any;
        toast.success("Novo pedido do catálogo", {
          description: `${payload.buyerName || "Cliente"}: ${formatCurrency(payload.total)}`,
          action: {
            label: "Ver Inbox",
            onClick: () => navigate({ to: "/comercial/inbox-whatsapp" }),
          }
        });
      } else if (entry.action === "resolved" || entry.action === "expired") {
        updateCount();
      }
    });

    return () => unsubscribe();
  }, [user?.user_metadata?.company_id, soundEnabled, navigate]);

  const toggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    localStorage.setItem("nexos:catalog-sound", String(newVal));
  };


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
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSound}
          title={soundEnabled ? "Som ativado" : "Som desativado"}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>

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
    </header>
  );
}
