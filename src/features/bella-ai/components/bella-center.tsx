import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Lightbulb, Bell, History } from "lucide-react";

const sections = [
  {
    key: "conversations",
    label: "Conversas",
    description: "Central de conversas com a Bella IA.",
    icon: MessageSquare,
  },
  {
    key: "insights",
    label: "Insights",
    description: "Análises geradas a partir dos módulos do NexOS.",
    icon: Lightbulb,
  },
  {
    key: "alerts",
    label: "Alertas",
    description: "Notificações inteligentes sobre riscos e oportunidades.",
    icon: Bell,
  },
  {
    key: "history",
    label: "Histórico",
    description: "Registro completo de interações e decisões.",
    icon: History,
  },
] as const;

export function BellaCenter() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Centro da Bella</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sections.map(({ key, label, description, icon: Icon }) => (
          <div
            key={key}
            className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{label}</span>
              <span className="ml-auto rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                em preparação
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
