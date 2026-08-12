import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCreateMovement } from "../hooks/use-inventory";
import { MOVEMENT_TYPE_OPTIONS, MOVEMENT_REASONS, MOVEMENT_SOURCE_OPTIONS } from "../types";
import type { ManualMovementType, MovementSource } from "../types";
import { useAuth } from "@/providers/auth-provider";

const schema = z.object({
  product_id: z.string().uuid("Selecione um produto"),
  type: z.enum(["in", "out", "adjustment", "reservation", "transfer"]),
  quantity: z.coerce.number().refine((v) => v !== 0, "Quantidade não pode ser zero"),
  source: z.string().optional(),
  reference_number: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  movement_date: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  defaultProductId?: string;
  /** Tipo pré-selecionado ao abrir (ex.: "in" para entrada rápida). */
  defaultType?: ManualMovementType;
  /** Quando true, o produto não pode ser trocado no diálogo. */
  lockProduct?: boolean;
  /** Rótulo do produto travado (evita depender do picker). */
  lockedProductLabel?: string;
  /** Chamado após registrar a movimentação com sucesso. */
  onCompleted?: () => void;
}

export function MovementFormDialog({
  open,
  onOpenChange,
  companyId,
  defaultProductId,
  defaultType = "in",
  lockProduct = false,
  lockedProductLabel,
  onCompleted,
}: Props) {
  const { user } = useAuth();
  const create = useCreateMovement();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      product_id: defaultProductId ?? "",
      type: defaultType,
      quantity: 1,
      source: "manual",
      reference_number: "",
      reason: "",
      notes: "",
      movement_date: new Date().toISOString().slice(0, 16),
    },
  });

  // Ao (re)abrir, sincroniza produto e tipo com o contexto de origem.
  useEffect(() => {
    if (!open) return;
    form.reset({
      product_id: defaultProductId ?? "",
      type: defaultType,
      quantity: 1,
      source: "manual",
      reference_number: "",
      reason: "",
      notes: "",
      movement_date: new Date().toISOString().slice(0, 16),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultProductId, defaultType]);

  const type = form.watch("type") as ManualMovementType;
  const reasons = MOVEMENT_REASONS[type] ?? [];

  const [productQuery, setProductQuery] = useState("");
  const products = useProductsPicker(companyId, productQuery);
  const productId = form.watch("product_id");
  const selectedProduct = products.data?.find((p) => p.id === productId);


  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        company_id: companyId,
        product_id: values.product_id,
        type: values.type,
        quantity: Number(values.quantity),
        reason: values.reason || null,
        notes: values.notes || null,
        source: (values.source as MovementSource) || "manual",
        reference_number: values.reference_number || null,
        movement_date: new Date(values.movement_date).toISOString(),
        user_id: user?.id ?? null,
      });
      toast.success("Movimentação registrada");
      form.reset({
        ...form.getValues(),
        quantity: 1,
        reason: "",
        notes: "",
        reference_number: "",
      });
      onCompleted?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova movimentação</DialogTitle>
          <DialogDescription>
            Registre entradas, saídas ou ajustes. O saldo será atualizado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Product picker */}
          <div className="space-y-1.5">
            <Label>Produto</Label>
            {lockProduct ? (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                <span className="truncate">
                  {lockedProductLabel ?? selectedProduct?.name ?? "Produto selecionado"}
                </span>
              </div>
            ) : (
              <ProductCombobox
                value={productId}
                label={selectedProduct?.name}
                sku={selectedProduct?.sku}
                query={productQuery}
                onQueryChange={setProductQuery}
                products={products.data ?? []}
                loading={products.isFetching}
                onSelect={(id) => form.setValue("product_id", id)}
              />
            )}

            {form.formState.errors.product_id && (
              <p className="text-xs text-danger">
                {form.formState.errors.product_id.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(v) => form.setValue("type", v as ManualMovementType)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOVEMENT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {MOVEMENT_TYPE_OPTIONS.find((o) => o.value === type)?.description}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input
                type="number"
                step="any"
                {...form.register("quantity")}
              />
              {form.formState.errors.quantity && (
                <p className="text-xs text-danger">
                  {form.formState.errors.quantity.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select
                value={form.watch("source") || "manual"}
                onValueChange={(v) => form.setValue("source", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOVEMENT_SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Referência</Label>
              <Input
                {...form.register("reference_number")}
                placeholder="Nº do documento (opcional)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Select
                value={form.watch("reason") || ""}
                onValueChange={(v) => form.setValue("reason", v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="datetime-local" {...form.register("movement_date")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} {...form.register("notes")} placeholder="Opcional" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Product picker helpers ---------- */

import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

function useProductsPicker(companyId: string, q: string) {
  const debounced = useDebouncedValue(q, 250);
  return useQuery({
    queryKey: ["inv-product-picker", companyId, debounced],
    queryFn: async () => {
      let qry = supabase
        .from("products")
        .select("id, name, sku, unit, stock, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (debounced.trim()) {
        const s = `%${debounced.trim()}%`;
        qry = qry.or(`name.ilike.${s},sku.ilike.${s}`);
      }
      const { data, error } = await qry;
      if (error) throw error;
      return data ?? [];
    },
  });
}

function ProductCombobox({
  value,
  label,
  sku,
  query,
  onQueryChange,
  products,
  loading,
  onSelect,
}: {
  value: string;
  label?: string;
  sku?: string | null;
  query: string;
  onQueryChange: (v: string) => void;
  products: { id: string; name: string; sku: string | null }[];
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          {value ? (
            <span className="truncate">
              {label ?? "Produto selecionado"}
              {sku ? <span className="ml-2 text-xs text-muted-foreground">{sku}</span> : null}
            </span>
          ) : (
            <span className="text-muted-foreground">Selecione um produto</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nome ou SKU..."
            value={query}
            onValueChange={onQueryChange}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Carregando..." : "Nenhum produto encontrado"}
            </CommandEmpty>
            {products.map((p) => (
              <CommandItem
                key={p.id}
                value={p.id}
                onSelect={() => {
                  onSelect(p.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === p.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <div className="flex flex-col">
                  <span className="text-sm">{p.name}</span>
                  {p.sku && (
                    <span className="text-xs text-muted-foreground">{p.sku}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
