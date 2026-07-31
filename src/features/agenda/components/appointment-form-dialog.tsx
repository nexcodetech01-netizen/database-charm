import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APPOINTMENT_PRIORITY_OPTIONS,
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_TYPE_OPTIONS,
  type Appointment,
} from "../types";
import { useCreateAppointment, useUpdateAppointment } from "../hooks/use-agenda";

const schema = z
  .object({
    title: z.string().min(2, "Título obrigatório"),
    type: z.string().min(1),
    status: z.string().min(1),
    priority: z.string().min(1),
    date: z.string().min(1, "Informe a data"),
    start_time: z.string().min(1, "Informe a hora inicial"),
    end_time: z.string().min(1, "Informe a hora final"),
    customer_id: z.string().optional().nullable(),
    sale_id: z.string().optional().nullable(),
    financial_transaction_id: z.string().optional().nullable(),
    bella_pay_charge_id: z.string().optional().nullable(),
    assignee: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .refine((d) => d.end_time > d.start_time, {
    message: "Hora final deve ser após a inicial",
    path: ["end_time"],
  });

type FormValues = z.infer<typeof schema>;

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function toDateInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
  appointment?: Appointment | null;
  defaultDate?: Date;
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  companyId,
  appointment,
  defaultDate,
}: Props) {
  const createMut = useCreateAppointment();
  const updateMut = useUpdateAppointment();
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [sales, setSales] = useState<{ id: string; number: string | null }[]>([]);
  const [finTx, setFinTx] = useState<{ id: string; description: string }[]>([]);
  const [charges, setCharges] = useState<{ id: string; description: string | null }[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      type: "atendimento",
      status: "agendado",
      priority: "media",
      date: "",
      start_time: "09:00",
      end_time: "10:00",
      customer_id: null,
      sale_id: null,
      financial_transaction_id: null,
      bella_pay_charge_id: null,
      assignee: "",
      location: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    void supabase
      .from("customers")
      .select("id,name")
      .eq("company_id", companyId)
      .order("name", { ascending: true })
      .limit(200)
      .then(({ data }) => setCustomers(data ?? []));
    void supabase
      .from("sales")
      .select("id,number")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setSales(data ?? []));
    void supabase
      .from("financial_transactions")
      .select("id,description")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setFinTx(data ?? []));
    void supabase
      .from("bella_pay_charges")
      .select("id,description")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setCharges(data ?? []));
  }, [open, companyId]);

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      form.reset({
        title: appointment.title,
        type: appointment.type,
        status: appointment.status,
        priority: (appointment as { priority?: string }).priority ?? "media",
        date: toDateInput(appointment.starts_at),
        start_time: toTimeInput(appointment.starts_at),
        end_time: toTimeInput(appointment.ends_at),
        customer_id: appointment.customer_id ?? null,
        sale_id: appointment.sale_id ?? null,
        financial_transaction_id:
          (appointment as { financial_transaction_id?: string | null }).financial_transaction_id ?? null,
        bella_pay_charge_id:
          (appointment as { bella_pay_charge_id?: string | null }).bella_pay_charge_id ?? null,
        assignee: appointment.assignee ?? "",
        location: appointment.location ?? "",
        notes: appointment.notes ?? "",
      });
    } else {
      const d = defaultDate ?? new Date();
      form.reset({
        title: "",
        type: "atendimento",
        status: "agendado",
        priority: "media",
        date: toDateInput(d.toISOString()),
        start_time: "09:00",
        end_time: "10:00",
        customer_id: null,
        sale_id: null,
        financial_transaction_id: null,
        bella_pay_charge_id: null,
        assignee: "",
        location: "",
        notes: "",
      });
    }
  }, [open, appointment, defaultDate, form]);

  async function onSubmit(v: FormValues) {
    try {
      const payload = {
        company_id: companyId,
        title: v.title,
        type: v.type,
        status: v.status,
        priority: v.priority,
        starts_at: toIso(v.date, v.start_time),
        ends_at: toIso(v.date, v.end_time),
        customer_id: v.customer_id || null,
        sale_id: v.sale_id || null,
        financial_transaction_id: v.financial_transaction_id || null,
        bella_pay_charge_id: v.bella_pay_charge_id || null,
        assignee: v.assignee || null,
        location: v.location || null,
        notes: v.notes || null,
      };
      if (appointment) {
        await updateMut.mutateAsync({ id: appointment.id, input: payload });
        toast.success("Agendamento atualizado");
      } else {
        const { data: user } = await supabase.auth.getUser();
        await createMut.mutateAsync({ ...payload, created_by: user.user?.id ?? null });
        toast.success("Agendamento criado");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível salvar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{appointment ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
          <DialogDescription>
            Preencha os dados para adicionar à agenda.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: Reunião com cliente" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {APPOINTMENT_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {APPOINTMENT_STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {APPOINTMENT_PRIORITY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Início</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fim</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem cliente</SelectItem>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assignee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do responsável" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local</FormLabel>
                  <FormControl>
                    <Input placeholder="Endereço, link ou local" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Integrações (opcional)
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="sale_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Venda</FormLabel>
                      <Select
                        value={field.value ?? "none"}
                        onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                      >
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {sales.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.number ?? s.id.slice(0, 8)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="financial_transaction_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Financeiro</FormLabel>
                      <Select
                        value={field.value ?? "none"}
                        onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                      >
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {finTx.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.description}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bella_pay_charge_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Bella Pay</FormLabel>
                      <Select
                        value={field.value ?? "none"}
                        onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                      >
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {charges.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.description ?? c.id.slice(0, 8)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
            </div>


            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Salvando..." : appointment ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
