import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AGENT_BLUEPRINTS } from "../workspace/data";

export function BellaAgentsGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {AGENT_BLUEPRINTS.map((a) => {
        const Icon = a.icon;
        return (
          <Card key={a.id} className="border-border/70">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{a.name}</div>
                    <p className="text-xs text-muted-foreground">{a.scope}</p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="border-border bg-muted text-[10px] uppercase tracking-wide text-muted-foreground"
                >
                  Em breve
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                {a.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
