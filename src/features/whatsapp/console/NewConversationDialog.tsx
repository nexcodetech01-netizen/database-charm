import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { useCreateConversation } from "./hooks";

export function NewConversationDialog({
  open,
  onOpenChange,
  companyId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  onCreated: (conversationId: string) => void;
}) {
  const [phone, setPhone] = useState("55");
  const [name, setName] = useState("");
  const create = useCreateConversation(companyId);

  useEffect(() => {
    if (open) {
      setPhone("55");
      setName("");
    }
  }, [open]);

  // Higieniza tudo que não for dígito antes de qualquer uso.
  const digits = phone.replace(/\D+/g, "");
  const validation = (() => {
    if (digits.length === 0) return { ok: false, message: "" };
    if (digits.length < 12)
      return {
        ok: false,
        message: "Informe DDI + DDD + número (mín. 12 dígitos). Ex.: 55 11 98888-7777.",
      };
    if (digits.length > 15)
      return { ok: false, message: "Número muito longo (máx. 15 dígitos)." };
    if (digits.startsWith("55")) {
      const ddd = Number(digits.slice(2, 4));
      if (!Number.isFinite(ddd) || ddd < 11 || ddd > 99)
        return { ok: false, message: "DDD brasileiro inválido." };
      const subscriber = digits.slice(4);
      if (subscriber.length < 8 || subscriber.length > 9)
        return { ok: false, message: "Número brasileiro deve ter 8 ou 9 dígitos após o DDD." };
    }
    return { ok: true, message: "" };
  })();
  const canSubmit = validation.ok && !create.isPending && Boolean(companyId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.ok) {
      toast.error(validation.message || "Número inválido");
      return;
    }
    if (!canSubmit) return;
    try {
      const result = await create.mutateAsync({ phone: digits, name: name.trim() || null });
      if (result.templateSent) {
        toast.success("Conversa criada e mensagem inicial enviada");
      } else {
        toast.warning("Conversa criada, mas o template não pôde ser enviado", {
          description: result.templateError ?? "Verifique as credenciais do WhatsApp.",
        });
      }
      onCreated(result.conversationId);
      onOpenChange(false);
    } catch {
      // erro já tratado no hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>
            Informe o telefone do cliente com DDI e DDD. Ex.: 55 11 98888-7777. Enviaremos o
            template <code className="rounded bg-muted px-1">hello_world</code> para abrir a janela
            de conversa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-conv-phone">Telefone</Label>
            <Input
              id="new-conv-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D+/g, ""))}
              placeholder="5511988887777"
              autoFocus
              inputMode="numeric"
              maxLength={15}
            />
            <p
              className={
                validation.message
                  ? "text-[11px] text-destructive"
                  : "text-[11px] text-muted-foreground"
              }
            >
              {validation.message ||
                `Somente números serão enviados ao WhatsApp (${digits.length} dígitos).`}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-conv-name">Nome (opcional)</Label>
            <Input
              id="new-conv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do cliente"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {create.isPending ? "Criando..." : "Iniciar conversa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
