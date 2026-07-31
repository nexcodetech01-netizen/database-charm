import { CalendarClock, CalendarDays, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAgendaMetrics } from "../hooks/use-agenda";

export function AgendaMetrics({ companyId }: { companyId: string }) {
  const { data, isLoading } = useAgendaMetrics(companyId);

  const items = [
    { label: "Hoje", value: data?.today ?? 0, icon: CalendarClock, tone: "text-primary" },
    { label: "Próximos 7 dias", value: data?.next7 ?? 0, icon: CalendarDays, tone: "text-foreground" },
    { label: "Atrasados", value: data?.overdue ?? 0, icon: AlertTriangle, tone: "text-danger" },
    { label: "Concluídos no mês", value: data?.completedThisMonth ?? 0, icon: CheckCircle2, tone: "text-success" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} >
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {it.label}
              </p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight">
                {isLoading ? "—" : it.value}
              </p>
            </div>
            <div className={`rounded-lg bg-muted/60 p-2.5 ${it.tone}`}>
              <it.icon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
