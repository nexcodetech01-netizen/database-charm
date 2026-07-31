import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MISSIONS,
  MISSION_PRIORITY_LABEL,
  MISSION_STATUS_LABEL,
  type Mission,
} from "../data";

interface MissionPanelProps {
  missions?: Mission[];
}

export function MissionPanel({ missions = MISSIONS }: MissionPanelProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" /> Missões
        </CardTitle>
        <span className="text-[11px] text-muted-foreground">
          {missions.length} missões
        </span>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {missions.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.id}
              className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", m.tone)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">{m.title}</span>
                    <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {MISSION_PRIORITY_LABEL[m.priority]}
                    </span>
                    <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                      {MISSION_STATUS_LABEL[m.status]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Progresso</span>
                  <span className="font-medium text-foreground">{m.progress}%</span>
                </div>
                <Progress value={m.progress} className="h-1.5" />
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Ações
                </div>
                <ul className="space-y-1">
                  {m.actions.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start gap-1.5 text-xs text-muted-foreground"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                      {a.label}
                    </li>
                  ))}
                </ul>
              </div>

              <Button variant="outline" size="sm" className="mt-auto gap-1.5" disabled>
                Abrir missão <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
