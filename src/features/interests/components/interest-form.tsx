import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCreateInterest } from "../hooks/use-interests";
import {
  useInterestCustomerOptions,
  useInterestProductOptions,
} from "../hooks/use-interest-options";
import { INTEREST_CHANNEL_OPTIONS, type InterestChannel } from "../types";

const schema = z.object({
  productId: z.string().uuid({ message: "Selecione um produto." }),
  customerName: z
    .string()
    .trim()
    .min(2, "Informe o nome do cliente.")
    .max(120, "Nome muito longo."),
  phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(500).optional(),
});

interface Props {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-seleciona o produto (ex.: a partir da ficha do produto). */
  productId?: string;
  customerId?: string;
  customerName?: string;
}

/**
 * Registro de interesse — grava apenas o desejo do cliente.
 * Não cria venda, não reserva estoque e não envia mensagens.
 */
export function InterestForm({
  companyId,
  open,
  onOpenChange,
  productId,
  customerId,
  customerName,
}: Props) {
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const debouncedProduct = useDebouncedValue(productSearch, 300);
  const debouncedCustomer = useDebouncedValue(customerSearch, 300);

  const [form, setForm] = useState({
    productId: productId ?? "",
    customerId: customerId ?? "",
    customerName: customerName ?? "",
    phone: "",
    channel: "whatsapp" as InterestChannel,
    interestDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const products = useInterestProductOptions(companyId, debouncedProduct);
  const customers = useInterestCustomerOptions(companyId, debouncedCustomer);
  const create = useCreateInterest();

  const productOptions = useMemo(() => products.data ?? [], [products.data]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    const parsed = schema.safeParse({
      productId: form.productId,
      customerName: form.customerName,
      phone: form.phone,
      notes: form.notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    try {
      await create.mutateAsync({
        company_id: companyId,
        product_id: form.productId,
        customer_id: form.customerId || null,
        customer_name: form.customerName.trim(),
        phone: form.phone.trim() || null,
        channel: form.channel,
        interest_date: form.interestDate,
        notes: form.notes.trim() || null,
      });
      toast.success("Interesse registrado.");
      onOpenChange(false);
      setForm((prev) => ({ ...prev, customerName: "", phone: "", notes: "", customerId: "" }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível registrar o interesse.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar interesse</DialogTitle>
          <DialogDescription>
            Registra o desejo do cliente por um produto. Nenhuma venda é criada e o
            estoque não é reservado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!productId && (
            <div className="space-y-1.5">
              <Label htmlFor="interest-product-search">Produto</Label>
              <Input
                id="interest-product-search"
                placeholder="Buscar produto…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <Select value={form.productId} onValueChange={(v) => set("productId", v)}>
                <SelectTrigger aria-label="Produto">
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.sku ? ` · ${p.sku}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="interest-customer">Cliente</Label>
              <Input
                id="interest-customer"
                value={form.customerName}
                maxLength={120}
                onChange={(e) => {
                  set("customerName", e.target.value);
                  setCustomerSearch(e.target.value);
                }}
                placeholder="Nome do cliente"
              />
              {(customers.data ?? []).length > 0 && !form.customerId && (
                <Select
                  value={form.customerId}
                  onValueChange={(v) => {
                    const found = (customers.data ?? []).find((c) => c.id === v);
                    setForm((prev) => ({
                      ...prev,
                      customerId: v,
                      customerName: found?.name ?? prev.customerName,
                      phone: found?.phone ?? prev.phone,
                    }));
                  }}
                >
                  <SelectTrigger aria-label="Vincular cliente cadastrado">
                    <SelectValue placeholder="Vincular cadastro (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(customers.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="interest-phone">Telefone</Label>
              <Input
                id="interest-phone"
                value={form.phone}
                maxLength={30}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="interest-channel">Canal</Label>
              <Select
                value={form.channel}
                onValueChange={(v) => set("channel", v as InterestChannel)}
              >
                <SelectTrigger id="interest-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTEREST_CHANNEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="interest-date">Data do interesse</Label>
              <Input
                id="interest-date"
                type="date"
                value={form.interestDate}
                onChange={(e) => set("interestDate", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="interest-notes">Observação</Label>
            <Textarea
              id="interest-notes"
              rows={3}
              maxLength={500}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Ex.: quer avisar quando chegar na cor azul"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Salvando…" : "Registrar interesse"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
