import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/fiscal", label: "Dashboard" },
  { to: "/fiscal/notas", label: "Notas Fiscais" },
  { to: "/fiscal/configuracao", label: "Configuração" },
] as const;

export function FiscalTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="flex items-center gap-6 border-b border-border/60"
      aria-label="Navegação do módulo fiscal"
    >
      {TABS.map((tab) => {
        const isActive =
          tab.to === "/fiscal"
            ? pathname === "/fiscal"
            : pathname.startsWith(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "relative -mb-px py-3 text-sm font-medium transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {isActive && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
