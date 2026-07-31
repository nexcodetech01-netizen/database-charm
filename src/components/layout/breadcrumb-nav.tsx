import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { ROUTES } from "@/config/routes";
import { cn } from "@/lib/utils";

/**
 * Auto breadcrumb derived from the current URL segment, mapped to
 * NexOS module labels. Silently omits itself when there is nothing
 * meaningful to show (e.g. on `/` or `/dashboard`).
 */
const LABELS: Record<string, string> = {
  "": "Início",
  dashboard: "Dashboard",
  produtos: "Produtos",
  categorias: "Categorias",
  estoque: "Estoque",
  compras: "Compras",
  fornecedores: "Fornecedores",
  clientes: "Clientes",
  crm: "CRM & Funil",
  vendas: "Vendas",
  agenda: "Agenda",
  financeiro: "Financeiro",
  "bella-pay": "Bella Pay",
  marketing: "Marketing",
  relatorios: "Relatórios",
  bella: "Bella IA",
  configuracoes: "Configurações",
  novo: "Novo",
  editar: "Editar",
  produto: "Produto",
  fiscal: "Fiscal",
  notas: "Notas Fiscais",
  configuracao: "Configuração",
};

function labelFor(segment: string) {
  if (LABELS[segment]) return LABELS[segment];
  // UUID-ish segment → "Detalhes"
  if (/^[0-9a-f-]{16,}$/i.test(segment)) return "Detalhes";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function BreadcrumbNav({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;
  if (segments.length === 1 && segments[0] === "dashboard") return null;

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    return { href, label: labelFor(seg), isLast: i === segments.length - 1 };
  });

  return (
    <nav
      aria-label="Trilha de navegação"
      className={cn(
        "flex items-center gap-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <Link
        to={ROUTES.dashboard}
        className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Home className="h-3 w-3" aria-hidden="true" />
        <span className="sr-only">Início</span>
      </Link>
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
          {c.isLast ? (
            <span className="font-medium text-foreground" aria-current="page">
              {c.label}
            </span>
          ) : (
            <Link
              to={c.href}
              className="rounded px-1 py-0.5 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
