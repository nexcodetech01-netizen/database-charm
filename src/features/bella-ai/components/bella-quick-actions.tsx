import { Link } from "@tanstack/react-router";
import {
  Boxes,
  FileText,
  Landmark,
  MonitorSmartphone,
  Receipt,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Section } from "@/components/design";
import {
  INTERACTION_TOKENS,
  RADIUS_TOKENS,
  TEXT_TOKENS,
  statusToken,
  type StatusToken,
} from "@/design";

/**
 * BellaQuickActions (UI.2.2) — atalhos operacionais da Home da Bella.
 *
 * Apenas navegação para telas oficiais já existentes. Nenhuma skill,
 * automação, provider ou regra de negócio é executada aqui.
 */
interface QuickAction {
  id: string;
  label: string;
  hint: string;
  to: string;
  icon: LucideIcon;
  status: StatusToken;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "sales",
    label: "Consultar vendas",
    hint: "Relatórios comerciais",
    to: "/relatorios",
    icon: Receipt,
    status: "info",
  },
  {
    id: "cash",
    label: "Consultar caixa",
    hint: "Sessão e movimentos",
    to: "/caixa",
    icon: Wallet,
    status: "success",
  },
  {
    id: "invoice",
    label: "Emitir nota",
    hint: "Documentos fiscais",
    to: "/fiscal/notas",
    icon: FileText,
    status: "processing",
  },
  {
    id: "product",
    label: "Cadastrar produto",
    hint: "Novo item no catálogo",
    to: "/produtos/novo",
    icon: Boxes,
    status: "neutral",
  },
  {
    id: "customer",
    label: "Cadastrar cliente",
    hint: "Nova ficha de cliente",
    to: "/clientes/novo",
    icon: UserPlus,
    status: "neutral",
  },
  {
    id: "charge",
    label: "Cobrar cliente",
    hint: "Bella Pay",
    to: "/bella-pay",
    icon: Landmark,
    status: "warning",
  },
  {
    id: "pdv",
    label: "Abrir PDV",
    hint: "Frente de caixa",
    to: "/pdv",
    icon: MonitorSmartphone,
    status: "info",
  },
];

export interface BellaQuickActionsProps {
  className?: string;
}

export function BellaQuickActions({ className }: BellaQuickActionsProps) {
  return (
    <Section
      title="Ações rápidas"
      description="Atalhos para as operações mais usadas do dia."
      className={className}
    >
      <div
        data-testid="bella-quick-actions"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {QUICK_ACTIONS.map(({ id, label, hint, to, icon: Icon, status }) => {
          const token = statusToken(status);
          return (
            <Link
              key={id}
              to={to}
              data-testid="bella-action-card"
              className={cn(
                "group flex min-w-0 items-center gap-3 border border-border bg-card p-4",
                RADIUS_TOKENS.xl,
                INTERACTION_TOKENS.hover,
                INTERACTION_TOKENS.focus,
                "hover:border-primary/40 hover:bg-accent/40",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center",
                  RADIUS_TOKENS.lg,
                  token.soft,
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className={cn("block truncate font-medium", TEXT_TOKENS.sm)}>{label}</span>
                <span className={cn("block truncate text-muted-foreground", TEXT_TOKENS.xs)}>
                  {hint}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}
