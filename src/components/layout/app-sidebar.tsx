import { useEffect, useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Truck,
  Users,
  Receipt,
  Wallet,
  Megaphone,
  BarChart3,
  Settings,
  Sparkles,
  Sparkle,
  BookOpen,
  MessageCircle,
  Calculator,
  FileCheck,
  HeartPulse,
  Activity,
  MonitorSmartphone,
  Zap,

} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/features/rbac";
import { ROUTES } from "@/config/routes";
import { useBellaCriticalCount } from "@/features/accounting-ai/proactive";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NexosLogo } from "@/components/brand/nexos-logo";
import { useMobileNav } from "./mobile-nav-context";


type ModuleStatus = "available" | "in_progress" | "coming_soon";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  status: ModuleStatus;
  /** Permission code (view) required to see this item. Omit for always-visible. */
  permission?: string;
  /** Submenu visual (UX apenas) — herda a rota própria de cada filho. */
  children?: NavItem[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    label: "Operacional",
    items: [
      { title: "Dashboard", url: ROUTES.dashboard, icon: LayoutDashboard, status: "available", permission: "dashboard.view" },
      { title: "Vendas", url: ROUTES.sales, icon: Receipt, status: "available", permission: "sales.view" },
      { title: "Clientes", url: ROUTES.customers, icon: Users, status: "available", permission: "customers.view" },
      { title: "Produtos", url: ROUTES.products, icon: Package, status: "available", permission: "products.view" },
      { title: "Estoque", url: ROUTES.inventory, icon: Boxes, status: "available", permission: "inventory.view" },
      { title: "Compras", url: ROUTES.purchases, icon: ShoppingCart, status: "available", permission: "purchases.view" },
      { title: "Fornecedores", url: ROUTES.suppliers, icon: Truck, status: "available", permission: "suppliers.view" },
    ],
  },


  {
    label: "Financeiro & Fiscal",
    items: [
      { title: "Financeiro", url: ROUTES.finance, icon: Wallet, status: "available", permission: "finance.view" },
      { title: "Fiscal", url: ROUTES.fiscal, icon: FileCheck, status: "available", permission: "fiscal.view" },
      { title: "Saúde Fiscal", url: ROUTES.fiscalHealth, icon: HeartPulse, status: "available", permission: "fiscal.view" },
      { title: "Recalcular Preços", url: ROUTES.commercialRecalculate, icon: Calculator, status: "available", permission: "products.view" },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { title: "WhatsApp", url: ROUTES.whatsapp, icon: MessageCircle, status: "available" },
      { title: "Bella IA", url: ROUTES.bella, icon: Sparkles, status: "available", permission: "bella_ia.view" },
      { title: "Bella Contadora", url: ROUTES.bellaAccountant, icon: Calculator, status: "available", permission: "reports.view" },
      { title: "Conhecimento Bella", url: ROUTES.bellaKnowledge, icon: BookOpen, status: "available", permission: "bella_ia.view" },
      { title: "Marketing", url: ROUTES.marketing, icon: Megaphone, status: "available", permission: "marketing.view" },
    ],
  },
  {
    label: "Sistema & Gestão",
    items: [
      { title: "Relatórios", url: ROUTES.reports, icon: BarChart3, status: "available", permission: "reports.view" },
      { title: "Saúde da Plataforma", url: ROUTES.platformHealth, icon: Activity, status: "available", permission: "settings.view" },
      { title: "Configurações", url: ROUTES.settings, icon: Settings, status: "available", permission: "settings.view" },
    ],
  },
];


export function AppSidebar() {
  const router = useRouter();
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const { has, isLoading: permsLoading } = usePermissions();
  const { open: mobileOpen, setOpen: setMobileOpen } = useMobileNav();
  /** Indicador visual (sessão) de notificações críticas da Bella Contadora. */
  const bellaCritical = useBellaCriticalCount();

  const handleComingSoon = (title: string) => setComingSoon(title);

  // NOTA (paridade mobile/desktop): `visibleGroups` é calculado UMA VEZ e
  // usado tanto no `<aside>` (desktop) quanto no `<Sheet>` (mobile drawer).
  // Portanto, os itens visíveis são sempre idênticos — a única diferença é
  // o container. Se um item aparecer no desktop e não no mobile (ou vice-versa),
  // a causa NÃO está aqui; investigue montagem do provider ou breakpoints.
  const canSee = (item: NavItem) => {
    if (permsLoading) return true;
    if (!item.permission) return true;
    return has(item.permission);
  };

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter(canSee).map((item) =>
        item.children
          ? { ...item, children: item.children.filter(canSee) }
          : item,
      ),
    }))
    .filter((g) => g.items.length > 0);


  // Auto-fecha drawer mobile em QUALQUER transição de rota (inclusive quando
  // o pathname é o mesmo — clique no item já ativo, mudança apenas de search
  // params, ou redirecionamentos). Usa router.subscribe para garantir que
  // nunca fique preso em estado aberto.
  useEffect(() => {
    const unsub = router.subscribe("onResolved", () => setMobileOpen(false));
    return () => unsub();
  }, [router, setMobileOpen]);

  // Fallback defensivo: se o caminho mudar sem passar pelo evento acima
  // (ex.: hidratação inicial em rota diferente), garante fechamento.
  useEffect(() => {
    setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  const brand = (
    <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border/70">
      <NexosLogo size={36} />
      <div className="flex flex-col leading-tight">
        <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
          NexOS
        </span>
        <span className="text-[11px] font-medium text-muted-foreground/80">
          Workspace
        </span>
      </div>
    </div>
  );

  const canSeePdv = permsLoading || has("sales.view");
  const pdvActive = currentPath === ROUTES.pdv;

  const pdvQuickAccess = canSeePdv ? (
    <div className="px-3 pt-3">
      <Link
        to={ROUTES.pdv}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200",
          pdvActive
            ? "bg-primary text-primary-foreground shadow-md"
            : "bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/15 hover:shadow-sm",
        )}
      >
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
            pdvActive ? "bg-primary-foreground/15" : "bg-primary/15",
          )}
        >
          <MonitorSmartphone className="h-[18px] w-[18px]" strokeWidth={2.1} />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13.5px] font-semibold">PDV</span>
          <span
            className={cn(
              "truncate text-[11px] font-medium",
              pdvActive ? "text-primary-foreground/75" : "text-primary/70",
            )}
          >
            Frente de caixa
          </span>
        </span>
        <Zap
          className={cn(
            "ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
            pdvActive ? "text-primary-foreground/80" : "text-primary/70",
          )}
          strokeWidth={2.2}
        />
      </Link>
    </div>
  ) : null;


  const navList = (
    <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
      {visibleGroups.map((group, i) => (
        <div key={group.label} className={i > 0 ? "mt-3.5 border-t border-sidebar-border/50 pt-3.5" : ""}>
          <div className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
            {group.label}
          </div>

          <ul className="space-y-0.5">
            {group.items.map((item) =>
              item.children?.length ? (
                <li key={item.title}>
                  <div className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13.5px] font-semibold text-sidebar-foreground/80">
                    <item.icon
                      className="h-[17px] w-[17px] shrink-0 text-muted-foreground/80"
                      strokeWidth={2}
                    />
                    <span className="flex-1 truncate">{item.title}</span>
                  </div>
                  <ul className="ml-[26px] mt-0.5 space-y-0.5 border-l border-sidebar-border/60 pl-2">
                    {item.children.map((child) => (
                      <NavRow
                        key={child.title}
                        item={child}
                        nested
                        active={currentPath === child.url}
                        alertCount={child.url === ROUTES.bellaAccountant ? bellaCritical : 0}
                        onComingSoon={handleComingSoon}
                      />
                    ))}
                  </ul>
                </li>
              ) : (
                <NavRow
                  key={item.title}
                  item={item}
                  active={currentPath === item.url}
                  alertCount={item.url === ROUTES.bellaAccountant ? bellaCritical : 0}
                  onComingSoon={handleComingSoon}
                />
              ),
            )}
          </ul>

        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop — sidebar fixa */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:left-0 z-30 border-r border-sidebar-border bg-sidebar">
        {brand}
        {pdvQuickAccess}

        {navList}
      </aside>

      {/* Mobile — drawer via Sheet, controlado pelo Topbar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 max-w-[85vw] p-0 md:hidden bg-sidebar border-r border-sidebar-border"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menu de navegação</SheetTitle>
          </SheetHeader>
          <div className="flex h-full flex-col">
            {brand}
            {pdvQuickAccess}

            {navList}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={comingSoon !== null} onOpenChange={(open) => !open && setComingSoon(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkle className="h-5 w-5" />
            </div>
            <DialogTitle>{comingSoon}</DialogTitle>
            <DialogDescription>
              Módulo disponível nas próximas atualizações.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setComingSoon(null)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


function StatusBadge({ status }: { status: ModuleStatus }) {
  if (status === "available") return null;
  if (status === "in_progress") {
    return (
      <Badge
        variant="secondary"
        className="h-4 border-warning/20 bg-warning/10 px-1.5 text-[9px] font-medium uppercase tracking-wide text-warning hover:bg-warning/10"
      >
        Beta
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="h-4 bg-muted px-1.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted"
    >
      Em breve
    </Badge>
  );
}

function NavRow({
  item,
  active,
  nested,
  alertCount = 0,
  onComingSoon,
}: {
  item: NavItem;
  active: boolean;
  /** Indicador de notificação crítica da Bella (somente visual). */
  alertCount?: number;
  /** Subitem de um grupo (ex.: PDV dentro de Vendas) — indentação e escala menores. */
  nested?: boolean;
  onComingSoon: (title: string) => void;
}) {
  const Icon = item.icon;
  const isComingSoon = item.status === "coming_soon";

  const content = (
    <>
      {/* Indicador de item ativo: barra à esquerda (topo) ou traço sutil (subitem) */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1/2 -translate-y-1/2 rounded-r-full bg-primary transition-all duration-200",
          nested ? "-left-2 h-4 w-[2px]" : "left-0 h-5 w-[3px]",
          active ? "opacity-100 scale-y-100" : "opacity-0 scale-y-50",
        )}
      />
      <Icon
        className={cn(
          "shrink-0 transition-colors duration-200",
          nested ? "h-[15px] w-[15px]" : "h-[17px] w-[17px]",
          active
            ? "text-primary"
            : "text-muted-foreground/80 group-hover:text-sidebar-foreground",
        )}
        strokeWidth={2}
      />
      <span
        className={cn(
          "flex-1 truncate transition-colors duration-200",
          active ? "font-semibold" : "font-medium",
        )}
      >
        {item.title}
      </span>
      {alertCount > 0 ? (
        <span
          className="ml-auto grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-none text-destructive-foreground"
          title={`${alertCount} alerta(s) crítico(s) da Bella`}
          aria-label={`${alertCount} alerta crítico da Bella`}
        >
          {alertCount > 9 ? "9+" : alertCount}
        </span>
      ) : null}
      <StatusBadge status={item.status} />
    </>
  );

  const className = cn(
    "group relative flex w-full items-center rounded-lg text-left transition-all duration-200",
    nested
      ? "gap-2.5 pl-2.5 pr-2 py-1.5 text-[13px]"
      : "gap-3 pl-3 pr-2.5 py-2 text-[13.5px]",
    active
      ? "bg-sidebar-accent/70 text-sidebar-foreground shadow-sm ring-1 ring-sidebar-border/50"
      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
  );



  if (isComingSoon) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onComingSoon(item.title)}
          className={className}
        >
          {content}
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link to={item.url} className={className}>
        {content}
      </Link>
    </li>
  );
}
