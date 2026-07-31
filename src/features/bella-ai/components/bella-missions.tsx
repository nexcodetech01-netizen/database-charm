import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, ArrowRight, TrendingDown, PackageSearch, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Mission {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  progress: number;
  remaining: string[];
  tone: string;
}

const MISSIONS: Mission[] = [
  {
    id: "inadimplencia",
    title: "Reduzir inadimplência",
    description: "Levar inadimplência para menos de 5% até o fim do mês.",
    icon: TrendingDown,
    progress: 62,
    remaining: ["Cobrar clientes em atraso", "Enviar lembretes automáticos", "Revisar pagamentos parciais"],
    tone: "bg-danger/10 text-danger",
  },
  {
    id: "giro-estoque",
    title: "Girar produtos parados",
    description: "Escoar 30 SKUs com giro baixo há mais de 60 dias.",
    icon: PackageSearch,
    progress: 34,
    remaining: ["Criar coleção promocional", "Divulgar no WhatsApp", "Ajustar preço mínimo"],
    tone: "bg-warning/10 text-warning",
  },
  {
    id: "recompra",
    title: "Ativar clientes recorrentes",
    description: "Reengajar clientes sem compra nos últimos 90 dias.",
    icon: Users,
    progress: 18,
    remaining: ["Segmentar por ticket médio", "Enviar campanha personalizada", "Oferecer cupom de retorno"],
    tone: "bg-primary/10 text-primary",
  },
];

export function BellaMissions() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" /> Missões
        </CardTitle>
        <span className="text-[11px] text-muted-foreground">
          {MISSIONS.length} missões ativas
        </span>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {MISSIONS.map(({ id, title, description, icon: Icon, progress, remaining, tone }) => (
          <div
            key={id}
            className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card p-4"
          >
            <div className="flex items-start gap-3">
              <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tone)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="text-sm font-semibold text-foreground">{title}</div>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Progresso</span>
                <span className="font-medium text-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Ações restantes
              </div>
              <ul className="space-y-1">
                {remaining.map((r) => (
                  <li
                    key={r}
                    className="flex items-start gap-1.5 text-xs text-muted-foreground"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            <Button variant="outline" size="sm" className="mt-auto gap-1.5" disabled>
              Abrir missão <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
