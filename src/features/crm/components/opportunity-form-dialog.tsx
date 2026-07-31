import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomersList } from "@/features/customers";
import {
  LEAD_SOURCE_OPTIONS,
  OPPORTUNITY_STATUS_OPTIONS,
  type Opportunity,
  type OpportunityInsert,
  type PipelineStage,
} from "../types";

const schema = z.object({
  title: z.string().min(2, "Informe o título"),
  customer_id: z.string().optional(),
  stage_id: z.string().min(1, "Selecione uma etapa"),
  lead_source: z.string().optional(),
  estimated_value: z.coerce.number().min(0),
  probability: z.coerce.number().int().min(0).max(100),
  next_action: z.string().optional(),
  expected_close_date: z.string().optional(),
  assignee: z.string().optional(),
  status: z.enum(["open", "won", "lost"]),
  won_reason: z.string().optional(),
  lost_reason: z.string().optional(),
  description: z.string().optional(),
});

export type OpportunityFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stages: PipelineStage[];
  editing: Opportunity | null;
  defaultStageId?: string;
  companyId: string;
  onSubmit: (values: OpportunityInsert, id?: string) => Promise<void> | void;
}

export function OpportunityFormDialog({
  open,
  onOpenChange,
  stages,
  editing,
  defaultStageId,
  companyId,
  onSubmit,
}: Props) {
  const { data: customers } = useCustomersList(companyId, {
    search: "",
    status: "",
    segment: "",
    state: "",
    sortBy: "name",
    sortDir: "asc",
    page: 1,
    pageSize: 200,
  });

  const form = useForm<OpportunityFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      stage_id: defaultStageId ?? stages[0]?.id ?? "",
      estimated_value: 0,
      probability: 0,
      status: "open",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        title: editing.title,
        customer_id: editing.customer_id ?? undefined,
        stage_id: editing.stage_id ?? stages[0]?.id ?? "",
        lead_source: editing.lead_source ?? undefined,
        estimated_value: Number(editing.estimated_value ?? 0),
        probability: editing.probability ?? 0,
        next_action: editing.next_action ?? undefined,
        expected_close_date: editing.expected_close_date ?? undefined,
        assignee: editing.assignee ?? undefined,
        status: (editing.status as "open" | "won" | "lost") ?? "open",
        won_reason: editing.won_reason ?? undefined,
        lost_reason: editing.lost_reason ?? undefined,
        description: editing.description ?? undefined,
      });
    } else {
      form.reset({
        title: "",
        stage_id: defaultStageId ?? stages[0]?.id ?? "",
        estimated_value: 0,
        probability: 0,
        status: "open",
      });
    }
  }, [open, editing, defaultStageId, stages, form]);

  const status = form.watch("status");

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload: OpportunityInsert = {
      company_id: companyId,
      title: values.title,
      customer_id: values.customer_id || null,
      stage_id: values.stage_id,
      lead_source: values.lead_source || null,
      estimated_value: values.estimated_value,
      probability: values.probability,
      next_action: values.next_action || null,
      expected_close_date: values.expected_close_date || null,
      assignee: values.assignee || null,
      status: values.status,
      won_reason: values.status === "won" ? values.won_reason || null : null,
      lost_reason: values.status === "lost" ? values.lost_reason || null : null,
      description: values.description || null,
    };
    await onSubmit(payload, editing?.id);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome da oportunidade" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(customers?.rows ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stage_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etapa</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="estimated_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor estimado (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="probability"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Probabilidade (%)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={100} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lead_source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Origem</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Origem do lead" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEAD_SOURCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="expected_close_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data prevista</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="next_action"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Próxima ação</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: enviar proposta comercial" {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OPPORTUNITY_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            {status === "won" ? (
              <FormField
                control={form.control}
                name="won_reason"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Motivo de ganho</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
            ) : null}
            {status === "lost" ? (
              <FormField
                control={form.control}
                name="lost_reason"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Motivo de perda</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
