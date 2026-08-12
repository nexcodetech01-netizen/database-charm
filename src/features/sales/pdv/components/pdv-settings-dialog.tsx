import { useState } from "react";
import { Settings2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function PDVSettingsDialog({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: accounts } = useQuery({
    queryKey: ["financial-accounts", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_accounts")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const { data: company } = useQuery({
    queryKey: ["company-settings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("pos_default_account_id")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from("companies")
        .update({ pos_default_account_id: accountId })
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings", companyId] });
      toast.success("Configuração do PDV atualizada");
      setOpen(false);
    },
    onError: (err) => {
      toast.error("Erro ao salvar configuração", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurações do PDV</DialogTitle>
          <DialogDescription>
            Defina o comportamento padrão para vendas de balcão.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Conta de Destino Padrão</Label>
            <Select
              value={company?.pos_default_account_id || ""}
              onValueChange={(val) => mutation.mutate(val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta para recebimentos" />
              </SelectTrigger>
              <SelectContent>
                {accounts?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Esta conta será usada para baixas automáticas de Dinheiro, Débito e Pix.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
