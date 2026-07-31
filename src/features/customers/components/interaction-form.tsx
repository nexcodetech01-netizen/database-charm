import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateInteraction } from "../hooks/use-customers";
import { INTERACTION_TYPE_OPTIONS, type InteractionType } from "../types";

interface Props {
  companyId: string;
  customerId: string;
}

export function InteractionForm({ companyId, customerId }: Props) {
  const [type, setType] = useState<InteractionType>("note");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const createMut = useCreateInteraction();

  const submit = async () => {
    if (!content.trim() && !subject.trim()) {
      toast.error("Descreva a interação");
      return;
    }
    try {
      await createMut.mutateAsync({
        company_id: companyId,
        customer_id: customerId,
        type,
        subject: subject.trim() || null,
        content: content.trim() || null,
      });
      toast.success("Interação registrada");
      setSubject("");
      setContent("");
      setType("note");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao registrar");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-foreground">Registrar interação</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as InteractionType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INTERACTION_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Assunto</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex.: Follow-up de proposta"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs font-medium text-muted-foreground">Descrição</Label>
          <Textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Detalhes da conversa, próximos passos..."
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={submit} disabled={createMut.isPending}>
          <Plus className="mr-1.5 h-4 w-4" />
          {createMut.isPending ? "Salvando..." : "Adicionar"}
        </Button>
      </div>
    </div>
  );
}
