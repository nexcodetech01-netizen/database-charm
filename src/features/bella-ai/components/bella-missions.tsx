import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, ArrowRight, TrendingDown, PackageSearch, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, StatusBadge } from "@/components/design";
import { RADIUS_TOKENS, TEXT_TOKENS, statusToken, type StatusToken } from "@/design";

interface Mission {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  progress: number;
  remaining: string[];
  status: StatusToken;
  statusLabel: string;
}

const MISSIONS: Mission[] = [
  {
    id: "inadimplencia",
    title: "Reduzir inadimplência",
    description: "Levar inadimplência para menos de 5% até o fim do mês.",
    icon: TrendingDown,
    progress: 62,
    remaining: ["Cobrar clientes em atraso", "Enviar lembretes automáticos", "Revisar pagamentos parciais"],
    status: "danger",
    statusLabel: "Crítica",
  },
  {
    id: "giro-estoque",
    title: "Girar produtos parados",
    description: "Escoar 30 SKUs com giro baixo há mais de 60 dias.",
    icon: PackageSearch,
    progress: 34,
    remaining: ["Criar coleção promocional", "Divulgar no WhatsApp", "Ajustar preço mínimo"],
    status: "warning",
    statusLabel: "Atenção",
  },
  {
    id: "recompra",
    title: "Ativar clientes recorrentes",
    description: "Reengajar clientes sem compra nos últimos 90 dias.",
    icon: Users,
    progress: 18,
    remaining: ["Segmentar por ticket médio", "Enviar campanha personalizada", "Oferecer cupom de retorno"],
    status: "info",
    statusLabel: "Em curso",
  },
];

export function BellaMissions() {
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" aria-hidden="true" /> Missões
        </span>
      }
      description={`${MISSIONS.length} missões ativas`}
    >
      <div data-testid="bella-missions" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {MISSIONS.map(({ id, title, description, icon: Icon, progress, remaining, status, statusLabel }) => {
          const token = statusToken(status);
          return (
            <article
              key={id}
              data-testid="bella-mission-card"
              className={cn("flex flex-col gap-3 border border-border bg-card p-4", RADIUS_TOKENS.xl)}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn("grid h-9 w-9 shrink-0 place-items-center", RADIUS_TOKENS.lg, token.soft)}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("font-semibold", TEXT_TOKENS.sm)}>{title}</span>
                    <StatusBadge status={status} withDot>
                      {statusLabel}
                    </StatusBadge>
                  </div>
                  <p className={cn("text-muted-foreground", TEXT_TOKENS.xs)}>{description}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div
                  className={cn(
                    "flex items-center justify-between text-muted-foreground",
                    TEXT_TOKENS.xs,
                  )}
                >
                  <span>Progresso</span>
                  <span className="font-medium tabular-nums text-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>

              <div className="space-y-1.5">
                <div
                  className={cn(
                    "font-medium uppercase tracking-wide text-muted-foreground",
                    TEXT_TOKENS.xs,
                  )}
                >
                  Ações restantes
                </div>
                <ul className="space-y-1">
                  {remaining.map((r) => (
                    <li
                      key={r}
                      className={cn("flex items-start gap-1.5 text-muted-foreground", TEXT_TOKENS.xs)}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("mt-1.5 h-1 w-1 shrink-0 rounded-full", token.dot)}
                      />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              <Button variant="outline" size="sm" className="mt-auto gap-1.5" disabled>
                Abrir missão <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
