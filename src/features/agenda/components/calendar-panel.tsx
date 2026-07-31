import { useMemo } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { APPOINTMENT_TYPE_COLORS, type Appointment, type AppointmentType, type CalendarView } from "../types";

interface Props {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  cursor: Date;
  onCursorChange: (d: Date) => void;
  appointments: Appointment[];
  isLoading?: boolean;
  onSelectSlot: (d: Date) => void;
  onSelectAppointment: (a: Appointment) => void;
}

export function CalendarPanel({
  view,
  onViewChange,
  cursor,
  onCursorChange,
  appointments,
  isLoading,
  onSelectSlot,
  onSelectAppointment,
}: Props) {
  const title = useMemo(() => {
    if (view === "day") return format(cursor, "EEEE, dd 'de' MMMM yyyy", { locale: ptBR });
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 0 });
      const end = endOfWeek(cursor, { weekStartsOn: 0 });
      return `${format(start, "dd MMM", { locale: ptBR })} – ${format(end, "dd MMM yyyy", { locale: ptBR })}`;
    }
    return format(cursor, "MMMM yyyy", { locale: ptBR });
  }, [cursor, view]);

  function shift(dir: 1 | -1) {
    if (view === "day") onCursorChange(addDays(cursor, dir));
    else if (view === "week") onCursorChange(addWeeks(cursor, dir));
    else onCursorChange(addMonths(cursor, dir));
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shift(-1)} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onCursorChange(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => shift(1)} aria-label="Próximo">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <p className="ml-2 text-sm font-medium capitalize text-foreground">{title}</p>
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(["day", "week", "month"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("p-4", isLoading && "opacity-60")}>
        {view === "month" ? (
          <MonthView
            cursor={cursor}
            appointments={appointments}
            onSelectSlot={onSelectSlot}
            onSelectAppointment={onSelectAppointment}
          />
        ) : view === "week" ? (
          <WeekView
            cursor={cursor}
            appointments={appointments}
            onSelectSlot={onSelectSlot}
            onSelectAppointment={onSelectAppointment}
          />
        ) : (
          <DayView
            cursor={cursor}
            appointments={appointments}
            onSelectAppointment={onSelectAppointment}
          />
        )}
      </div>
    </div>
  );
}

function apptColor(a: Appointment) {
  return a.color ?? APPOINTMENT_TYPE_COLORS[a.type as AppointmentType] ?? "#2563EB";
}

function MonthView({
  cursor,
  appointments,
  onSelectSlot,
  onSelectAppointment,
}: {
  cursor: Date;
  appointments: Appointment[];
  onSelectSlot: (d: Date) => void;
  onSelectAppointment: (a: Appointment) => void;
}) {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-px text-xs font-medium text-muted-foreground">
        {weekdays.map((w) => (
          <div key={w} className="px-2 py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {days.map((d) => {
          const dayAppts = appointments.filter((a) => isSameDay(new Date(a.starts_at), d));
          const inMonth = isSameMonth(d, cursor);
          const today = isSameDay(d, new Date());
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelectSlot(d)}
              className={cn(
                "flex min-h-[92px] flex-col gap-1 bg-card p-2 text-left transition-colors hover:bg-muted/50",
                !inMonth && "bg-muted/30 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium",
                  today && "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                )}
              >
                {format(d, "d")}
              </span>
              <div className="flex flex-col gap-1 overflow-hidden">
                {dayAppts.slice(0, 3).map((a) => (
                  <span
                    key={a.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAppointment(a);
                    }}
                    className="truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: apptColor(a) }}
                    title={a.title}
                  >
                    {format(new Date(a.starts_at), "HH:mm")} {a.title}
                  </span>
                ))}
                {dayAppts.length > 3 ? (
                  <span className="text-[10px] text-muted-foreground">
                    +{dayAppts.length - 3} mais
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  cursor,
  appointments,
  onSelectSlot,
  onSelectAppointment,
}: {
  cursor: Date;
  appointments: Appointment[];
  onSelectSlot: (d: Date) => void;
  onSelectAppointment: (a: Appointment) => void;
}) {
  const start = startOfWeek(cursor, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const list = appointments
          .filter((a) => isSameDay(new Date(a.starts_at), d))
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
        const today = isSameDay(d, new Date());
        return (
          <div key={d.toISOString()} className="rounded-lg border border-border bg-card">
            <button
              onClick={() => onSelectSlot(d)}
              className="w-full border-b border-border px-3 py-2 text-left hover:bg-muted/40"
            >
              <p className="text-[11px] uppercase text-muted-foreground">
                {format(d, "EEE", { locale: ptBR })}
              </p>
              <p
                className={cn(
                  "text-sm font-semibold",
                  today && "text-primary",
                )}
              >
                {format(d, "dd/MM")}
              </p>
            </button>
            <div className="flex min-h-[220px] flex-col gap-1 p-2">
              {list.length === 0 ? (
                <p className="mt-2 text-center text-[11px] text-muted-foreground">—</p>
              ) : (
                list.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onSelectAppointment(a)}
                    className="rounded-md px-2 py-1.5 text-left text-xs font-medium text-white transition hover:opacity-90"
                    style={{ backgroundColor: apptColor(a) }}
                  >
                    <div>{format(new Date(a.starts_at), "HH:mm")}</div>
                    <div className="truncate">{a.title}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({
  cursor,
  appointments,
  onSelectAppointment,
}: {
  cursor: Date;
  appointments: Appointment[];
  onSelectAppointment: (a: Appointment) => void;
}) {
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7h-20h
  const dayAppts = appointments
    .filter((a) => isSameDay(new Date(a.starts_at), cursor))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <div className="grid grid-cols-[64px_1fr] gap-2">
      <div className="flex flex-col">
        {hours.map((h) => (
          <div key={h} className="h-14 pr-2 text-right text-[11px] text-muted-foreground">
            {String(h).padStart(2, "0")}:00
          </div>
        ))}
      </div>
      <div className="relative rounded-lg border border-border bg-card">
        {hours.map((h) => (
          <div key={h} className="h-14 border-b border-border/50 last:border-b-0" />
        ))}
        {dayAppts.map((a) => {
          const start = new Date(a.starts_at);
          const end = new Date(a.ends_at);
          const startMin = start.getHours() * 60 + start.getMinutes();
          const endMin = end.getHours() * 60 + end.getMinutes();
          const base = 7 * 60;
          const top = ((startMin - base) / 60) * 56;
          const height = Math.max(24, ((endMin - startMin) / 60) * 56);
          if (top < 0) return null;
          return (
            <button
              key={a.id}
              onClick={() => onSelectAppointment(a)}
              className="absolute left-2 right-2 rounded-md px-2 py-1 text-left text-xs font-medium text-white shadow-sm transition hover:opacity-90"
              style={{ top, height, backgroundColor: apptColor(a) }}
            >
              <div>{format(start, "HH:mm")} – {format(end, "HH:mm")}</div>
              <div className="truncate">{a.title}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
