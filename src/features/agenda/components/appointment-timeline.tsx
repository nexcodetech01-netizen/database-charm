import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, CircleAlert, CircleCheck, PencilLine, XCircle } from "lucide-react";
import { useAppointmentEvents } from "../hooks/use-agenda";

const ICONS: Record<string, typeof CalendarPlus> = {
  created: CalendarPlus,
  updated: PencilLine,
  status_changed: CircleAlert,
  cancelled: XCircle,
  completed: CircleCheck,
};

const ICON_TONE: Record<string, string> = {
  created: "text-primary",
  updated: "text-muted-foreground",
  status_changed: "text-warning",
  cancelled: "text-danger",
  completed: "text-success",
};

export function AppointmentTimeline({ appointmentId }: { appointmentId: string }) {
  const { data, isLoading } = useAppointmentEvents(appointmentId);
  const events = data ?? [];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando timeline...</p>;
  }
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>;
  }

  return (
    <ol className="space-y-3">
      {events.map((ev) => {
        const Icon = ICONS[ev.event_type] ?? CircleAlert;
        return (
          <li key={ev.id} className="flex gap-3">
            <div className={`mt-0.5 rounded-full bg-muted/60 p-1.5 ${ICON_TONE[ev.event_type] ?? "text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">{ev.description ?? ev.event_type}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(ev.occurred_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
