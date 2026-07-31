import { Package, ShoppingCart, UserPlus, Receipt, CalendarPlus, FileText } from "lucide-react";
import { DashboardSection } from "./dashboard-section";

const ACTIONS = [
  { label: "Novo produto", icon: Package },
  { label: "Nova venda", icon: ShoppingCart },
  { label: "Novo cliente", icon: UserPlus },
  { label: "Registrar despesa", icon: Receipt },
  { label: "Agendar", icon: CalendarPlus },
  { label: "Relatório rápido", icon: FileText },
];

export function QuickActions() {
  return (
    <DashboardSection title="Ações rápidas" description="Atalhos para o dia a dia">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              className="group flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/30 hover:bg-accent"
            >
              <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium leading-tight">{a.label}</span>
            </button>
          );
        })}
      </div>
    </DashboardSection>
  );
}
