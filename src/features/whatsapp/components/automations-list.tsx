import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AUTOMATION_ACTION_LABELS,
  AUTOMATION_TRIGGER_LABELS,
  WHATSAPP_AUTOMATIONS,
} from "../data";
import { AUTOMATION_ACTION_ICON, AUTOMATION_TRIGGER_ICON } from "../icons";

export function AutomationsList() {
  return (
    <div className="space-y-3">
      {WHATSAPP_AUTOMATIONS.map((auto) => {
        const TriggerIcon = AUTOMATION_TRIGGER_ICON[auto.trigger];
        const ActionIcon = AUTOMATION_ACTION_ICON[auto.action];
        return (
          <Card key={auto.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex flex-1 items-center gap-3">
                <Chip icon={TriggerIcon} label={AUTOMATION_TRIGGER_LABELS[auto.trigger]} tone="muted" />
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <Chip icon={ActionIcon} label={AUTOMATION_ACTION_LABELS[auto.action]} tone="primary" />
              </div>
              <p className="hidden flex-1 text-xs text-muted-foreground md:block">
                {auto.description}
              </p>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="h-4 bg-muted px-1.5 text-[9px] uppercase text-muted-foreground"
                >
                  Preparado
                </Badge>
                <Switch checked={auto.enabled} disabled aria-label="Ativar automação" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Chip({
  icon: Icon,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "muted" | "primary";
}) {
  const cls =
    tone === "primary"
      ? "border-primary/20 bg-primary/10 text-primary"
      : "border-border bg-muted/40 text-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
