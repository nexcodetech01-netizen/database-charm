import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { AUTOMATION_BLUEPRINTS } from "../workspace/data";

export function BellaAutomationsList() {
  return (
    <div className="space-y-2">
      {AUTOMATION_BLUEPRINTS.map((a) => {
        const T = a.triggerIcon;
        const A = a.actionIcon;
        return (
          <Card key={a.id} className="border-border/70">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex flex-1 items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-foreground">
                  <T className="h-4 w-4" />
                </div>
                <div className="text-sm font-medium">{a.trigger}</div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <A className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">{a.action}</div>
                  <div className="text-xs text-muted-foreground">{a.description}</div>
                </div>
              </div>
              <Badge
                variant="secondary"
                className="border-border bg-muted text-[10px] uppercase tracking-wide text-muted-foreground"
              >
                Preparado
              </Badge>
              <Switch disabled />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
