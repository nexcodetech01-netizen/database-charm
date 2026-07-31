import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/format";
import {
  useCreateReturn,
  useReturnedQuantities,
} from "../hooks/use-returns";
import type { SaleItem } from "@/features/sales/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
  saleId: string;
  saleNumber: string;
  saleItems: SaleItem[];
  paymentMethod: string | null;
  hasBellaPayCharge: boolean;
}

interface RowState {
  selected: boolean;
  quantity: string;
}

export function ReturnDialog({
  open,
  onOpenChange,
  companyId,
  saleId,
  saleNumber,
  saleItems,
  paymentMethod,
  hasBellaPayCharge,
}: Props) {
  const { data: returnedMap } = useReturnedQuantities(saleId);
  const { mutateAsync, isPending } = useCreateReturn();
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Record<string, RowState>>({});

  // Initialize rows when items load
  const initialRows = useMemo(() => {
    const r: Record<string, RowState> = {};
    for (const it of saleItems) {
      r[it.id] = { selected: false, quantity: "" };
    }
    return r;
  }, [saleItems]);

  // Merge state with initial
  const merged = { ...initialRows, ...rows };

  const availableFor = (item: SaleItem) => {
    const returned = returnedMap?.get(item.id) ?? 0;
    return Math.max(0, Number(item.quantity) - returned);
  };

  const totalValue = useMemo(() => {
    let total = 0;
    for (const it of saleItems) {
      const st = merged[it.id];
      if (!st?.selected) continue;
      const qty = Number(st.quantity.replace(",", ".")) || 0;
      total += qty * Number(it.unit_price);
    }
    return total;
  }, [saleItems, merged]);

  const anySelected = saleItems.some((it) => merged[it.id]?.selected);

  const paymentLabel: Record<string, string> = {
    cash: "Dinheiro",
    pix: "PIX",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    payment_link: "Link de pagamento",
    card: "Cartão",
    bella_pay: "Bella Pay",
  };
  const isCash = paymentMethod === "cash";
  const isDigital =
    !!paymentMethod && !isCash;

  async function submit() {
    if (!reason.trim()) return;
    if (!anySelected) return;

    const items = saleItems
      .filter((it) => merged[it.id]?.selected)
      .map((it) => {
        const qty = Number(merged[it.id].quantity.replace(",", ".")) || 0;
        return {
          sale_item_id: it.id,
          product_id: it.product_id,
          description: it.description,
          quantity: qty,
          unit_price: Number(it.unit_price),
          max_quantity: availableFor(it),
        };
      })
      .filter((i) => i.quantity > 0 && i.quantity <= i.max_quantity);

    if (items.length === 0) return;

    try {
      await mutateAsync({
        companyId,
        saleId,
        reason,
        notes: notes || null,
        items,
      });
      onOpenChange(false);
      setReason("");
      setNotes("");
      setRows({});
    } catch {
      /* toast handled in hook */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" /> Devolução — Venda {saleNumber}
          </DialogTitle>
          <DialogDescription>
            Selecione os itens devolvidos, informe as quantidades e o motivo.
            A venda original não será alterada.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div className="rounded-md border border-border">
            <div className="grid grid-cols-[24px_1fr_90px_100px_110px_110px] items-center gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <div />
              <div>Item</div>
              <div className="text-right">Vendida</div>
              <div className="text-right">Disponível</div>
              <div className="text-right">Devolver</div>
              <div className="text-right">Subtotal</div>
            </div>
            {saleItems.map((it) => {
              const st = merged[it.id];
              const avail = availableFor(it);
              const qty = Number((st.quantity || "").replace(",", ".")) || 0;
              const sub = qty * Number(it.unit_price);
              const disabled = avail <= 0;
              return (
                <div
                  key={it.id}
                  className="grid grid-cols-[24px_1fr_90px_100px_110px_110px] items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
                >
                  <Checkbox
                    checked={st.selected}
                    disabled={disabled}
                    onCheckedChange={(v) =>
                      setRows((prev) => ({
                        ...prev,
                        [it.id]: {
                          selected: !!v,
                          quantity:
                            v && !prev[it.id]?.quantity
                              ? String(avail)
                              : (prev[it.id]?.quantity ?? ""),
                        },
                      }))
                    }
                    aria-label={`Selecionar ${it.description}`}
                  />
                  <div className="truncate">{it.description}</div>
                  <div className="text-right tabular-nums">
                    {Number(it.quantity)}
                  </div>
                  <div className="text-right tabular-nums text-muted-foreground">
                    {avail}
                  </div>
                  <div>
                    <Input
                      className="h-8 text-right"
                      value={st.quantity}
                      disabled={!st.selected || disabled}
                      inputMode="decimal"
                      onChange={(e) =>
                        setRows((prev) => ({
                          ...prev,
                          [it.id]: {
                            ...(prev[it.id] ?? {
                              selected: true,
                              quantity: "",
                            }),
                            quantity: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="text-right tabular-nums font-medium">
                    {formatCurrency(sub)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="return-reason">
                Motivo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="return-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: item avariado, arrependimento, troca..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="return-notes">Observações</Label>
              <Textarea
                id="return-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <Alert>
            <AlertDescription className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span>
                  Forma de pagamento:{" "}
                  <Badge variant="outline" className="ml-1">
                    {paymentMethod
                      ? (paymentLabel[paymentMethod] ?? paymentMethod)
                      : "—"}
                  </Badge>
                </span>
                <span className="text-sm font-semibold">
                  Total: {formatCurrency(totalValue)}
                </span>
              </div>
              {isCash ? (
                <p>
                  Um lançamento de <strong>saída</strong> será criado no
                  Financeiro.
                </p>
              ) : null}
              {isDigital && hasBellaPayCharge ? (
                <p>
                  Uma solicitação de <strong>estorno</strong> será enviada ao
                  Bella Pay para a cobrança associada.
                </p>
              ) : null}
              {isDigital && !hasBellaPayCharge ? (
                <p>
                  Sem cobrança Bella Pay vinculada: apenas o registro de
                  devolução será feito. Estorno deve ser tratado manualmente.
                </p>
              ) : null}
              <p>
                O estoque dos produtos devolvidos será <strong>reentrado</strong>{" "}
                automaticamente.
              </p>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={isPending || !anySelected || !reason.trim() || totalValue <= 0}
          >
            {isPending ? "Registrando..." : "Confirmar devolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
