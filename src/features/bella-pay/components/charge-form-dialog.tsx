import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { useCreateAsaasCharge } from "../hooks/use-bella-pay";
import type { BellaPayBillingType } from "../types";

interface Customer {
  id: string;
  name: string;
}
interface Sale {
  id: string;
  number: string | null;
  grand_total: number;
}

interface Props {
  companyId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultSaleId?: string;
  defaultCustomerId?: string;
  defaultValue?: number;
}

export function ChargeFormDialog({
  companyId,
  open,
  onOpenChange,
  defaultSaleId,
  defaultCustomerId,
  defaultValue,
}: Props) {
  const create = useCreateAsaasCharge(companyId);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const [billingType, setBillingType] = useState<BellaPayBillingType>("PIX");
  const [customerId, setCustomerId] = useState<string>(defaultCustomerId ?? "none");
  const [saleId, setSaleId] = useState<string>(defaultSaleId ?? "none");
  const [value, setValue] = useState<string>(defaultValue?.toString() ?? "");
  const [dueDate, setDueDate] = useState<string>(() =>
    new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  );
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data: c } = await supabase
        .from("customers")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name")
        .limit(200);
      setCustomers((c ?? []) as Customer[]);
      const { data: s } = await supabase
        .from("sales")
        .select("id, number, grand_total")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50);
      setSales((s ?? []) as Sale[]);
    })();
  }, [open, companyId]);

  const submit = async () => {
    const numeric = Number(value.replace(",", "."));
    if (!numeric || numeric <= 0) return;
    await create.mutateAsync({
      customerId: customerId !== "none" ? customerId : null,
      saleId: saleId !== "none" ? saleId : null,
      billingType,
      value: numeric,
      dueDate,
      description: description || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova cobrança Bella Pay</DialogTitle>
          <DialogDescription>
            Gera cobrança no Asaas via PIX, cartão de crédito ou link de pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Método</Label>
              <Select
                value={billingType}
                onValueChange={(v) => setBillingType(v as BellaPayBillingType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>
                  <SelectItem value="UNDEFINED">Link de pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Valor</Label>
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cliente vinculado</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Venda</Label>
              <Select value={saleId} onValueChange={setSaleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem venda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem venda vinculada</SelectItem>
                  {sales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.number ?? s.id.slice(0, 8)} — R$ {Number(s.grand_total).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Cobrança referente ao pedido #123"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Gerando..." : "Gerar cobrança"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
