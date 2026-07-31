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
import {
  CAMPAIGN_CHANNEL_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
  type MarketingCampaign,
  type MarketingCampaignInsert,
} from "../types";

const schema = z.object({
  name: z.string().min(2, "Informe o nome"),
  channel: z.enum(["whatsapp", "email", "instagram", "facebook", "google", "other"]),
  status: z.enum(["draft", "scheduled", "running", "completed", "paused", "cancelled"]),
  objective: z.string().optional(),
  message: z.string().optional(),
  budget: z.coerce.number().min(0),
  revenue_generated: z.coerce.number().min(0),
  leads_count: z.coerce.number().int().min(0),
  conversions_count: z.coerce.number().int().min(0),
  scheduled_for: z.string().optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: MarketingCampaign | null;
  companyId: string;
  onSubmit: (values: MarketingCampaignInsert, id?: string) => Promise<void> | void;
}

export function CampaignFormDialog({
  open,
  onOpenChange,
  editing,
  companyId,
  onSubmit,
}: Props) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      channel: "whatsapp",
      status: "draft",
      budget: 0,
      revenue_generated: 0,
      leads_count: 0,
      conversions_count: 0,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.name,
        channel: editing.channel as z.infer<typeof schema>["channel"],
        status: editing.status as z.infer<typeof schema>["status"],
        objective: editing.objective ?? undefined,
        message: editing.message ?? undefined,
        budget: Number(editing.budget ?? 0),
        revenue_generated: Number(editing.revenue_generated ?? 0),
        leads_count: editing.leads_count ?? 0,
        conversions_count: editing.conversions_count ?? 0,
        scheduled_for: editing.scheduled_for ?? undefined,
      });
    } else {
      form.reset({
        name: "",
        channel: "whatsapp",
        status: "draft",
        budget: 0,
        revenue_generated: 0,
        leads_count: 0,
        conversions_count: 0,
      });
    }
  }, [open, editing, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload: MarketingCampaignInsert = {
      company_id: companyId,
      name: values.name,
      channel: values.channel,
      status: values.status,
      objective: values.objective || null,
      message: values.message || null,
      budget: values.budget,
      revenue_generated: values.revenue_generated,
      leads_count: values.leads_count,
      conversions_count: values.conversions_count,
      scheduled_for: values.scheduled_for || null,
    };
    await onSubmit(payload, editing?.id);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar campanha" : "Nova campanha"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Canal</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CAMPAIGN_CHANNEL_OPTIONS.map((o) => (
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CAMPAIGN_STATUS_OPTIONS.map((o) => (
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
              name="objective"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Objetivo</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Mensagem / criativo</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="budget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Orçamento (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min={0} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="revenue_generated"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receita gerada (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min={0} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="leads_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leads</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="conversions_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conversões</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="scheduled_for"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Agendada para</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter className="col-span-2">
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
