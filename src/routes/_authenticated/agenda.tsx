import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout";
import {
  AgendaMetrics,
  AppointmentDetailSheet,
  AppointmentFormDialog,
  CalendarPanel,
  useAppointmentsRange,
} from "@/features/agenda";
import type { Appointment, CalendarView } from "@/features/agenda";

export const Route = createFileRoute("/_authenticated/agenda")({
  beforeLoad: requirePermission("agenda.view"),
  component: AgendaPage,
});

function AgendaPage() {
  const { company } = Route.useRouteContext();
  const [view, setView] = useState<CalendarView>("week");
  const [cursor, setCursor] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const range = useMemo(() => {
    if (view === "day") {
      const start = new Date(cursor);
      start.setHours(0, 0, 0, 0);
      const end = new Date(cursor);
      end.setHours(23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    if (view === "week") {
      return {
        from: startOfWeek(cursor, { weekStartsOn: 0 }).toISOString(),
        to: endOfWeek(cursor, { weekStartsOn: 0 }).toISOString(),
      };
    }
    return {
      from: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }).toISOString(),
      to: addDays(endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }), 1).toISOString(),
    };
  }, [view, cursor]);

  const { data, isLoading } = useAppointmentsRange(company.id, range);

  return (
    <PageLayout
      icon={CalendarDays}
      title="Agenda"
      description="O que tem hoje? Organize atendimentos, entregas e reuniões da equipe."
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDefaultDate(cursor);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Novo agendamento
        </Button>
      }
      kpis={<AgendaMetrics companyId={company.id} />}
    >
      <CalendarPanel
        view={view}
        onViewChange={setView}
        cursor={cursor}
        onCursorChange={setCursor}
        appointments={data ?? []}
        isLoading={isLoading}
        onSelectSlot={(d) => {
          setEditing(null);
          setDefaultDate(d);
          setFormOpen(true);
        }}
        onSelectAppointment={(a) => {
          setSelected(a);
          setSheetOpen(true);
        }}
      />

      <AppointmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        companyId={company.id}
        appointment={editing}
        defaultDate={defaultDate}
      />

      <AppointmentDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        appointment={selected}
        onEdit={(a) => {
          setSheetOpen(false);
          setEditing(a);
          setFormOpen(true);
        }}
      />
    </PageLayout>
  );
}
