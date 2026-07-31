import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, MapPin, User, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppointmentStatusBadge } from "./appointment-status-badge";
import { AppointmentTimeline } from "./appointment-timeline";
import {
  APPOINTMENT_PRIORITY_COLORS,
  APPOINTMENT_PRIORITY_OPTIONS,
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_TYPE_OPTIONS,
  type Appointment,
  type AppointmentPriority,
} from "../types";
import { useDeleteAppointment, useUpdateAppointment } from "../hooks/use-agenda";

interface Props {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: (a: Appointment) => void;
}

export function AppointmentDetailSheet({ appointment, open, onOpenChange, onEdit }: Props) {
  const updateMut = useUpdateAppointment();
  const deleteMut = useDeleteAppointment();

  if (!appointment) return null;

  const typeLabel =
    APPOINTMENT_TYPE_OPTIONS.find((t) => t.value === appointment.type)?.label ?? appointment.type;
  const priority = ((appointment as { priority?: string }).priority ?? "media") as AppointmentPriority;
  const priorityLabel =
    APPOINTMENT_PRIORITY_OPTIONS.find((p) => p.value === priority)?.label ?? priority;
  const links = {
    sale: appointment.sale_id,
    financial: (appointment as { financial_transaction_id?: string | null }).financial_transaction_id,
    bella: (appointment as { bella_pay_charge_id?: string | null }).bella_pay_charge_id,
  };

  async function changeStatus(status: string) {
    if (!appointment) return;
    try {
      await updateMut.mutateAsync({ id: appointment.id, input: { status } });
      toast.success("Status atualizado");
    } catch (e) {
      toast.error("Não foi possível atualizar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function handleDelete() {
    if (!appointment) return;
    if (!confirm(`Excluir "${appointment.title}"?`)) return;
    try {
      await deleteMut.mutateAsync(appointment.id);
      toast.success("Agendamento excluído");
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível excluir", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate">{appointment.title}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <span>{typeLabel}</span>
                <span aria-hidden>·</span>
                <AppointmentStatusBadge status={appointment.status} />
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${APPOINTMENT_PRIORITY_COLORS[priority]}`}
                >
                  {priorityLabel}
                </span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-start gap-2 text-sm">
              <CalendarClock className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">
                  {format(new Date(appointment.starts_at), "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })}
                </p>
                <p className="text-muted-foreground">
                  {format(new Date(appointment.starts_at), "HH:mm")} –{" "}
                  {format(new Date(appointment.ends_at), "HH:mm")}
                </p>
              </div>
            </div>
            {appointment.assignee ? (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{appointment.assignee}</span>
              </div>
            ) : null}
            {appointment.location ? (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{appointment.location}</span>
              </div>
            ) : null}
          </div>

          {appointment.notes ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Observações
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{appointment.notes}</p>
            </div>
          ) : null}

          {(links.sale || links.financial || links.bella) ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Integrações
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {links.sale ? (
                  <span className="inline-flex items-center rounded-md border border-border bg-background px-2 py-1">
                    Venda · {links.sale.slice(0, 8)}
                  </span>
                ) : null}
                {links.financial ? (
                  <span className="inline-flex items-center rounded-md border border-border bg-background px-2 py-1">
                    Financeiro · {links.financial.slice(0, 8)}
                  </span>
                ) : null}
                {links.bella ? (
                  <span className="inline-flex items-center rounded-md border border-border bg-background px-2 py-1">
                    Bella Pay · {links.bella.slice(0, 8)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}


          <div className="flex flex-wrap items-center gap-2">
            <Select value={appointment.status} onValueChange={changeStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => onEdit(appointment)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Editar
            </Button>
            <Button variant="ghost" size="sm" className="text-danger" onClick={handleDelete}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
            </Button>
          </div>

          <Separator />

          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">Timeline</p>
            <AppointmentTimeline appointmentId={appointment.id} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
